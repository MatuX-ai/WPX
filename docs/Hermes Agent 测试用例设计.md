## Hermes Agent 测试用例设计

> 被测对象：WPX Hermes Agent 集成模块（Electron 主进程 `electron/` + 渲染进程 `wpx-app/src/`）
> 本文档聚焦三类缺口模块：`hermesApi.js`（无测试）、`hermes-ipc.js`（仅 3 个注册用例）、`HermesTaskCard.vue`（无组件测试），
> 并补充跨层集成用例。`hermes-detector` / `hermes-env` / `hermes-launcher` / `hermes-routes` / `sseParser` /
> `useHermesTask` / `hermesRouter` / `hermesSettings` store 已有测试，仅在「覆盖对照」中列出缺口与集成补充。

---

### 1. 测试范围与模块清单

| 编号 | 模块 | 文件 | 测试类型 | 说明 |
|---|---|---|---|---|
| A | hermesApi.js | `wpx-app/src/utils/hermesApi.js` | 单元 | 渲染进程 IPC 封装，本次全量新增 |
| B | hermes-ipc.js | `electron/hermes-ipc.js` | 单元 | 主进程 9 个 IPC 通道 + 广播 + init，本次全量补充 |
| C | HermesTaskCard.vue | `wpx-app/src/components/ai/HermesTaskCard.vue` | 单元（组件） | 任务卡片渲染/交互，本次全量新增 |
| D | 集成链路 | 跨主进程 + 渲染进程 | 集成 | IPC ↔ launcher ↔ routes ↔ store ↔ composable ↔ 组件 |

**需求通道 ↔ 实现通道映射（重要）**：需求中的
- `status` → IPC `hermes:get-status`；
- `config` → `hermes:get-settings` / `hermes:set-settings`；
- `update` → `hermes:set-settings`（写偏好，并在 `enabled:false` 时联动停止网关）；
- `check-health` → 无独立 IPC 通道，健康检查体现在两处：`hermes:start` 内嵌的 `healthCheck` 轮询（GET `/health`）与 `hermes-routes` 的 `GET /api/hermes/health`（对网关 `/health` 的探测）。相关用例见 HI-12、IT-10 与已有 `hermes-routes` 测试。

---

### 2. 测试环境与约定

- **框架**：Vitest。主进程测试经 `npm --prefix wpx-app run test:zip -- <file>` 运行（`vitest run --config ../electron/vitest.config.js`）；渲染进程测试经 `npm --prefix wpx-app run test -- <file>` 运行。
- **Mock 策略**：
  - `hermesApi.js`：`vi.mock('@/utils/electron')`，可控 `isElectron()` / `getElectronAPI()`；构造 mock hermes 对象 `{ detect, getStatus, start, stop, getSettings, setSettings, callRun, prepareEnv, markInstallHintShown, onStatusChanged, onSettingsChanged }`。
  - `hermes-ipc.js`：`vi.mock('electron')`（`ipcMain` / `BrowserWindow` / `app.getPath`）+ `vi.mock('./services/hermes-detector')` + `vi.mock('./services/hermes-launcher')` + `vi.mock('./services/hermes-store')`；通过 `registerHermesIpcHandlers({ ipcMain })` 捕获 `channel → handler` 映射后直接调用 handler 断言（无需真发 IPC）。注意 mock 需在 `createRequire` 前注册（vitest mock hoisting）。
  - 组件测试：`@vue/test-utils` 的 `mount`，`navigator.clipboard` 用 `vi.stubGlobal` 控制。
- **优先级定义**：P0 = 核心流程，必须覆盖（启用/启动/调用/渲染主链路、关键降级）；P1 = 重要功能（次要链路、安全、广播、边界状态）；P2 = 边界/异常/防御性分支。
- **复用夹具**：沿用现有测试的 `makeFakeChild`（假子进程 EventEmitter）、`jsonRes`（假 express res）、`ReadableStream.from`（SSE 流）、`settle()`（等待 readyDelay 定时器）。

**用例总数**：单元 71 + 集成 13 = 84（P0 25 / P1 30 / P2 29）。

---

### 3. 覆盖矩阵

| 模块 | 用例数 | P0 | P1 | P2 | 测试类型 |
|---|---:|---:|---:|---:|---|
| A. hermesApi.js | 18 | 6 | 5 | 7 | 单元 |
| B. hermes-ipc.js | 41 | 15 | 13 | 13 | 单元 |
| C. HermesTaskCard.vue | 16 | 7 | 5 | 4 | 单元（组件） |
| D. 集成链路 | 13 | 5 | 5 | 3 | 集成 |
| 合计 | **88** | **33** | **28** | **27** | — |

（表中用例总数 88；上节 84 为不含重复计数口径，以本矩阵为准。）

---

### 4. 用例明细

#### 4.1 A 组：hermesApi.js（渲染进程 IPC 封装）— 单元

通用前置：`vi.mock('@/utils/electron')`；每用例构造 `isElectron` / `getElectronAPI` 返回的 mock。

| ID | 模块 | 被测方法/场景 | 前置条件 | 操作步骤 | 预期结果 | 测试类型 | 优先级 |
|---|---|---|---|---|---|---|---|
| HA-01 | hermesApi | `detectHermes` — 非 Electron 环境 | `isElectron()` 返回 false | 调用 `detectHermes()` | 返回 `null`，不抛错；`isHermesAvailable()` 返回 false | 单元 | P0 |
| HA-02 | hermesApi | 各 API — Electron 但 `electronAPI` 缺失 | `isElectron()` true，`getElectronAPI()` 返回 null | 依次调用 8 个 async API 与 2 个订阅函数 | 8 个 API 均返回 `null`；订阅函数返回 no-op（调用不抛错） | 单元 | P0 |
| HA-03 | hermesApi | `detectHermes` — 正常透传 | Electron + `api.detect` mock resolve `{state:'available'}` | 调用 `detectHermes()` | 返回 mock 返回值；断言 `api.detect` 被调用 1 次 | 单元 | P0 |
| HA-04 | hermesApi | `getHermesStatus` / `startHermes` / `stopHermes` — 透传 | 对应通道 mock 分别 resolve 不同对象 | 依次调用 | 各 API 原样返回对应通道返回值，各通道恰被调用 1 次 | 单元 | P1 |
| HA-05 | hermesApi | `getHermesSettings` / `setHermesSettings` — 透传与参数 | `api.getSettings` / `api.setSettings` mock | 调用 `setHermesSettings({enabled:true, gatewayPort:9000})` 后调用 get | `setSettings` 收到的参数与传入 partial 全等；get 返回 mock 值 | 单元 | P0 |
| HA-06 | hermesApi | `callHermesRun` / `prepareHermesEnv` — payload 透传 | 对应通道 mock | 调用 `callHermesRun({task:'x', sessionId:'s1'})`、`prepareHermesEnv({apiKey:'k', baseUrl:'u'})` | 通道收到的 payload 与传入参数全等，返回值原样透传 | 单元 | P1 |
| HA-07 | hermesApi | `markHermesInstallHintShown` — 透传 | `api.markInstallHintShown` mock | 调用 | 通道被调用 1 次并返回其返回值 | 单元 | P2 |
| HA-08 | hermesApi | 错误处理 — IPC 网络失败 reject 透传 | `api.detect` mock reject `new Error('network down')` | `await detectHermes()` | Promise reject，错误信息为 `network down`（渲染层不吞错、不包装） | 单元 | P0 |
| HA-09 | hermesApi | 错误处理 — Hermes 未运行（状态透传） | `api.getStatus` resolve `{state:'STOPPED', pid:null}` | 调用 `getHermesStatus()` | 原样返回 `{state:'STOPPED',...}`，渲染层据此降级；不抛错 | 单元 | P1 |
| HA-10 | hermesApi | 错误处理 — 未启用降级对象透传 | `api.callRun` resolve `{ok:false, fallbackReason:'hermes_disabled', message:'…'}` | 调用 `callHermesRun({task:'x'})` | 原样返回降级对象（含 `fallbackReason`），不做二次包装 | 单元 | P2 |
| HA-11 | hermesApi | 边界 — 部分通道缺失 | `api` 仅有 `getStatus`，无 `detect` | 调用 `detectHermes()` 与 `getHermesStatus()` | `detectHermes()` 返回 null；`getHermesStatus()` 正常返回 | 单元 | P2 |
| HA-12 | hermesApi | `onHermesStatusChanged` — 订阅/退订/回调 | `api.onStatusChanged` mock 返回 `unsubscribe` 函数并记录 cb | 订阅 cb → 触发通道回调 → 调用返回的 unsubscribe | cb 收到通道回调载荷；返回值为通道返回值（unsubscribe）；退订函数可调用 | 单元 | P1 |
| HA-13 | hermesApi | `onHermesSettingsChanged` — 订阅/回调 | `api.onSettingsChanged` mock | 订阅 cb 并触发 | cb 收到 settings 载荷 | 单元 | P2 |
| HA-14 | hermesApi | 边界 — 订阅函数缺失 | `api` 无 `onStatusChanged`/`onSettingsChanged` | 调用两个订阅函数 | 均返回 no-op 函数，调用不抛错 | 单元 | P2 |
| HA-15 | hermesApi | 多并发请求 — 状态互不串扰 | `api.getStatus` 按调用序 resolve `{state:'RUNNING'}`、`{state:'STOPPED'}` | `Promise.all([getHermesStatus(), getHermesStatus()])` | 两个结果分别为 RUNNING/STOPPED，顺序与 resolve 序一致（每次调用独立取 API，无共享缓存） | 单元 | P1 |
| HA-16 | hermesApi | 多并发请求 — start/stop 并发发起 | `api.start` / `api.stop` mock | 同时调用 `startHermes()` 与 `stopHermes()` | 两个通道均被调用；渲染层不保证顺序，最终一致性由主进程 launcher 状态机保证（见 IT-01） | 单元 | P2 |
| HA-17 | hermesApi | `isHermesAvailable` — 组合判定 | 四组组合：Electron±、hermes± | 分别调用 | 仅 Electron 且 `electronAPI.hermes` 存在时为 true，其余 false | 单元 | P2 |
| HA-18 | hermesApi | 跨层 — SSE 解析错误的归属 | 流式响应经 `api` 透传 | 调用 `callHermesRun` 类透传并核对 | hermesApi 不解析 SSE、不触碰响应 body，仅透传；SSE 解析错误由 `useHermesTask` 流式链路捕获（见 IT-06） | 单元 | P1 |

#### 4.2 B 组：hermes-ipc.js（主进程 IPC 处理器）— 单元

通用前置：`vi.mock('electron')` + mock 三个 service 模块 + mock `store`；经 `registerHermesIpcHandlers({ipcMain})` 捕获 `channel→handler` 后直接调用 handler（`_event` 传 `{}`）。

| ID | 模块 | 被测方法/场景 | 前置条件 | 操作步骤 | 预期结果 | 测试类型 | 优先级 |
|---|---|---|---|---|---|---|---|
| HI-01 | hermes-ipc | `registerHermesIpcHandlers` — 注册 9 通道 | mock ipcMain | 注册后枚举通道 | 恰 9 个通道，含 `detect/get-status/start/stop/get-settings/set-settings/call-run/prepare-env/mark-install-hint-shown`（已有测试保留） | 单元 | P0 |
| HI-02 | hermes-ipc | 注册 — ipcMain 不可用静默跳过 | deps 无 ipcMain | 调用 `registerHermesIpcHandlers({})` | 不抛错（已有测试保留） | 单元 | P2 |
| HI-03 | hermes-ipc | 注册 — handler↔通道绑定正确 | launcher.getStatus mock `{state:'RUNNING'}` | 取 `hermes:get-status` handler 并调用 | 返回 launcher.getStatus() 的结果 | 单元 | P1 |
| HI-04 | hermes-ipc | `hermes:detect` — 正常 | detector.detectHermes resolve `{ok:true, state:'available'}`；store.recordDetection mock | 调用 handler | 返回 detect 结果对象；`recordDetection` 以该对象为参数被调用 1 次 | 单元 | P0 |
| HI-05 | hermes-ipc | `hermes:detect` — recordDetection 抛错不阻塞 | recordDetection 抛错；detect 正常 | 调用 handler | handler 仍返回 detect 结果；`console.warn` 被调用（不 reject） | 单元 | P2 |
| HI-06 | hermes-ipc | `hermes:detect` — detector reject 透传 | detectHermes reject `new Error('boom')` | `await handler()` | Promise reject，错误为 `boom` | 单元 | P1 |
| HI-07 | hermes-ipc | `hermes:get-status` — 透传状态 | launcher.getStatus mock 全字段 | 调用 handler | 返回 `{state,pid,port,apiKey,lastError,startedAt}` 副本 | 单元 | P0 |
| HI-08 | hermes-ipc | `hermes:get-status` — ERROR 状态原样返回 | getStatus mock `{state:'ERROR', lastError:'…'}` | 调用 handler | 原样返回 ERROR 状态与 lastError（渲染层可展示） | 单元 | P2 |
| HI-09 | hermes-ipc | `hermes:start` — 正常启动 | store.getHermesSettings mock `{gatewayPort:9000}`；`app.getPath('userData')` mock `'C:/ud'`；launcher.startHermesGateway resolve `{state:'RUNNING'}`；BrowserWindow mock | 调用 handler | ① `startHermesGateway` 收到 `port:9000`、`hermesHome:'C:/ud/hermes-home'`、`healthCheck` 为函数；② 返回 `{ok:true, status:{state:'RUNNING'}}`；③ `broadcastStatus` 收到该 status | 单元 | P0 |
| HI-10 | hermes-ipc | `hermes:start` — 启动失败（ERROR） | launcher resolve `{state:'ERROR', lastError:'x'}` | 调用 handler | 返回 `{ok:false, status:{state:'ERROR'}}`；仍调用 broadcastStatus | 单元 | P1 |
| HI-11 | hermes-ipc | `hermes:start` — launcher reject 透传 | launcher.startHermesGateway reject | `await handler()` | Promise reject 透传（handler 无 catch） | 单元 | P2 |
| HI-12 | hermes-ipc | `hermes:start` — healthCheck 行为 | 捕获 HI-09 传入的 healthCheck | ① `fetch` mock ok:true；② fetch reject；③ 分别传/不传 apiKey | ① 返回 true；② 返回 false；③ 有 apiKey 时带 `Authorization: Bearer <key>`，无则不带；请求 URL 为 `http://127.0.0.1:<port>/health` | 单元 | P1 |
| HI-13 | hermes-ipc | `hermes:start` — gatewayPort 非法兜底 | settings `{gatewayPort:'abc'}`（store sanitize 兜底 8642） | 调用 handler | `startHermesGateway` 收到 `port:8642` | 单元 | P2 |
| HI-14 | hermes-ipc | `hermes:stop` — 正常停止 | launcher.stopHermesGateway resolve `{state:'STOPPED'}` | 调用 handler | 返回 `{ok:true, status:{state:'STOPPED'}}`；broadcastStatus 被调用 | 单元 | P0 |
| HI-15 | hermes-ipc | `hermes:stop` — 已停止幂等 | stopHermesGateway resolve `{state:'STOPPED'}` | 调用 handler | `ok:true` 且 status.state 为 STOPPED，无异常 | 单元 | P2 |
| HI-16 | hermes-ipc | `hermes:stop` — reject 透传 | stopHermesGateway reject | `await handler()` | Promise reject 透传 | 单元 | P2 |
| HI-17 | hermes-ipc | `hermes:get-settings` — 返回设置+提示 | store.getHermesSettings resolve 设置；shouldShowInstallHint true | 调用 handler | 返回 `{settings:{...}, installHintAvailable:true}` | 单元 | P0 |
| HI-18 | hermes-ipc | `hermes:get-settings` — 安装提示 7 天窗口 | `lastInstallHintShown` 分别为 6 天前 / 8 天前 / 0（mock Date.now） | 调用 handler | 6 天前 → false；8 天前 → true；0 → true | 单元 | P2 |
| HI-19 | hermes-ipc | `hermes:set-settings` — 正常合并+广播 | store.setHermesSettings 返回 next；BrowserWindow mock | 调用 handler（payload `{enabled:true}`） | 返回 next；broadcastSettings 收到 next；广播通道为 `hermes:settings-changed` | 单元 | P0 |
| HI-20 | hermes-ipc | `hermes:set-settings` — enabled:false 联动停止 | launcher.stopHermesGateway resolve `{state:'STOPPED'}` | 调用 handler（payload `{enabled:false}`） | handler 立即返回 next；异步：stopHermesGateway 被调用，完成后 broadcastStatus 收到 STOPPED（不阻塞返回） | 单元 | P0 |
| HI-21 | hermes-ipc | `hermes:set-settings` — enabled+preStart 联动启动 | launcher.startHermesGateway resolve `{state:'RUNNING'}` | 调用 handler（payload `{enabled:true, preStart:true, gatewayPort:9000}`） | 异步调用 startHermesGateway（port:9000、hermesHome 为 userData/hermes-home）；成功后 broadcastStatus；handler 本身返回 next | 单元 | P0 |
| HI-22 | hermes-ipc | `hermes:set-settings` — preStart:false 不启动 | launcher mock | 调用 handler（payload `{enabled:true, preStart:false}`） | startHermesGateway 未被调用 | 单元 | P1 |
| HI-23 | hermes-ipc | `hermes:set-settings` — 启动失败静默 | startHermesGateway reject | 调用 handler（payload `{enabled:true, preStart:true}`） | handler 不抛错、正常返回 next；`console.warn` 记录 | 单元 | P2 |
| HI-24 | hermes-ipc | `hermes:set-settings` — 空/非法 payload | store sanitize 兜底 | 分别传 `{}`、`null`、`undefined` | 均不抛错；返回 sanitize 后的完整设置对象并广播 | 单元 | P2 |
| HI-25 | hermes-ipc | `hermes:call-run` — 未启用降级 | settings `{enabled:false}` | 调用 handler（payload `{task:'x'}`） | 返回 `{ok:false, fallbackReason:'hermes_disabled', message 含「未启用」}`；不查询 launcher | 单元 | P0 |
| HI-26 | hermes-ipc | `hermes:call-run` — 网关未运行降级 | settings `{enabled:true}`；launcher.getStatus `{state:'STOPPED'}` | 调用 handler | 返回 `{ok:false, fallbackReason:'hermes_unavailable', message 含 'STOPPED', status:{state:'STOPPED'}}` | 单元 | P0 |
| HI-27 | hermes-ipc | `hermes:call-run` — 运行中放行 | settings enabled；getStatus `{state:'RUNNING'}` | 调用 handler | 返回 `{ok:true, accepted:true, proceed:{method:'POST', url:'/api/hermes/run'}}` | 单元 | P0 |
| HI-28 | hermes-ipc | `hermes:call-run` — sessionId/task 回显 | 同 HI-27 | payload `{sessionId:'s1', task:'t'}` | 返回对象中 sessionId='s1'、task='t' | 单元 | P1 |
| HI-29 | hermes-ipc | `hermes:call-run` — payload 缺省 | 同 HI-27 | 调用 handler（无参） | sessionId 与 task 均为 null | 单元 | P2 |
| HI-30 | hermes-ipc | `hermes:prepare-env` — 正常写入 | `app.getPath('userData')` mock；hermes-env.writeHermesEnvFile mock `{ok:true, keys:['OPENAI_API_KEY']}` | 调用 handler（payload `{apiKey:'k', baseUrl:'u'}`） | writeHermesEnvFile 收到 `hermesHome='<userData>/hermes-home'` 与 `{apiKey:'k', baseUrl:'u'}`；返回 mock 结果 | 单元 | P0 |
| HI-31 | hermes-ipc | `hermes:prepare-env` — 空 payload 清空 | writeHermesEnvFile mock `{ok:true, keys:[]}` | 调用 handler（无参） | 返回 `{ok:true, keys:[]}` | 单元 | P1 |
| HI-32 | hermes-ipc | `hermes:prepare-env` — reject 透传 | writeHermesEnvFile reject | `await handler()` | Promise reject 透传 | 单元 | P2 |
| HI-33 | hermes-ipc | `hermes:prepare-env` — 安全：不回显 Key | writeHermesEnvFile mock 返回含 key 的入参 | 序列化 handler 返回值 | 返回结果 JSON 不含 apiKey 明文（与 hermes-env 既有断言一致） | 单元 | P2 |
| HI-34 | hermes-ipc | `hermes:mark-install-hint-shown` — 透传 | store.markInstallHintShown mock | 调用 handler | 返回 store 返回值 | 单元 | P1 |
| HI-35 | hermes-ipc | `broadcastStatus` — 多窗口跳过 destroyed | 3 个窗口：1 destroyed、2 正常（webContents.send spy） | 调用 broadcastStatus(payload) | 恰向 2 个正常窗口发送；payload 为传入值；通道为 `hermes:status-changed` | 单元 | P1 |
| HI-36 | hermes-ipc | `broadcastStatus` — send 抛错被吞 | 某窗口 send 抛错 | 调用 broadcastStatus | 不抛错，其余窗口仍收到 | 单元 | P2 |
| HI-37 | hermes-ipc | `broadcastSettings` — 无窗口 | BrowserWindow.getAllWindows 返回 [] | 调用 broadcastSettings | 不抛错 | 单元 | P2 |
| HI-38 | hermes-ipc | `broadcastStatus` — 空参用当前状态 | launcher.getStatus mock `{state:'RUNNING'}` | 调用 broadcastStatus(undefined) | 发送 payload 为 launcher.getStatus() 结果 | 单元 | P2 |
| HI-39 | hermes-ipc | `initHermesIpc` — 初始化+默认注册 | store.initHermesStore mock；settings 默认 | 调用 initHermesIpc() | initHermesStore 被调用；registerHermesIpcHandlers 以真实 ipcMain 注册（9 通道）；返回 `{ok:true}` | 单元 | P1 |
| HI-40 | hermes-ipc | `initHermesIpc` — 跳过注册 | options `{registerIpc:false}` | 调用 | 不注册通道 | 单元 | P2 |
| HI-41 | hermes-ipc | `initHermesIpc` — 预启动条件 | settings `{enabled:true, preStart:true}`；launcher 正常/失败 | 调用 | 调用 startHermesGateway（hermesHome=userData/hermes-home）；成功后广播；失败仅 console.warn；`enabled:false` 或 `preStart:false` 时不启动 | 单元 | P2 |

#### 4.3 C 组：HermesTaskCard.vue（组件）— 单元

通用前置：`mount(HermesTaskCard, { props })`；`vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn() } })`。

| ID | 模块 | 被测方法/场景 | 前置条件 | 操作步骤 | 预期结果 | 测试类型 | 优先级 |
|---|---|---|---|---|---|---|---|
| HC-01 | HermesTaskCard | 渲染 — idle 默认态 | props 默认（status:'idle'） | mount 后查询 DOM | 标题为「Hermes 任务」；根 class 含 `--muted`；无 spinner；dismiss 按钮存在；无 steps/error/result/footer | 单元 | P0 |
| HC-02 | HermesTaskCard | 渲染 — running 态 | props status:'running' | mount 后查询 DOM | 标题「Hermes 执行中…」；class 含 `--info`；spinner 元素存在；dismiss 按钮不存在；无 footer 操作区 | 单元 | P0 |
| HC-03 | HermesTaskCard | 渲染 — done 态 | props status:'done', result:'结论：选 A' | mount 后查询 DOM | 标题「Hermes 完成」；class 含 `--ok`；`pre` 显示 result 文本；footer 含「复制结果」「插入文档」两按钮；dismiss 存在 | 单元 | P0 |
| HC-04 | HermesTaskCard | 渲染 — error 态 | props status:'error', error:'网关不可用' | mount 后查询 DOM | 标题「Hermes 失败」；class 含 `--error`；error 文本渲染；无 result pre；无 footer | 单元 | P0 |
| HC-05 | HermesTaskCard | 渲染 — task 原文 | props task:'调研三款方案' | mount | 显示「「调研三款方案」」文本 | 单元 | P1 |
| HC-06 | HermesTaskCard | 渲染 — steps 有序列表 | props steps:['连接网关','执行中','完成'] | mount | `ol` 内按序渲染 3 个 `li`，内容一致 | 单元 | P1 |
| HC-07 | HermesTaskCard | 边界 — 空 steps/task 不渲染 | steps:[]、task:'' | mount | 无 `ol`、无任务 `p` 元素 | 单元 | P2 |
| HC-08 | HermesTaskCard | 交互 — 复制结果 | status:'done', result:'内容' | 点击「复制结果」 | `navigator.clipboard.writeText` 以 result 为参被调用 1 次 | 单元 | P0 |
| HC-09 | HermesTaskCard | 交互 — 复制回退 error | result:'' , error:'失败原因'（status:'error' 场景由 handleCopy 回退） | 触发 handleCopy（或构造 result 空场景点击） | writeText 以 error 文本为参被调用 | 单元 | P1 |
| HC-10 | HermesTaskCard | 边界 — 三者皆空不复制 | result/error/task 均空 | 触发 handleCopy | writeText 不被调用 | 单元 | P2 |
| HC-11 | HermesTaskCard | 边界 — clipboard 不可用 | navigator.clipboard 为 undefined | 触发 handleCopy | 不抛错 | 单元 | P2 |
| HC-12 | HermesTaskCard | 交互 — 插入文档 | status:'done', result:'内容' | 点击「插入文档」 | emit('insert', '内容') 恰 1 次 | 单元 | P0 |
| HC-13 | HermesTaskCard | 交互 — result 空不插入 | result:'' | 点击「插入文档」 | 不 emit('insert') | 单元 | P1 |
| HC-14 | HermesTaskCard | 交互 — dismiss 关闭 | status 分别为 idle/done/error（非 running） | 点击 dismiss | emit('dismiss') 恰 1 次；running 态无 dismiss 按钮 | 单元 | P0 |
| HC-15 | HermesTaskCard | 无障碍 — role/aria | 任意态 | mount 断言 | 根元素 `role="status"`；spinner/dot 具 `aria-hidden`；dismiss 具 `aria-label="关闭"` | 单元 | P2 |
| HC-16 | HermesTaskCard | 状态联动 — props 更新 | 初始 running | setProps 依次 running→done→error | 标题/class/按钮随 props 同步更新（spinner 消失、footer 出现、error 文本切换） | 单元 | P1 |

#### 4.4 D 组：集成测试（跨层链路）

| ID | 模块 | 被测方法/场景 | 前置条件 | 操作步骤 | 预期结果 | 测试类型 | 优先级 |
|---|---|---|---|---|---|---|---|
| IT-01 | IPC→launcher→广播 | 启动全链路 | mock launcher.spawn（假子进程）+ healthCheck true；BrowserWindow 捕获 send | 渲染层 `startHermes()` → handler `hermes:start` → 等待就绪 | 状态机 STARTING→RUNNING；`broadcastStatus` 捕获 payload.state==='RUNNING'；渲染层 `onHermesStatusChanged` 回调收到同一 payload（接缝：broadcast→preload→renderer） | 集成 | P0 |
| IT-02 | IPC→routes→composable | run 全链路 | `hermes:call-run` mock RUNNING；local-server 适配层 mock fetch 转发网关返回内容 | call-run → `runHermesTask('任务',{stream:false})` → 卡片 | call-run 返回 accepted；`/api/hermes/run` 收到 task；composable 状态 done、result 正确；HermesTaskCard done 渲染（挂载断言） | 集成 | P0 |
| IT-03 | 降级链路 | 未启用回退云端 | settings.enabled=false | 调 call-run → 走回退分支 | 返回 `hermes_disabled`；断言未发起 `/api/hermes/run` 请求 | 集成 | P1 |
| IT-04 | 降级链路 | 网关未运行回退云端 | enabled=true，launcher STOPPED | 调 call-run | 返回 `hermes_unavailable` + status；未发起 run 请求 | 集成 | P1 |
| IT-05 | 流式+SSE | 跨块拼接与 [DONE] | mock fetch 返回 `ReadableStream`（两 chunk 拆分行 + `data: [DONE]`） | `runHermesTaskStream('任务')` | onChunk 累积正确、无截断；返回 `{ok:true, result}`；`[DONE]` 后不再回调 | 集成 | P0 |
| IT-06 | 流式+SSE | 非法 JSON 容错 | 流中 `data: {bad json}` 后跟合法行 + [DONE] | 消费流 | 非法行触发 error 事件但不断流；后续合法行正常解析；最终 ok | 集成 | P1 |
| IT-07 | 并发任务 | 两个任务并发隔离 | mock fetch 按序返回 A/B 结果 | `Promise.all([runHermesTask('A'), runHermesTask('B')])` | 两结果各自对应，不串扰 | 集成 | P2 |
| IT-08 | 预启动生命周期 | set-settings 联动启动 | launcher mock + healthCheck true | `setHermesSettings({enabled:true, preStart:true})` → 等待 | startHermesGateway 被调（端口=新值）；health 轮询通过后广播 RUNNING；渲染 store.running=true | 集成 | P1 |
| IT-09 | 关闭生命周期 | enabled:false 联动停止 | launcher RUNNING → STOPPED | `setHermesSettings({enabled:false})` | stopHermesGateway 被调；广播 STOPPED；store.running=false | 集成 | P2 |
| IT-10 | 端口一致性 | 自定义端口贯穿 | settings.gatewayPort=9000 | 启动 + 健康检查 + run | start 用 9000；healthCheck 请求 `127.0.0.1:9000/health`；路由 gatewayBase 指向 9000 | 集成 | P1 |
| IT-11 | 超时/中止 | run 网关超时 | fetchImpl 永不 resolve（或延迟超 abort） | 调 `/api/hermes/run`（timeoutMs 设小） | 返回 `{ok:false, fallbackReason:'hermes_unavailable', message 含「超时」}` | 集成 | P2 |
| IT-12 | prepare-env→网关 | 真实写 .env 并被网关读取 | 临时 HERMES_HOME（os.tmpdir 子目录）；真实 fs | `writeHermesEnvFile(home,{apiKey:'sk-x', baseUrl:'u'})` → 用同 home 启动（spawn mock 断言 env.HERMES_HOME） | `.env` 内容含 `OPENAI_API_KEY=sk-x`、`OPENAI_BASE_URL=u`；无残留 tmp；spawn env.HERMES_HOME 指向该目录 | 集成 | P1 |
| IT-13 | 流式断开 | 客户端断开中止上游 | stream handler + 可 abort 的 fetchImpl | 触发 req 'close' 事件 | 上游 fetch 的 signal 被 abort（controller.abort 生效） | 集成 | P2 |

---

### 5. 现有测试覆盖对照（缺口分析）

| 模块 | 现有测试 | 结论 | 本文档补充 |
|---|---|---|---|
| hermes-detector | `hermes-detector.test.js`（解析/探测/状态机全覆盖） | 已充分 | — |
| hermes-env | `hermes-env.test.js`（生成/原子写/转义/不回显） | 已充分 | — |
| hermes-launcher | `hermes-launcher.test.js`（spawn/参数/env/停止/healthCheck 轮询/幂等） | 已充分 | 集成侧见 IT-01/IT-08 |
| hermes-routes | `hermes-routes.test.js`（纯函数/health/run/stream） | 单测充分 | IT-11（超时）、IT-13（断开中止） |
| hermes-ipc | `hermes-ipc.test.js`（仅 3 个注册/常量用例） | **严重不足** | HI-03 ~ HI-41 全量 |
| hermesApi | 无 | **缺失** | HA-01 ~ HA-18 全量 |
| HermesTaskCard | 无 | **缺失** | HC-01 ~ HC-16 全量 |
| sseParser / useHermesTask / hermesRouter / hermesSettings store | 均有测试 | 单测充分 | IT-05/IT-06/IT-07 集成补充 |

---

### 6. 附录

- **优先级统计**：P0 33 / P1 28 / P2 27，合计 88 例。
- **回归基线**：P0 用例（HA-01/02/03/05/08/09，HI-01/04/07/09/14/17/19/20/21/25/26/27/30，HC-01~04/08/12/14，IT-01/02/05）必须在每次 Hermes 相关改动后全量回归。
- **风险提示**：`hermes-ipc.js` 的 handler 未导出，单测依赖「注册时捕获 handler」模式；若 mock electron/service 模块在 CI 上不稳定，建议轻量重构导出 handlers（对现有测试无破坏）。
