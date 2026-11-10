# WPX P0-2 补充修复报告：body.userId 身份伪造问题（安全加固）

- 日期：2026-11-10
- 前置：P0-1（6/6）、P0-2 智能模板 IDOR（13/13）均已修复
- 约束：未提交 Git、未部署、未改数据库、未动前两轮修复、未升级依赖、既有未提交修改全部保留

## 1. 两个接口的原始身份验证问题

**① `POST /api/user-memory/record`**（`server/controllers/user-memory.controller.js`，路由 `optionalAuth`）：
`const userId = req.user?.accountId || req.body.userId;` —— 未登录时直接采信客户端 `body.userId`，任何人可伪造任意账户身份写入/污染其写作记忆（`user_writing_memory` 为账户级私有数据）。

**② 反馈提交接口**（`server/routes/feedback.routes.js`）：
`userId: req.user?.accountId || body.userId || 'anonymous'` —— 匿名反馈是合法业务必须保留，但 `body.userId` 兜底允许匿名请求伪造任意账户提交反馈。

**路径勘误**：`feedback.routes.js` 实际挂载于 `/api`（`routes/index.js:14`）且路径定义为 `/submit`，**实际生效路径为 `POST /api/submit`**；文件头注释写的 `/api/feedback/submit` 实际返回 404。本次按实际路径修复与测试。

## 2. 修复前后调用链

```
user-memory/record 修复前：
  optionalAuth（匿名放行）→ userId = req.user?.accountId || req.body.userId ← 伪造点 → INSERT user_writing_memory
user-memory/record 修复后：
  requireAuth（匿名 → 401）→ userId = req.user?.accountId（缺失 → 401）→ INSERT user_writing_memory

反馈 submit 修复前：
  optionalAuth → userId = req.user?.accountId || body.userId || 'anonymous' ← 伪造点 → INSERT feedbacks
反馈 submit 修复后：
  optionalAuth（保留匿名能力）→ userId = req.user?.accountId || 'anonymous'（body.userId 一律丢弃）→ INSERT feedbacks
```

## 3. 用户身份获取方式

| 场景 | 修复后身份来源 |
|---|---|
| 已登录 | 仅 `req.user.accountId`（JWT 校验产物） |
| 未登录（记忆） | 拒绝（401），记忆必须归属账户 |
| 未登录（反馈） | 固定 `'anonymous'`，客户端无法指定 |
| query/body/URL 中的 userId | 一律不采信 |

## 4. 匿名访问策略（业务语义分析结论）

| 接口 | 决策 | 依据 |
|---|---|---|
| user-memory/record | 改为强制登录（optionalAuth → requireAuth） | 数据模型为账户级记忆（同控制器其余端点全部 requireAuth）；匿名写入无合法归属；全仓核实（wpx-app/src、electron、admin/src）当前无任何客户端调用此接口，不存在会被破坏的匿名业务流 |
| feedback/submit（实际 /api/submit） | 保留匿名能力，未登录一律 anonymous | 路由注释明确"公开，可选 auth"；contact 字段已提供联系方式渠道 |

## 5. 修改文件列表

| 文件 | 变更 |
|---|---|
| `server/routes/user-memory.routes.js` | record 路由 optionalAuth → requireAuth |
| `server/controllers/user-memory.controller.js` | recordDocument 移除 body.userId 兜底 |
| `server/routes/feedback.routes.js` | 移除 body.userId 兜底，匿名固定 anonymous |
| `_server/`、`api/admin/server/` 三个对应文件 | 镜像同步（仅复制上述 3 个文件） |
| `server/tests/p0-2b-identity-forgery.test.js` | 新增 T01–T10 测试 |

## 6. 新增测试及实际执行结果

测试方式：真实 Express HTTP 服务 + require.cache 注入内存 db + 真实 JWT（user_A/user_B），覆盖 Route → 认证中间件 → Controller → Model → SQL 完整调用链。

```
node --test server/tests/p0-2b-identity-forgery.test.js   (Node v24.14.0)
✔ T01 A 登录提交自己的用户记忆 → 成功且归属 A
✔ T02 A 登录但 body.userId=user_B → 服务端仍只识别 A
✔ T03 B 登录伪造 userId=user_A → 不能污染 A 的数据（写入归属 B，A 数据零变化）
✔ T04 未登录提交 userId=user_A → 401，不写入任何记忆
✔ T05 未登录提交记忆（不带 userId）→ 401 UNAUTHORIZED
✔ T06 A 登录提交反馈 → 正确关联 A
✔ T07 A 登录但伪造 body.userId=user_B → 仍然关联 A
✔ T08 未登录提交反馈 → 保留匿名能力，记录为 anonymous，不能伪造为 A
✔ T09 其他用户数据不受影响（A/B 混合 + 伪造请求后各自数据隔离）
✔ T10 并发请求下不存在身份串用（32 并发：匿名伪造全部 401/anonymous）
ℹ tests 10 / pass 10 / fail 0
```

## 7. P0-1、P0-2 回归结果

```
node --test api/__tests__/health-handler.test.js           → tests 6  / pass 6  / fail 0
node --test server/tests/p0-2-smart-template-idor.test.js  → tests 13 / pass 13 / fail 0
```

其他验证：`node --check` 全部改动文件通过；`git diff --check` 干净。

## 8. 三份镜像一致性结果

同步后 Compare-Object 校验（server vs _server vs api/admin/server），相关文件 diff 全部为 0：
`routes/user-memory.routes.js`、`controllers/user-memory.controller.js`、`routes/feedback.routes.js`、`models/smart-template.js`。

## 9. 其他相同的 body.userId 信任问题（全仓扫描结论）

全仓 `body.userId` 扫描共 3 处，已修复 2 处，剩余 1 处：

| 位置 | 情况 | 评估 |
|---|---|---|
| `server/controllers/admin.controller.js:378` `logSkillUsage` | `userId: body.userId || req.user?.accountId || 'anonymous'`，body 优先 | **低风险残留**：路由为 `requireAuth + requireRole('admin')`（admin.routes.js:44）仅管理员可达，且只是技能使用统计；但 body 优先顺序属不良实践，建议下批改为服务端身份优先 |
| `user-memory/record` | 已修复 | ✅ |
| `feedback/submit` | 已修复 | ✅ |

## 10. 最终安全验收结论

**✅ 满足验收条件。**

1. 两个身份伪造点已彻底移除 body.userId 信任；登录身份仅来自服务端 JWT。
2. 记忆接口按业务语义改为强制登录（匿名 401），反馈接口保留匿名能力（固定 anonymous），均未破坏合法业务。
3. T01–T10（10/10）、P0-1（6/6）、P0-2（13/13）全部通过；`node --check`、`git diff --check`、三份镜像一致性全部通过。
4. Git Diff 摘要（累计）：

```
 api/admin/handler.js                         | 65 ++++----------------  ← P0-1
 server/controllers/user-memory.controller.js | 33 +++++++++-----         ← P0-2 + 本轮
 server/models/smart-template.js              | 49 +++++++++++++--------  ← P0-2
 server/routes/feedback.routes.js             |  5 ++-                    ← 本轮
 server/routes/user-memory.routes.js          |  6 ++-                    ← 本轮
 wpx-app/test-results/.last-run.json          |  6 ++-                    ← 既有未提交修改，未触碰
 6 files changed, 75 insertions(+), 89 deletions(-)
```

**遗留事项（需用户决策，本次未执行）**：① 提交并部署（生产 Vercel 旧代码仍带全部已修复漏洞）；② `admin.controller.js` logSkillUsage 的 body 优先顺序（低风险）。

本次任务到此停止，未开始 P0-3，等待下一条指令。
