# WPX 管理后台 · 初始管理员账号

## 概述

WPX 管理后台的账号体系与普通用户账号**完全隔离**。普通用户登录走 `account.proclaw.cc`，管理员账号在 WPX 后端数据库中独立管理。

## 初始超级管理员

| 字段 | 值 |
|------|-----|
| **邮箱** | `super@proclaw.cc` |
| **角色** | `super_admin`（超级管理员） |
| **状态** | `active`（启用） |
| **初始密码** | `Wpx@2026!Init` |
| **密码有效期** | 首次登录后必须立即修改 |

> ⚠️ **安全提示**
> - 上述初始密码仅用于首次部署时进入后台，部署完成后请立刻通过「系统设置 → 管理员账号 → 编辑」修改密码
> - 建议同时在 account 服务后台禁用该邮箱的普通用户注册（避免同名冲突）

## 在后端创建初始账号

如果你的后端使用 PostgreSQL，直接执行以下 SQL：

```sql
-- 密码哈希：使用 bcrypt cost=10，密码 = Wpx@2026!Init
-- 在线生成：https://bcrypt-generator.com/  或  Node.js: bcrypt.hash('Wpx@2026!Init', 10)
INSERT INTO admins (id, email, name, password_hash, role, status, created_at, updated_at)
VALUES (
  'admin-001',
  'super@proclaw.cc',
  '超级管理员',
  '$2b$10$REPLACE_WITH_BCRYPT_HASH',
  'super_admin',
  'active',
  EXTRACT(EPOCH FROM NOW()) * 1000,
  EXTRACT(EPOCH FROM NOW()) * 1000
)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    status = 'active',
    updated_at = EXTRACT(EPOCH FROM NOW()) * 1000;
```

> 若后端已有管理脚本 / CLI 工具，请优先使用官方提供的 `create-admin` 命令。

## 通过 API 创建（如后端提供 admin 接口）

```bash
curl -X POST https://api.proclaw.cc/admin/admins \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <bootstrap-token>" \
  -d '{
    "email": "super@proclaw.cc",
    "name": "超级管理员",
    "role": "super_admin",
    "password": "Wpx@2026!Init"
  }'
```

> 部分后端会通过 `BOOTSTRAP_TOKEN` 环境变量提供一次性超级管理员创建入口，请查阅后端部署文档。

## 角色权限矩阵

| 模块 | `super_admin` | `operation_admin` | `content_editor` |
|------|:---:|:---:|:---:|
| 仪表盘 | ✓ | ✓ | ✓ |
| 用户管理 | ✓ | ✓ | ✗ |
| AI 模型配置 | ✓ | ✗ | ✗ |
| 字体商店 | ✓ | ✓ | ✓ |
| Skills 管理 | ✓ | ✗ | ✓ |
| Token 与订单 | ✓ | ✓ | ✗ |
| 应用公告 | ✓ | ✓ | ✓ |
| 应用版本 | ✓ | ✓ | ✗ |
| 系统设置 | ✓ | ✗ | ✗ |
| 操作日志 | ✓ | ✗ | ✗ |
| 管理员账号 | ✓ | ✗ | ✗ |

## 首次登录后必做

1. **修改初始密码**（系统设置 → 管理员账号 → 编辑）
2. **创建团队成员账号**（不要再分享超级管理员账号）
3. **配置系统设置**（系统设置 → 系统配置）：
   - 应用名称
   - 免费 AI 次数上限
   - 最大窗口数
   - 注册开关
4. **配置 CDN 地址**（系统设置 → CDN 地址）
5. **绑定首个 AI 模型**（AI 模型配置）
6. **导入首批字体**（字体商店）
7. **上架内置 Skills**（Skills 管理）

## 安全规范

- 强制要求 8 位以上密码，包含大小写字母 + 数字 + 特殊字符
- 启用两步验证（如后端支持）
- 操作日志会记录所有管理动作（系统设置 → 操作日志）
- 离职员工：进入「系统设置 → 管理员账号」将其状态改为 `disabled`，**不要直接删除**以保留审计记录
