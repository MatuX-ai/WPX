-- WPX 后端 - 数据库初始化脚本
-- 执行: psql -U postgres -d wpx -f sql/init.sql

-- =========================
-- 用户本地画像
-- =========================
CREATE TABLE IF NOT EXISTS user_profiles (
  account_id   TEXT PRIMARY KEY,
  nickname     TEXT,
  avatar       TEXT,
  email        TEXT,
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'disabled', 'banned')),
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email   ON user_profiles (email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status  ON user_profiles (status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created ON user_profiles (created_at);

-- =========================
-- 使用/调用事件（DAU、调用量）
-- kind: 'ai_chat' | 'ai_layout' | 'export' | 'login' | ...
-- =========================
CREATE TABLE IF NOT EXISTS usage_events (
  id           BIGSERIAL PRIMARY KEY,
  account_id   TEXT NOT NULL,
  kind         TEXT NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1,
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_account  ON usage_events (account_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_kind     ON usage_events (kind);
CREATE INDEX IF NOT EXISTS idx_usage_events_created  ON usage_events (created_at);

-- =========================
-- 支付/收入事件
-- =========================
CREATE TABLE IF NOT EXISTS payments (
  id             BIGSERIAL PRIMARY KEY,
  account_id     TEXT NOT NULL,
  amount_cents   BIGINT NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'CNY',
  status         TEXT NOT NULL DEFAULT 'paid'
                 CHECK (status IN ('paid', 'refunded', 'pending', 'failed')),
  product        TEXT,
  meta           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_account  ON payments (account_id);
CREATE INDEX IF NOT EXISTS idx_payments_status   ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_created  ON payments (created_at);

-- =========================
-- AI 模型配置
-- =========================
CREATE TABLE IF NOT EXISTS ai_models (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  code           TEXT NOT NULL UNIQUE,
  provider       TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'chat'
                 CHECK (type IN ('chat', 'embedding', 'image', 'layout', 'rerank')),
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  rate_limit     INTEGER NOT NULL DEFAULT 60,        -- 每分钟请求数
  config         JSONB NOT NULL DEFAULT '{}'::jsonb,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models (provider);
CREATE INDEX IF NOT EXISTS idx_ai_models_type     ON ai_models (type);
CREATE INDEX IF NOT EXISTS idx_ai_models_enabled  ON ai_models (enabled);

-- =========================
-- AI 模型调用日志（监控）
-- =========================
CREATE TABLE IF NOT EXISTS model_call_logs (
  id                BIGSERIAL PRIMARY KEY,
  model_id          TEXT,
  account_id        TEXT NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'chat',
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms        INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'success'
                    CHECK (status IN ('success', 'failed', 'timeout')),
  error_code        TEXT,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mc_logs_model    ON model_call_logs (model_id);
CREATE INDEX IF NOT EXISTS idx_mc_logs_account  ON model_call_logs (account_id);
CREATE INDEX IF NOT EXISTS idx_mc_logs_status   ON model_call_logs (status);
CREATE INDEX IF NOT EXISTS idx_mc_logs_created  ON model_call_logs (created_at);

-- =========================
-- 字体库
-- =========================
CREATE TABLE IF NOT EXISTS fonts (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,            -- 展示名
  family       TEXT NOT NULL,            -- CSS font-family
  url          TEXT NOT NULL,
  format       TEXT NOT NULL DEFAULT 'woff2'
               CHECK (format IN ('woff2', 'woff', 'ttf', 'otf', 'eot')),
  category     TEXT NOT NULL DEFAULT 'chinese'
               CHECK (category IN ('chinese', 'english', 'mono', 'display', 'handwriting')),
  license      TEXT,
  file_size    BIGINT,
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'inactive', 'reviewing')),
  tags         TEXT[] NOT NULL DEFAULT '{}',
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fonts_status   ON fonts (status);
CREATE INDEX IF NOT EXISTS idx_fonts_category ON fonts (category);
CREATE INDEX IF NOT EXISTS idx_fonts_family   ON fonts (family);

-- =========================
-- 字体使用日志（统计）
-- kind: 'preview' | 'download' | 'apply' | 'embed'
-- =========================
CREATE TABLE IF NOT EXISTS font_usage_logs (
  id          BIGSERIAL PRIMARY KEY,
  font_id     TEXT NOT NULL,
  account_id  TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'preview',
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_font_usage_font    ON font_usage_logs (font_id);
CREATE INDEX IF NOT EXISTS idx_font_usage_account ON font_usage_logs (account_id);
CREATE INDEX IF NOT EXISTS idx_font_usage_created ON font_usage_logs (created_at);

-- =========================
-- 更新时间触发器
-- =========================
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_profiles_set_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_set_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS ai_models_set_updated_at ON ai_models;
CREATE TRIGGER ai_models_set_updated_at
BEFORE UPDATE ON ai_models
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS fonts_set_updated_at ON fonts;
CREATE TRIGGER fonts_set_updated_at
BEFORE UPDATE ON fonts
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

-- =========================
-- Skills（技能库）
-- category: 'student' | 'teacher' | 'general'
-- builtin : true 表示内置不可删
-- =========================
CREATE TABLE IF NOT EXISTS skills (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  code            TEXT NOT NULL UNIQUE,
  category        TEXT NOT NULL DEFAULT 'general'
                  CHECK (category IN ('student', 'teacher', 'general')),
  description     TEXT,
  system_prompt   TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  builtin         BOOLEAN NOT NULL DEFAULT FALSE,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills (category);
CREATE INDEX IF NOT EXISTS idx_skills_enabled  ON skills (enabled);

-- =========================
-- 充值订单
-- status: 'pending' | 'paid' | 'refunded' | 'failed' | 'cancelled'
-- =========================
CREATE TABLE IF NOT EXISTS token_orders (
  id                  BIGSERIAL PRIMARY KEY,
  order_no            TEXT NOT NULL UNIQUE,
  account_id          TEXT NOT NULL,
  email               TEXT,
  package             TEXT,
  amount_cents        BIGINT NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'CNY',
  pay_method          TEXT NOT NULL DEFAULT 'alipay'
                      CHECK (pay_method IN ('alipay', 'wechat', 'stripe', 'paypal', 'manual')),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'refunded', 'failed', 'cancelled')),
  paid_at             TIMESTAMPTZ,
  refunded_at         TIMESTAMPTZ,
  refund_amount_cents BIGINT NOT NULL DEFAULT 0,
  refund_reason       TEXT,
  meta                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_orders_account  ON token_orders (account_id);
CREATE INDEX IF NOT EXISTS idx_token_orders_email    ON token_orders (email);
CREATE INDEX IF NOT EXISTS idx_token_orders_status   ON token_orders (status);
CREATE INDEX IF NOT EXISTS idx_token_orders_pmethod  ON token_orders (pay_method);
CREATE INDEX IF NOT EXISTS idx_token_orders_created  ON token_orders (created_at);

-- =========================
-- 消费记录（字数 / Token 消耗）
-- kind: 'ai_chat' | 'ai_layout' | 'font_apply' | 'export' | ...
-- =========================
CREATE TABLE IF NOT EXISTS token_consumptions (
  id            BIGSERIAL PRIMARY KEY,
  account_id    TEXT NOT NULL,
  email         TEXT,
  kind          TEXT NOT NULL,
  target_id     TEXT,
  target_name   TEXT,
  quantity      INTEGER NOT NULL DEFAULT 0,
  tokens        INTEGER NOT NULL DEFAULT 0,
  amount_cents  BIGINT NOT NULL DEFAULT 0,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_consump_account  ON token_consumptions (account_id);
CREATE INDEX IF NOT EXISTS idx_token_consump_kind     ON token_consumptions (kind);
CREATE INDEX IF NOT EXISTS idx_token_consump_target   ON token_consumptions (target_id);
CREATE INDEX IF NOT EXISTS idx_token_consump_created  ON token_consumptions (created_at);

-- =========================
-- 公告
-- status: 'draft' | 'pending' | 'active' | 'expired' | 'offline'
-- =========================
CREATE TABLE IF NOT EXISTS announcements (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  body_md     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft', 'pending', 'active', 'expired', 'offline')),
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  start_at    TIMESTAMPTZ,
  end_at      TIMESTAMPTZ,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_status  ON announcements (status);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned  ON announcements (pinned);
CREATE INDEX IF NOT EXISTS idx_announcements_start   ON announcements (start_at);

-- =========================
-- 版本管理
-- channel: 'stable' | 'beta' | 'alpha'
-- downloads: { windows: {url,sha256,size}, macos: {...}, linux: {...} }
-- =========================
CREATE TABLE IF NOT EXISTS versions (
  id                     BIGSERIAL PRIMARY KEY,
  version                TEXT NOT NULL UNIQUE,
  channel                TEXT NOT NULL DEFAULT 'stable'
                         CHECK (channel IN ('stable', 'beta', 'alpha')),
  release_notes          TEXT,
  downloads              JSONB NOT NULL DEFAULT '{}'::jsonb,
  force_update           BOOLEAN NOT NULL DEFAULT FALSE,
  min_supported_version  TEXT,
  published_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_versions_channel ON versions (channel);
CREATE INDEX IF NOT EXISTS idx_versions_pubdate ON versions (published_at);

-- =========================
-- 触发器：同步 updated_at
-- =========================
DROP TRIGGER IF EXISTS skills_set_updated_at ON skills;
CREATE TRIGGER skills_set_updated_at
BEFORE UPDATE ON skills
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS token_orders_set_updated_at ON token_orders;
CREATE TRIGGER token_orders_set_updated_at
BEFORE UPDATE ON token_orders
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS announcements_set_updated_at ON announcements;
CREATE TRIGGER announcements_set_updated_at
BEFORE UPDATE ON announcements
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS versions_set_updated_at ON versions;
CREATE TRIGGER versions_set_updated_at
BEFORE UPDATE ON versions
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

-- =========================
-- 系统设置（KV）
-- category: 'general' | 'payment' | 'ai' | 'security' | 'feature' | ...
-- value:    JSONB
-- =========================
CREATE TABLE IF NOT EXISTS system_settings (
  key          TEXT PRIMARY KEY,
  value        JSONB NOT NULL DEFAULT '{}'::jsonb,
  category     TEXT NOT NULL DEFAULT 'general',
  description  TEXT,
  is_public    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_category ON system_settings (category);

-- =========================
-- 管理员账号（不同于普通用户）
-- role:   'super' | 'ops' | 'editor'
-- status: 'active' | 'disabled'
-- =========================
CREATE TABLE IF NOT EXISTS admin_users (
  id            BIGSERIAL PRIMARY KEY,
  account_id    TEXT NOT NULL UNIQUE,
  email         TEXT,
  nickname      TEXT,
  role          TEXT NOT NULL DEFAULT 'ops'
                CHECK (role IN ('super', 'ops', 'editor')),
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'disabled')),
  last_login_at TIMESTAMPTZ,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email  ON admin_users (email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role   ON admin_users (role);
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users (status);

-- =========================
-- 操作日志
-- action: 'user.disable' / 'skill.create' / 'token.refund' / 'setting.update' / ...
-- =========================
CREATE TABLE IF NOT EXISTS operation_logs (
  id            BIGSERIAL PRIMARY KEY,
  account_id    TEXT NOT NULL,
  email         TEXT,
  role          TEXT,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  method        TEXT,
  path          TEXT,
  status_code   INTEGER,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip            TEXT,
  ua            TEXT,
  duration_ms   INTEGER NOT NULL DEFAULT 0,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_logs_account   ON operation_logs (account_id);
CREATE INDEX IF NOT EXISTS idx_op_logs_action    ON operation_logs (action);
CREATE INDEX IF NOT EXISTS idx_op_logs_resource  ON operation_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_op_logs_status    ON operation_logs (status_code);
CREATE INDEX IF NOT EXISTS idx_op_logs_created   ON operation_logs (created_at);

-- =========================
-- 触发器：同步 updated_at
-- =========================
DROP TRIGGER IF EXISTS settings_set_updated_at ON system_settings;
CREATE TRIGGER settings_set_updated_at
BEFORE UPDATE ON system_settings
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS admin_users_set_updated_at ON admin_users;
CREATE TRIGGER admin_users_set_updated_at
BEFORE UPDATE ON admin_users
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();
