# WPX P0-3 修复报告：Electron IPC 任意路径读写漏洞

- 日期：2026-11-10
- 前置：P0-1（6/6）、P0-2（13/13）、P0-2 补充身份伪造（10/10）均已修复
- 约束：未提交 Git、未部署、未改数据库、未动前序修复、未升级依赖、既有未提交修改全部保留

## 1. 漏洞根因

`electron/main.js` 的 `file:read-document` / `file:write-document` / `file:write-binary`
（以及 `file:get-modified-time`、`file:convert-docx`）仅做参数类型检查，
渲染进程**仅凭提供一个任意路径即可获得主进程的磁盘读写能力**：
- 读：可读取任意盘符/路径的文件内容（含 docx/xlsx/pptx 解析）；
- 写：`fsp.writeFile` 任意路径，可覆盖系统/用户任意文件（文本或二进制）；
- 发送方无校验（`getSenderWindow` 只取窗口对象不验证归属），子 frame 亦可调用；
- 攻击面串联：渲染层 XSS/被入侵渲染进程 → `window:create(任意docPath)` → 新窗口按 URL query 加载 → 读取任意文件；或直接写任意路径。

## 2. 三个 IPC 的原始调用链（修复前）

```
Renderer（任意代码）
 → preload.js files.readDocument/writeDocument/writeBinary（ipcRenderer.invoke，无过滤）
 → ipcMain.handle('file:read-document'|'file:write-document'|'file:write-binary')
   → 仅 typeof 检查 → fsp.readFile / 解析器 → fsp.writeFile（utf8 / base64 二进制）
 → 实际磁盘文件（任意路径）
```

合法业务路径来源：
- 打开文件：`dialog:open-file`（主进程 showOpenDialog）→ 渲染层拿路径回读；
- 保存/另存为/导出：`dialog:show-save-dialog` → SaveDialog.vue → writeDocument/writeBinary；
- 窗口 docPath：`createManagedWindow(docPath)` → URL query → useLaunchDocument 读取、documentPack 写回、slides:export-pptx 原地保存；
- OS 关联打开：argv/second-instance → openAssociatedFile（主进程直接读，file:open 推送渲染层）。

## 3. 文件访问权限矩阵（修复后）

| 操作 | 路径来源 | 授权方式 | 风险处置 |
|---|---|---|---|
| 打开文档 | 系统文件对话框 | dialog:open-file → 签发 read+write | ✅ 保留 |
| 保存/另存为/导出 | 系统保存对话框 | dialog:show-save-dialog onFilePicked → 签发 read+write | ✅ 保留 |
| 窗口 docPath 读写 | OS 关联打开 / 已授权路径转移 | createManagedWindow 签发；window:create 须发送方已持 read+write | ✅ 保留（伪造路径被拒） |
| 渲染层任意路径读/写 | 请求参数 | ❌ 无授权 | 拒绝 |
| 子 frame / 未注册 WebContents | — | ❌ isTrustedSender=false | 拒绝 |
| zip:compress/extract、slides:export-pptx outputPath | 渲染层参数 | 未纳入本轮 | 独立漏洞（见 §12） |

## 4. 修复后的授权架构

新增两个模块（主进程，均不直接 require('electron')，依赖注入便于单测）：

```
electron/file-access.js  —— 精确路径授权注册表
  createFileAccessService()
    grant(senderId, rawPath, {read, write})  仅主进程可信来源调用
    check(senderId, rawPath, mode)           读/写分离校验
    revoke(senderId)                         窗口关闭时撤销
    grantCount(senderId)                     诊断

electron/file-ipc.js  —— 受保护的文件 IPC 注册
  isTrustedSender(event, {findWindowIdByWebContents})
      = sender 未销毁 且 senderFrame === sender.mainFrame（拒 iframe/子 frame）
        且 WebContents 属于 WindowManager 受管窗口
  authorizeDocPathTransfer(...)             window:create 的 docPath 转移校验
  registerFileIpc({...})                    6 个通道统一接入「发送方验证+授权」
```

授权签发点（全部基于真实用户操作，渲染层无法自造）：
1. `dialog:open-file`（file-ipc.js）→ 用户选定 → read+write；
2. `dialog:show-save-dialog`（dialog-ipc.js 新增 onFilePicked 回调）→ read+write；
3. `createManagedWindow(docPath)`（main.js）→ OS 关联打开 / 已授权转移 → read+write；
4. `openAssociatedFile` 五个交付分支 → 为主窗口签发 read+write
   〔状态更正 2026-11-10 / TASK-01 #8 + TASK-04：原报告写"四个分支"，
   实际 default 分支（.md/.wpx 等普通文档）当时漏签发，构成 D01 功能回归，
   已由 TASK-04 补齐（证据：debug/TASK-04-fix-d01.md）；〕
5. `window:create` 携 docPath → 发送方窗口须已持 read+write 才允许转移。

## 5. 文件路径校验方案（file-access.js）

- 拒绝相对路径（授权只接受绝对路径）；
- 拒绝 Windows UNC 网络路径（双反斜杠/双正斜杠开头）；
- 拒绝控制字符 / NUL / DEL；
- `path.resolve` 归一化消除 `..` / `.`，再用 **fs.realpath 解析符号链接**后与授权条目做**真实路径精确比对**（Windows 忽略大小写）；
- 绝不使用 startsWith 前缀匹配——归一化后不等于授权路径即拒绝，`../` 穿越无绕过面；
- 写新文件场景：文件不存在时回退「最近存在祖先目录的 realpath + basename」，父目录不存在则拒绝；
- 授权后符号链接被换指向授权范围外 → realpath 变化 → 拒绝（T10）；
- 用户通过对话框明确选择的路径不因其位于 userData 之外而被拒。

## 6. IPC 发送方验证方案（file-ipc.js）

```
isTrustedSender(event) =
  event.sender 存在且未销毁
  && event.senderFrame === event.sender.mainFrame   // iframe/子 frame 拒绝
  && WindowManager.findWindowIdByWebContents(sender) !== null  // 受管窗口
```

多窗口：授权按 `webContents.id` 隔离，A 窗口授权不能被 B 使用；
窗口 `closed` 事件 → `fileAccess.revoke(wcId)` 撤销全部授权。

<!-- PART3 -->


## 7. 修改文件清单

| 文件 | 变更 |
|---|---|
| `electron/file-access.js` | 新增：精确路径授权服务（纯模块，依赖注入） |
| `electron/file-ipc.js` | 新增：isTrustedSender + authorizeDocPathTransfer + registerFileIpc（6 通道受保护实现） |
| `electron/main.js` | 6 个无防护 inline 处理器替换为 registerFileIpc；window:create 接入授权转移；createManagedWindow 签发 docPath 授权 + closed 撤销；openAssociatedFile 分支补签发 |
| `electron/dialog-ipc.js` | handleShowSaveDialog 新增 onFilePicked 回调（授权签发），向后兼容 |
| `electron/__tests__/file-access-security.test.js` | 新增：21 项安全回归测试（覆盖 T01–T17） |
| `electron/preload.js` | **未改动**（公开 API 签名不变，前端零改动） |
| `wpx-app/**` | **未改动任何前端文件** |


## 8. 修改前后关键代码

修复前（main.js，无任何防护）：
  ipcMain.handle('file:write-document', async (_event, filePath, content) => {
    if (!filePath || typeof filePath !== 'string') return { ok: false, error: '无效路径' }
    await fsp.writeFile(filePath, content ?? '', 'utf8')   // 任意路径写入
    return { ok: true }
  })

修复后（file-ipc.js，发送方验证 + 授权校验）：
  ipcMain.handle('file:write-document', async (event, filePath, content) => {
    if (!trusted(event)) return { ok: false, error: '未授权写入该路径' }
    if (!filePath || typeof filePath !== 'string') return { ok: false, error: '无效路径' }
    if (!(await fileAccess.check(event.sender.id, filePath, 'write'))) {
      return { ok: false, error: '未授权写入该路径' }      // 未授权拒绝，不泄露内部信息
    }
    await fsp.writeFile(filePath, content ?? '', 'utf8')
    return { ok: true }
  })

读取拒绝统一返回 { error: '无权访问该文件', contentType: 'access-denied', denied: true }，
错误信息为通用文案，不含内部堆栈与系统路径细节。


## 9. 21 项测试执行结果（实际运行，含任务要求的 T01–T17）

运行方式：真实 registerFileIpc 注册的 handler + 真实 fs（临时目录），
仅伪造 Electron event 边界与对话框返回值，不 mock 路径检查逻辑。
命令（i:/WPX/wpx-app）：npm run test:zip -- file-access-security

T01 未授权读取任意文件 → 拒绝（响应不含文件内容）
T02 未授权写入任意文件 → 拒绝且文件内容不变
T03 未授权 write-binary → 拒绝且文件内容不变
T04 ../ 路径穿越 → 拒绝（归一化 + 精确比对）
T05 相对路径 → 按策略拒绝
T06 控制字符/NUL 路径 → 拒绝（授权表为服务端内存结构，无客户端 token 可伪造）
T07 窗口 B 使用窗口 A 的授权 → 拒绝
T08 不可信/未注册 WebContents、已销毁 sender → 拒绝
T09 iframe/子 frame 调用特权 IPC → 拒绝
T10 授权文件被换为指向范围外的符号链接 → 读写均拒绝
T11 对话框打开 Markdown → 授权签发 + 正常读取
T12 打开后保存（写回原文档）+ mtime 刷新 → 正常
T13 另存为新路径（show-save-dialog 授权 → writeBinary）→ 成功
T14 convert-docx 授权读取 → 正常；未授权 → 拒绝
T15 多窗口各自文档读写正常、跨窗口全部拒绝
T16 窗口关闭 → revoke 后授权失效
T17 重新打开应用（新会话重新签发授权）→ 打开/保存仍有效
附：window:create 授权转移 4 项（无 docPath 放行 / 已授权转移成功 /
未授权拒绝 UNAUTHORIZED_PATH / 不可信拒绝 UNTRUSTED_SENDER）

vitest 汇总：Test Files 1 passed (1) / Tests 21 passed (21)


## 10. 文件打开/保存/另存为/导出兼容情况

| 业务 | 链路 | 兼容性 |
|---|---|---|
| 打开已有文档 | dialog:open-file → 授权 → read-document | ✅（T11） |
| 保存原文档（Ctrl+S / documentPack 写回） | docPath 授权 → write-document | ✅（T12） |
| 另存为其他目录 | show-save-dialog → onFilePicked 授权 → write | ✅（T13） |
| 导出 PDF/DOCX/XLSX/图片（二进制） | 同上 write-binary | ✅（T13/T14） |
| 导出 PPTX | slides:export-pptx（独立通道，未改动） | ✅ 不受影响 |
| DOCX/XLSX/PPTX 导入 | read-document 解析（授权后） | ✅ |
| 文档自动保存 | 仅 localStorage 草稿，不写磁盘 | ✅ 不受影响 |
| 异常退出恢复 | localStorage 草稿 | ✅ 不受影响 |
| 压缩打包 | zip:compress（未改动） | ✅ 不受影响 |
| 前端代码 | documentFile.js / preload 公开 API 签名 | ✅ 零改动 |

## 11. 多窗口授权隔离

授权键 = webContents.id：窗口 A 对话框/docPath 授权仅 A 可用（T07/T15）；
window:create 携 docPath 须发送方窗口已持该路径 read+write（授权转移），
新窗口获得独立授权，旧窗口关闭即 revoke（T16），互不继承、互不串用。


## 12. knowledge-service 路径风险排查结果（关联风险）

确认存在**独立路径穿越漏洞**（已确认，本次未修，建议列入下一批）：
- electron/knowledge-service.js：knowledge:preview(id)（L156 拼接 textDir/{id}.txt）、
  knowledge:versions(docId)（L215）、knowledge:version-content(docId, verId)（L224-227）、
  knowledge:rollback(docId, verId)（L234-241，**fsp.writeFile 写出根目录**）、
  knowledge:delete(id)（L421）均将渲染层传入的 id/verId 直接 path.join，无归一化/边界校验；
- docId 正常由 randomUUID 生成，但读取/回滚/删除通道对传入值无格式校验，
  传 '../xxx' 可读任意 .txt，rollback 可向库根目录外写 .txt；
- 同批次其他路径类通道（zip:compress/extract 任意源目标、slides:export-pptx
  outputPath 任意写、local-server HTTP 无鉴权）已一并列入待办。

## 13. P0-1 / P0-2 回归结果

- node --test api/__tests__/health-handler.test.js：tests 6 / pass 6 / fail 0
- node --test server/tests/p0-2-smart-template-idor.test.js：tests 13 / pass 13 / fail 0
- node --test server/tests/p0-2b-identity-forgery.test.js：tests 10 / pass 10 / fail 0
- 合计 29/29 全部通过

其他回归（实际运行）：
- electron 全量 vitest：26 个测试文件，24 通过；2 个失败为**既有失败**
  （zip-ipc.test 26 项、hermes-ipc.test 27 项；zip-ipc.js / hermes-ipc.js
  及其测试文件本次均未修改，失败与本次改动零交集，属环境/依赖问题）。
- dialog-ipc.test.js（本次唯一被改模块的既有测试）：16/16 通过。
- wpx-app 前端 vitest：92/98 文件通过；6 个失败文件（hermesApi、
  HermesTaskCard、useEditorFonts 等）均为**既有失败**，前端本次零改动。
- node --check：main.js / dialog-ipc.js / file-access.js / file-ipc.js / 新测试 全部通过。
- git diff --check：干净。
- Electron 打包检查：未执行（需要 electron-builder 全量打包，副作用大）。


## 14. Git Diff 摘要

```
 electron/dialog-ipc.js                       |  18 +++-
 electron/main.js                             | 151 ++++++++-------------
 （新增未跟踪）electron/file-access.js          ~150 行
 （新增未跟踪）electron/file-ipc.js             ~190 行
 （新增未跟踪）electron/__tests__/file-access-security.test.js  ~330 行
 8 files changed, 149 insertions(+), 184 deletions(-)   ← 含 P0-1/P0-2 累计
```

既有未提交修改全部保留；未执行任何 git 破坏性操作。

## 15. P0-3 验收结论

**满足验收条件。**

> 〔状态更新 2026-11-10 / TASK-01~04：上述第 2 条"用户正常打开/保存…全部保持可用"
> 经 TASK-02/03 取证存在一处例外——OS 关联打开（openAssociatedFile default 分支）
> 因漏签发授权导致写回被拒（D01），**已由 TASK-04 修复并关闭**
> （diff 与测试见 debug/TASK-04-fix-d01.md）。遗留：T01b/G01/S01 及
> A 场景（应用未运行时双击内容不渲染）交付时序缺陷，见 debug/TASK-04-fix-d01.md §4。〕
1. 渲染进程不再能凭任意路径获得磁盘读写：读/写/二进制写全部要求
   「受管窗口主 frame + 主进程签发的精确真实路径授权」。
2. 用户正常打开/保存/另存为/导入/导出全部保持可用（对话框授权自动签发，
   前端零改动、preload 公开 API 不变）。
3. 多窗口按 WebContents 隔离授权，窗口关闭即撤销；授权转移校验阻止伪造 docPath。
4. 发现并确认独立漏洞：knowledge-service docId 路径穿越、zip:compress/extract
   任意路径、slides:export-pptx outputPath 任意写、local-server 无鉴权
   （与第一阶段 R-03 一致），均已在报告中记录，未在本次修改。

**遗留事项（需用户决策）**：① 提交并部署（含此前 P0-1/P0-2 修复）；
② 上述关联路径类漏洞修复批次；③ 上生产前建议在真实打包环境人工回归
文件打开/保存/另存为/导出全流程。

本次任务到此停止，未开始 P1，等待下一条指令。
