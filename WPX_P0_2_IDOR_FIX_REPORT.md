# WPX P0-2 修复报告：智能模板 IDOR 越权漏洞

- 日期：2026-11-10
- 关联：第一阶段审计 P0-2；前置：P0-1（`/api/health` 信息泄露）已修复并通过 6 项回归
- 约束遵守：未提交 Git、未部署、未改数据库、未动 P0-1 修复、未升级依赖、保留了全部既有未提交修改

---

## 1. 漏洞根因

`server/controllers/user-memory.controller.js` 中 4 个按模板 ID 操作的端点（get/update/use/delete）**只做了登录认证（requireAuth），未做资源归属校验**；对应 `server/models/smart-template.js` 的 `findById/update/incrementUsage/remove` 的 SQL 均为 `WHERE id = $1`，不含 `user_id` 条件。任何已登录用户拿到（可枚举的）`stpl-<8hex>` ID 即可读/改/删/用他人模板。`incrementUsage` 还不返回 rowCount，越权使用永远"成功"且无法被服务端察觉。

## 2. 受影响的 API

| Route | 方法 | 风险 |
|---|---|---|
| `/api/smart-templates/:id` | GET | 越权读取他人模板内容（含 promptHint 等） |
| `/api/smart-templates/:id` | PUT | 越权篡改他人模板 |
| `/api/smart-templates/:id/use` | POST | 越权污染他人模板使用计数 |
| `/api/smart-templates/:id` | DELETE | 越权软删除他人模板 |

## 3. 修复前的权限控制情况

| 端点 | 认证 | 归属校验 | userId 来源 |
|---|---|---|---|
| generate / list / recommended | requireAuth | ✅ SQL 带 user_id | `req.user.accountId`（服务端） |
| get / update / use / delete | requireAuth | ❌ 无 | 未读取 userId |

## 4. 修复后的权限控制情况

- 4 个端点 Controller 层统一取 `userId = req.user?.accountId`（JWT 验证产物），缺失即 400。
- Model 层所有 SQL 强制 `AND user_id = $n`；`userId` 缺失时 fail-closed（抛错，绝不回退为无归属查询）。
- `incrementUsage`/`remove` 返回命中与否，未命中统一 404（防资源枚举）。
- 客户端提交的 `body.userId`/`query.userId` **一律不采信**（模型字段映射本就不含 user_id 列，无法被 patch）。
- 管理后台无任何使用 smart-template 模型的路由（已全仓核实），无需管理员旁路，未破坏任何合法业务。

## 5. 修改文件列表

| 文件 | 变更 | Git 状态 |
|---|---|---|
| `server/models/smart-template.js` | 4 个函数增加归属校验 | 已跟踪 M |
| `server/controllers/user-memory.controller.js` | 4 个端点接入服务端身份 | 已跟踪 M |
| `_server/models/smart-template.js` | 同步镜像（Vercel 生产实际加载 `_server/app.js`） | 未跟踪（本就存在） |
| `_server/controllers/user-memory.controller.js` | 同步镜像 | 未跟踪 |
| `api/admin/server/models/smart-template.js` | 同步镜像 | 未跟踪 |
| `api/admin/server/controllers/user-memory.controller.js` | 同步镜像 | 未跟踪 |
| `server/tests/p0-2-smart-template-idor.test.js` | 新增 13 项集成测试 | 新增 |

同步方式：以 `server/` 修复后文件覆盖镜像，`Compare-Object` 校验三份镜像 diff=0（满足 P0-1 报告中 T5 镜像一致性测试的要求）。`routes/user-memory.routes.js` 无需修改（requireAuth 挂载已正确）。

## 6. SQL 修改前后对比（server/models/smart-template.js）

```sql
-- findById 修改前
SELECT * FROM smart_templates WHERE id = $1 LIMIT 1
-- findById 修改后
SELECT * FROM smart_templates WHERE id = $1 AND user_id = $2 LIMIT 1

-- update 修改前
UPDATE smart_templates SET ..., updated_at = NOW() WHERE id = $1 RETURNING *
-- update 修改后
UPDATE smart_templates SET ..., updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *

-- incrementUsage 修改前（无返回值，越权不可察觉）
UPDATE smart_templates SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = $1
-- incrementUsage 修改后
UPDATE smart_templates SET usage_count = usage_count + 1, updated_at = NOW()
  WHERE id = $1 AND user_id = $2 RETURNING id   -- 返回 rowCount > 0

-- remove 修改前
UPDATE smart_templates SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id
-- remove 修改后
UPDATE smart_templates SET is_active = FALSE, updated_at = NOW()
  WHERE id = $1 AND user_id = $2 RETURNING id
```

## 7. Controller 修改前后对比（以 getTemplate 为例，其余 3 个同模式）

```js
// 修改前：不取身份，直接按 ID 查
const getTemplate = asyncHandler(async (req, res) => {
  const template = await smartTemplateModel.findById(req.params.id);
  ...
});

// 修改后：身份只来自 req.user.accountId，并强制传入 Model
const getTemplate = asyncHandler(async (req, res) => {
  const userId = req.user?.accountId;
  if (!userId) throw new BadRequestError('缺少用户标识');
  const template = await smartTemplateModel.findById(req.params.id, userId);
  if (!template) throw new NotFoundError('模板不存在');
  ...
});
```

## 8. 13 项测试执行结果（实际运行记录）

测试方式：**真实 Express HTTP 服务**（`server/app.js` createApp 监听随机端口）+ 通过 `require.cache` 注入内存版 db（不连接/不修改任何真实数据库）+ 项目自身 `jsonwebtoken` 签发 user_A / user_B 真实 JWT（issuer=prowpx.com, audience=wpx-server）。完整覆盖 Route → requireAuth → Controller → Model → SQL 调用链。

```
node --test server/tests/p0-2-smart-template-idor.test.js   (Node v24.14.0)
✔ T01 用户 A 通过 API 创建智能模板
✔ T02 用户 A 可以读取自己的模板
✔ T03 用户 B 读取 A 的模板 → 拒绝 (404)
✔ T04 用户 B 修改 A 的模板 → 拒绝，且内容不变
✔ T05 用户 B 删除 A 的模板 → 拒绝，模板仍存在
✔ T06 用户 B 使用 A 的模板 → 拒绝，使用计数不变
✔ T07 用户 A 修改自己的模板 → 成功
✔ T08 用户 A 删除自己的模板 → 成功（软删除后列表不再出现）
✔ T09 未登录用户访问模板 → 401 UNAUTHORIZED
✔ T10 用户 B 伪造 userId=user_A 仍然无法操作 A 的模板
✔ T11 用户 B 批量查询（list / recommended / limit=100）无法获取 A 的模板
✔ T12 不存在的模板 ID → 正常业务错误（404 NOT_FOUND）
✔ T13 并发场景不出现跨用户数据串用（40 并发：A 计数精确 +10，B 全部 404）
ℹ tests 13 / pass 13 / fail 0
```

说明：T03/T04/T05/T06 采用 404 而非 403，遵循"不泄露他人资源存在性"原则，与项目 NotFoundError 语义一致。测试首次运行 T08 失败，定位为测试替身（fake db）未模拟 `is_active = FALSE` 字面量赋值所致，属测试代码缺陷而非服务端缺陷，修正后 13/13 通过。

## 9. P0-1 回归测试结果

```
node --test api/__tests__/health-handler.test.js
ℹ tests 6 / pass 6 / fail 0    ← P0-1 修复未被破坏
```

## 10. Git Diff 摘要

```
 api/admin/handler.js                         | 65 ++++------------------  ← P0-1（上轮）
 server/controllers/user-memory.controller.js | 25 +++++++----              ← 本轮
 server/models/smart-template.js              | 49 +++++++++++++--------    ← 本轮
 wpx-app/test-results/.last-run.json          |  6 ++-                      ← 既有未提交修改，未触碰
 4 files changed, 62 insertions(+), 83 deletions(-)
```

新增（未跟踪）：`server/tests/p0-2-smart-template-idor.test.js`、`api/__tests__/health-handler.test.js`（P0-1）。镜像 `_server/`、`api/admin/server/` 本就未跟踪，同步修复后与 `server/` diff=0。

其他验证：`node --check` 全部改动文件通过；`git diff --check` 干净；IDE 诊断 0 错误。前端 `wpx-app/src` 无任何 `smart-templates` 引用（该 API 由桌面端运行时调用），无适用的前端测试需要执行。

## 11. 是否还有潜在越权风险（同模式排查结论）

| 位置 | 问题 | 状态 |
|---|---|---|
| `POST /api/user-memory/record`（optionalAuth） | `req.user?.accountId || req.body.userId` —— 未登录时采信 body.userId，可伪造他人写入记忆 | ⚠️ **仍存在**（属 user-memory 模块，不在本次"只处理智能模板 IDOR"范围，建议列入下批修复） |
| `POST /api/feedback/submit`（optionalAuth） | 同上模式的 body.userId 采信 | ⚠️ 同上 |
| `anysearch` 公开端点、登录/注册无限流 | 第一阶段 R-04 | 未处理 |
| 智能模板 list / recommended / generate | 本身已带归属条件 | ✅ 安全 |
| 管理后台 smart-template 通道 | 不存在（全仓核实模型唯一调用方为 user-memory.controller） | ✅ 无旁路 |

## 12. P0-2 最终验收结论

**✅ 满足验收条件。**

1. **是否彻底修复 IDOR**：是。4 个端点全部实现 SQL 级归属校验（`WHERE id AND user_id`），userId 仅取自服务端 JWT 身份、fail-closed、未命中统一 404 防枚举；13 项双用户隔离测试（含伪造身份、批量越界、并发）全部通过。
2. **A/B 隔离测试**：13/13 通过。
3. **其他相似越权接口**：存在两处同模式残留——`POST /api/user-memory/record` 与 `POST /api/feedback/submit` 在未登录时直接采信 `body.userId`（optionalAuth + body 兜底），建议作为下一批修复；其余用户资源接口（user-memory list/get、admin 全部路由）经核实均正确使用 `req.user.accountId`。
4. **P0-1 回归**：6/6 通过，旧修复未被破坏。

**遗留事项（需用户决策，本次未执行）**：① 提交并部署（生产 Vercel 上旧代码仍带 P0-1/P0-2 漏洞）；② user-memory/feedback 的 body.userId 兜底问题。

本次任务到此停止，未开始 P0-3，等待下一条指令。
