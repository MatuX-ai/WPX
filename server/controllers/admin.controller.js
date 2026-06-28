/**
 * 管理后台控制器
 * - GET    /api/admin/users
 * - GET    /api/admin/users/:id
 * - PUT    /api/admin/users/:id/status
 * - DELETE /api/admin/users/:id
 * - GET    /api/admin/stats/dashboard
 * - GET    /api/admin/stats/trends
 * - GET    /api/admin/models
 * - POST   /api/admin/models
 * - PUT    /api/admin/models/:id
 * - GET    /api/admin/models/monitor
 * - GET    /api/admin/fonts
 * - POST   /api/admin/fonts
 * - PUT    /api/admin/fonts/:id
 * - PUT    /api/admin/fonts/:id/status
 * - GET    /api/admin/fonts/:id/stats
 * - GET    /api/admin/skills
 * - POST   /api/admin/skills
 * - PUT    /api/admin/skills/:id
 * - GET    /api/admin/token/orders
 * - POST   /api/admin/token/refund
 * - GET    /api/admin/token/consumption
 * - GET    /api/admin/token/revenue
 * - GET    /api/admin/announcements
 * - GET    /api/admin/announcements/:id
 * - POST   /api/admin/announcements
 * - PUT    /api/admin/announcements/:id
 * - DELETE /api/admin/announcements/:id
 * - GET    /api/admin/versions
 * - GET    /api/admin/versions/:id
 * - POST   /api/admin/versions
 * - PUT    /api/admin/versions/:id
 * - DELETE /api/admin/versions/:id
 * - GET    /api/admin/settings
 * - PUT    /api/admin/settings
 * - GET    /api/admin/admins
 * - GET    /api/admin/admins/:id
 * - POST   /api/admin/admins
 * - PUT    /api/admin/admins/:id
 * - DELETE /api/admin/admins/:id
 * - GET    /api/admin/logs
 * - GET    /api/admin/logs/export
 */
'use strict';

const asyncHandler = require('../utils/async-handler');
const { ok } = require('../utils/response');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');
const { toCSV } = require('../utils/csv');
const userModel = require('../models/user');
const statsModel = require('../models/stats');
const aiModel = require('../models/ai-model');
const fontModel = require('../models/font');
const skillModel = require('../models/skill');
const skillStatsModel = require('../models/skill-stats');
const skillHubAdapter = require('../adapters/skillhub-adapter');
const tokenModel = require('../models/token');
const announcementModel = require('../models/announcement');
const versionModel = require('../models/version');
const settingModel = require('../models/setting');
const adminUserModel = require('../models/admin-user');
const logModel = require('../models/log');

// =========================
// 用户管理
// =========================

/**
 * GET /api/admin/users
 * Query:
 *   q         搜索关键字
 *   status    active | disabled | banned
 *   page      页码
 *   pageSize  每页条数
 *   sort      created_at | updated_at | nickname | email | status
 *   order     asc | desc
 */
const listUsers = asyncHandler(async (req, res) => {
  const { q, status, page, pageSize, sort, order } = req.query;
  const data = await userModel.list({ q, status, page, pageSize, sort, order });
  return ok(res, data);
});

/**
 * GET /api/admin/users/:id
 */
const getUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError('缺少用户 id');
  const data = await userModel.detail(id);
  if (!data) throw new NotFoundError('用户不存在');
  return ok(res, data);
});

/**
 * PUT /api/admin/users/:id/status
 * Body: { status: 'active' | 'disabled' | 'banned', reason?: string }
 */
const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body || {};
  if (!id) throw new BadRequestError('缺少用户 id');
  if (!status) throw new BadRequestError('缺少 status 字段');

  const updated = await userModel.updateStatus(
    id,
    status,
    reason,
    req.user && req.user.accountId
  );
  if (!updated) throw new NotFoundError('用户不存在');
  return ok(res, { user: updated });
});

/**
 * DELETE /api/admin/users/:id
 * 注：默认硬删除 user_profiles（事件/支付记录保留以便审计）
 */
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError('缺少用户 id');
  const okDeleted = await userModel.remove(id);
  if (!okDeleted) throw new NotFoundError('用户不存在');
  return ok(res, { deleted: true, accountId: id });
});

// =========================
// 统计
// =========================

/**
 * GET /api/admin/stats/dashboard
 * 顶部卡片：DAU / 新增 / 调用 / 收入 + 累计用户
 */
const getDashboard = asyncHandler(async (req, res) => {
  const data = await statsModel.dashboard();
  return ok(res, data);
});

/**
 * GET /api/admin/stats/trends
 * Query: range = 7d | 30d
 */
const getTrends = asyncHandler(async (req, res) => {
  const range = String(req.query.range || '7d').toLowerCase();
  const days = range === '30d' ? 30 : range === '7d' ? 7 : null;
  if (days === null) throw new BadRequestError('range 仅支持 7d 或 30d');
  const data = await statsModel.trends(days);
  return ok(res, data);
});

// =========================
// 模型管理
// =========================

/**
 * GET /api/admin/models
 * Query: q / type / enabled / page / pageSize / sort / order
 */
const listModels = asyncHandler(async (req, res) => {
  const { q, type, enabled, page, pageSize, sort, order } = req.query;
  const data = await aiModel.list({ q, type, enabled, page, pageSize, sort, order });
  return ok(res, data);
});

/**
 * POST /api/admin/models
 * Body: { id, name, code, provider, type, enabled?, rateLimit?, config?, description? }
 */
const createModel = asyncHandler(async (req, res) => {
  const body = req.body || {};
  try {
    const created = await aiModel.create(body);
    return ok(res, { model: created });
  } catch (err) {
    // 主键/唯一约束冲突转 409
    if (err && err.code === '23505') {
      throw new ConflictError('模型 id 或 code 已存在');
    }
    throw err;
  }
});

/**
 * PUT /api/admin/models/:id
 * Body: 部分字段（name / code / provider / type / enabled / rateLimit / config / description）
 */
const updateModel = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError('缺少模型 id');
  try {
    const updated = await aiModel.update(id, req.body || {});
    if (!updated) throw new NotFoundError('模型不存在');
    return ok(res, { model: updated });
  } catch (err) {
    if (err && err.code === '23505') {
      throw new ConflictError('code 与其他模型重复');
    }
    throw err;
  }
});

/**
 * DELETE /api/admin/models/:id
 */
const deleteModel = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError('缺少模型 id');
  const deleted = await aiModel.remove(id);
  if (!deleted) throw new NotFoundError('模型不存在');
  return ok(res, { deleted: true });
});

/**
 * GET /api/admin/models/monitor
 * Query: window=1h|24h|7d（默认 24h）, groupBy=model|kind|status（默认 model）
 */
const getModelMonitor = asyncHandler(async (req, res) => {
  const win = String(req.query.window || '24h');
  const groupBy = String(req.query.groupBy || 'model');
  const data = await aiModel.monitor({ window: win, groupBy });
  return ok(res, data);
});

// =========================
// 字体管理
// =========================

/**
 * GET /api/admin/fonts
 * Query: q / status / category / page / pageSize / sort / order
 */
const listFonts = asyncHandler(async (req, res) => {
  const { q, status, category, page, pageSize, sort, order } = req.query;
  const data = await fontModel.list({ q, status, category, page, pageSize, sort, order });
  return ok(res, data);
});

/**
 * POST /api/admin/fonts
 * Body: { id, name, family, url, format?, category?, license?, fileSize?, status?, tags?, meta? }
 */
const createFont = asyncHandler(async (req, res) => {
  const body = req.body || {};
  try {
    const created = await fontModel.create(body);
    return ok(res, { font: created });
  } catch (err) {
    if (err && err.code === '23505') {
      throw new ConflictError('字体 id 已存在');
    }
    throw err;
  }
});

/**
 * PUT /api/admin/fonts/:id
 */
const updateFont = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError('缺少字体 id');
  const updated = await fontModel.update(id, req.body || {});
  if (!updated) throw new NotFoundError('字体不存在');
  return ok(res, { font: updated });
});

/**
 * PUT /api/admin/fonts/:id/status
 * Body: { status: 'active' | 'inactive' | 'reviewing' }
 */
const updateFontStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!id) throw new BadRequestError('缺少字体 id');
  if (!status) throw new BadRequestError('缺少 status 字段');
  const updated = await fontModel.updateStatus(id, status);
  if (!updated) throw new NotFoundError('字体不存在');
  return ok(res, { font: updated });
});

/**
 * GET /api/admin/fonts/:id/stats
 * Query: window=1h|24h|7d|30d（默认 7d）, kind=preview|download|apply|embed（可选）
 */
const getFontStats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError('缺少字体 id');
  const win = String(req.query.window || '7d');
  const kind = req.query.kind ? String(req.query.kind) : undefined;
  const data = await fontModel.stats(id, { window: win, kind });
  if (!data) throw new NotFoundError('字体不存在');
  return ok(res, data);
});

// =========================
// Skills 管理
// =========================

/**
 * GET /api/admin/skills
 * Query: q / category / enabled / page / pageSize / sort / order
 */
const listSkills = asyncHandler(async (req, res) => {
  const { q, category, enabled, page, pageSize, sort, order } = req.query;
  const data = await skillModel.list({ q, category, enabled, page, pageSize, sort, order });
  return ok(res, data);
});

/**
 * POST /api/admin/skills
 * Body: { id, name, code, category?, description?, systemPrompt?, enabled?, builtin?, tags?, config?, meta? }
 */
const createSkill = asyncHandler(async (req, res) => {
  try {
    const created = await skillModel.create(req.body || {});
    return ok(res, { skill: created });
  } catch (err) {
    if (err && err.code === '23505') {
      throw new ConflictError('技能 id 或 code 已存在');
    }
    throw err;
  }
});

/**
 * PUT /api/admin/skills/:id
 */
const updateSkill = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError('缺少技能 id');
  try {
    const updated = await skillModel.update(id, req.body || {});
    if (!updated) throw new NotFoundError('技能不存在');
    return ok(res, { skill: updated });
  } catch (err) {
    if (err && err.code === '23505') {
      throw new ConflictError('code 与其他技能重复');
    }
    throw err;
  }
});

/**
 * GET /api/admin/skills/:id/stats
 * 获取单个技能的调用统计
 */
const getSkillStats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError('缺少技能 id');
  const days = parseInt(req.query.days || '30', 10);
  const data = await skillStatsModel.getSkillStats(id, { days });
  return ok(res, data);
});

/**
 * GET /api/admin/skills/top/usage
 * 获取使用排行（Top N），用于仪表盘
 * Query: days=1&limit=10
 */
const getTopSkillUsage = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days || '1', 10);
  const limit = parseInt(req.query.limit || '10', 10);
  const data = await skillStatsModel.getTopSkills({ days, limit });
  return ok(res, data);
});

/**
 * POST /api/admin/skills/log-usage
 * Body: { skillId, userId, context?, durationMs?, success? }
 * 记录技能调用（由前端/AI Router 在技能执行后调用）
 */
const logSkillUsage = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.skillId) throw new BadRequestError('缺少 skillId');
  await skillStatsModel.logUsage({
    skillId: body.skillId,
    userId: body.userId || req.user?.accountId || 'anonymous',
    context: body.context,
    durationMs: body.durationMs,
    success: body.success !== false
  });
  return ok(res, { logged: true });
});

// =========================
// SkillHub 在线 Skills
// =========================

/**
 * GET /api/admin/skills/online/list
 * 浏览在线 Skills（从 skillhub.prowpx.com 代理）
 */
const listOnlineSkills = asyncHandler(async (req, res) => {
  const { q, category, page, pageSize, sort } = req.query;
  const data = await skillHubAdapter.listOnlineSkills({ q, category, page, pageSize, sort });
  if (!data) {
    return ok(res, { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  }
  return ok(res, data);
});

/**
 * GET /api/admin/skills/online/:id
 * 获取在线 Skill 详情
 */
const getOnlineSkill = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await skillHubAdapter.getOnlineSkillDetail(id);
  if (!data) throw new NotFoundError('在线 Skill 不存在或不可用');
  return ok(res, data);
});

/**
 * POST /api/admin/skills/online/:id/install
 * 从 SkillHub 下载并安装在线 Skill
 */
const installOnlineSkill = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const config = await skillHubAdapter.getSkillInstallConfig(id);
  if (!config) throw new BadRequestError('无法获取 Skill 安装配置，请检查 SkillHub 是否可用');

  // 检查是否已安装（同 code）
  const existing = await skillModel.findById(config.code || id);
  if (existing) {
    // 已安装：更新
    const updated = await skillModel.update(existing.id, {
      name: config.name,
      description: config.description,
      systemPrompt: config.systemPrompt,
      config: config.config,
      tags: config.tags,
      enabled: true
    });
    return ok(res, { skill: updated, action: 'updated' });
  }

  // 新安装
  const created = await skillModel.create({
    id: config.code || `online-${id}`,
    name: config.name,
    code: config.code || id,
    category: config.category || 'general',
    description: config.description,
    systemPrompt: config.systemPrompt,
    enabled: true,
    builtin: false,
    tags: config.tags || [],
    config: config.config || {},
    meta: { source: 'skillhub', skillhubId: id, installedAt: new Date().toISOString() }
  });
  return ok(res, { skill: created, action: 'installed' });
});

/**
 * GET /api/admin/skills/online/check-updates
 * 检测已安装在线 Skills 的更新
 */
const checkSkillUpdates = asyncHandler(async (req, res) => {
  // 获取所有在线安装的 skills (meta.source === 'skillhub')
  const params = { page: 1, pageSize: 200 };
  const localSkills = await skillModel.list(params);
  const onlineSkills = (localSkills.items || []).filter(
    s => s.meta && s.meta.source === 'skillhub'
  );
  const updates = await skillHubAdapter.checkUpdates(
    onlineSkills.map(s => ({ id: s.meta.skillhubId || s.code, version: s.meta.version }))
  );
  return ok(res, { updates });
});

// =========================
// Token 管理（充值 / 消费 / 收入）
// =========================

/**
 * GET /api/admin/token/orders
 * Query: q / status / payMethod / start / end / page / pageSize / sort / order
 */
const listTokenOrders = asyncHandler(async (req, res) => {
  const { q, status, payMethod, start, end, page, pageSize, sort, order } = req.query;
  const data = await tokenModel.listOrders({
    q, status, payMethod, start, end, page, pageSize, sort, order
  });
  return ok(res, data);
});

/**
 * POST /api/admin/token/refund
 * Body: { orderNo, amountCents?, reason? }
 */
const refundTokenOrder = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const updated = await tokenModel.refund(body);
  return ok(res, { order: updated });
});

/**
 * GET /api/admin/token/consumption
 * Query: q / kind / start / end / page / pageSize / sort / order
 */
const listTokenConsumptions = asyncHandler(async (req, res) => {
  const { q, kind, start, end, page, pageSize, sort, order } = req.query;
  const data = await tokenModel.listConsumptions({
    q, kind, start, end, page, pageSize, sort, order
  });
  return ok(res, data);
});

/**
 * GET /api/admin/token/revenue
 * 返回今日 / 本周 / 本月 / 累计 + 按包分布 + 30 天趋势
 */
const getTokenRevenue = asyncHandler(async (req, res) => {
  const data = await tokenModel.revenue();
  return ok(res, data);
});

// =========================
// 公告管理
// =========================

/**
 * GET /api/admin/announcements
 */
const listAnnouncements = asyncHandler(async (req, res) => {
  const { q, status, page, pageSize, sort, order } = req.query;
  const data = await announcementModel.list({ q, status, page, pageSize, sort, order });
  return ok(res, data);
});

/**
 * GET /api/admin/announcements/:id
 */
const getAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const item = await announcementModel.findById(id);
  if (!item) throw new NotFoundError('公告不存在');
  return ok(res, { announcement: item });
});

/**
 * POST /api/admin/announcements
 * Body: { title, bodyMd, status?, pinned?, startAt?, endAt?, meta? }
 */
const createAnnouncement = asyncHandler(async (req, res) => {
  const created = await announcementModel.create(req.body || {});
  return ok(res, { announcement: created });
});

/**
 * PUT /api/admin/announcements/:id
 */
const updateAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError('缺少公告 id');
  const updated = await announcementModel.update(id, req.body || {});
  if (!updated) throw new NotFoundError('公告不存在');
  return ok(res, { announcement: updated });
});

/**
 * DELETE /api/admin/announcements/:id
 */
const deleteAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError('缺少公告 id');
  const okDeleted = await announcementModel.remove(id);
  if (!okDeleted) throw new NotFoundError('公告不存在');
  return ok(res, { deleted: true, id });
});

// =========================
// 版本管理
// =========================

/**
 * GET /api/admin/versions
 */
const listVersions = asyncHandler(async (req, res) => {
  const { q, channel, page, pageSize, sort, order } = req.query;
  const data = await versionModel.list({ q, channel, page, pageSize, sort, order });
  return ok(res, data);
});

/**
 * GET /api/admin/versions/:id
 */
const getVersion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const item = await versionModel.findById(id);
  if (!item) throw new NotFoundError('版本不存在');
  return ok(res, { version: item });
});

/**
 * POST /api/admin/versions
 * Body: { version, channel?, releaseNotes?, downloads?, forceUpdate?, minSupportedVersion?, publishedAt? }
 */
const createVersion = asyncHandler(async (req, res) => {
  try {
    const created = await versionModel.create(req.body || {});
    return ok(res, { version: created });
  } catch (err) {
    if (err && err.code === '23505') {
      throw new ConflictError('版本号已存在');
    }
    throw err;
  }
});

/**
 * PUT /api/admin/versions/:id
 */
const updateVersion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError('缺少版本 id');
  try {
    const updated = await versionModel.update(id, req.body || {});
    if (!updated) throw new NotFoundError('版本不存在');
    return ok(res, { version: updated });
  } catch (err) {
    if (err && err.code === '23505') {
      throw new ConflictError('版本号与其他版本重复');
    }
    throw err;
  }
});

/**
 * DELETE /api/admin/versions/:id
 */
const deleteVersion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError('缺少版本 id');
  const okDeleted = await versionModel.remove(id);
  if (!okDeleted) throw new NotFoundError('版本不存在');
  return ok(res, { deleted: true, id });
});

// =========================
// 系统设置
// =========================

/**
 * GET /api/admin/settings
 * Query: q / category / page / pageSize
 */
const getSettings = asyncHandler(async (req, res) => {
  const { q, category, page, pageSize } = req.query;
  const data = await settingModel.list({ q, category, page, pageSize });
  return ok(res, data);
});

/**
 * PUT /api/admin/settings
 * Body: { items: [{ key, value, category?, description?, isPublic? }, ...] }
 */
const updateSettings = asyncHandler(async (req, res) => {
  const items = (req.body && req.body.items) || [];
  const updatedBy = req.user && req.user.accountId;
  const result = await settingModel.upsertMany(items, updatedBy);
  return ok(res, { items: result, count: result.length });
});

// =========================
// 管理员账号
// =========================

/**
 * GET /api/admin/admins
 * Query: q / role / status / page / pageSize / sort / order
 */
const listAdmins = asyncHandler(async (req, res) => {
  const { q, role, status, page, pageSize, sort, order } = req.query;
  const data = await adminUserModel.list({ q, role, status, page, pageSize, sort, order });
  return ok(res, data);
});

/**
 * GET /api/admin/admins/:id
 */
const getAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError('缺少管理员 id');
  const item = await adminUserModel.findById(id);
  if (!item) throw new NotFoundError('管理员不存在');
  return ok(res, { admin: item });
});

/**
 * POST /api/admin/admins
 * Body: { accountId, email?, nickname?, role?, status?, meta? }
 */
const createAdmin = asyncHandler(async (req, res) => {
  try {
    const created = await adminUserModel.create(req.body || {});
    return ok(res, { admin: created });
  } catch (err) {
    if (err && err.code === '23505') {
      throw new ConflictError('该 accountId 已是管理员');
    }
    throw err;
  }
});

/**
 * PUT /api/admin/admins/:id
 * Body: { email?, nickname?, role?, status?, meta? }
 */
const updateAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError('缺少管理员 id');
  const updated = await adminUserModel.update(id, req.body || {});
  if (!updated) throw new NotFoundError('管理员不存在');
  return ok(res, { admin: updated });
});

/**
 * DELETE /api/admin/admins/:id
 */
const deleteAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError('缺少管理员 id');
  const current = req.user && req.user.accountId;
  const okDeleted = await adminUserModel.remove(id, current);
  if (!okDeleted) throw new NotFoundError('管理员不存在');
  return ok(res, { deleted: true, id });
});

// =========================
// 操作日志
// =========================

/**
 * GET /api/admin/logs
 * Query: q / action / accountId / resourceType / resourceId /
 *        status / start / end / page / pageSize / sort / order
 */
const listLogs = asyncHandler(async (req, res) => {
  const {
    q, action, accountId, resourceType, resourceId,
    status, start, end, page, pageSize, sort, order
  } = req.query;
  const data = await logModel.list({
    q, action, accountId, resourceType, resourceId,
    status, start, end, page, pageSize, sort, order
  });
  return ok(res, data);
});

/**
 * GET /api/admin/logs/export
 * Query: 同 listLogs + limit（默认 10000，最大 50000）
 * 返回 text/csv；文件名 operation-logs-YYYYMMDD-HHmmss.csv
 */
const exportLogs = asyncHandler(async (req, res) => {
  const {
    q, action, accountId, resourceType, resourceId,
    status, start, end, limit
  } = req.query;
  const rows = await logModel.exportRows(
    { q, action, accountId, resourceType, resourceId, status, start, end },
    limit
  );
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'created_at', header: 'Created At' },
    { key: 'account_id', header: 'Account' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role' },
    { key: 'action', header: 'Action' },
    { key: 'resource_type', header: 'Resource Type' },
    { key: 'resource_id', header: 'Resource ID' },
    { key: 'method', header: 'Method' },
    { key: 'path', header: 'Path' },
    { key: 'status_code', header: 'Status' },
    { key: 'ip', header: 'IP' },
    { key: 'duration_ms', header: 'Duration (ms)' }
  ];
  const csv = toCSV(rows, columns);
  // 加 BOM 让 Excel 正确识别 UTF-8
  const buf = Buffer.concat([Buffer.from('\ufeff', 'utf8'), Buffer.from(csv, 'utf8')]);

  const ts = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fname = `operation-logs-${ts.getUTCFullYear()}${pad(ts.getUTCMonth() + 1)}${pad(ts.getUTCDate())}-${pad(ts.getUTCHours())}${pad(ts.getUTCMinutes())}${pad(ts.getUTCSeconds())}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.setHeader('X-Total-Count', String(rows.length));
  return res.status(200).send(buf);
});

// =========================
// AnySearch 统计
// =========================

const anysearchAdapter = require('../adapters/anysearch-adapter');

/**
 * GET /api/admin/stats/anysearch
 * 返回 AnySearch 调用统计
 */
const getAnysearchStats = asyncHandler(async (req, res) => {
  const stats = anysearchAdapter.getStats();
  return ok(res, {
    todayCalls: stats.todayCalls,
    todayLimit: stats.dailyLimit,
    remaining: Math.max(0, stats.dailyLimit - stats.todayCalls),
    totalCalls: stats.totalCalls,
    userKeyCalls: stats.userKeyCalls || 0,
    platformKeyCalls: stats.platformKeyCalls || 0,
    cacheHits: stats.cacheHits || 0,
    degradedCount: stats.degradedCount || 0,
    dailyHistory: stats.dailyHistory || [],
    domainDistribution: stats.domainDistribution || {}
  });
});

module.exports = {
  listUsers,
  getUser,
  updateUserStatus,
  deleteUser,
  getDashboard,
  getTrends,
  listModels,
  createModel,
  updateModel,
  deleteModel,
  getModelMonitor,
  listFonts,
  createFont,
  updateFont,
  updateFontStatus,
  getFontStats,
  listSkills,
  createSkill,
  updateSkill,
  getSkillStats,
  getTopSkillUsage,
  logSkillUsage,
  listOnlineSkills,
  getOnlineSkill,
  installOnlineSkill,
  checkSkillUpdates,
  listTokenOrders,
  refundTokenOrder,
  listTokenConsumptions,
  getTokenRevenue,
  listAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  listVersions,
  getVersion,
  createVersion,
  updateVersion,
  deleteVersion,
  getSettings,
  updateSettings,
  listAdmins,
  getAdmin,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  listLogs,
  exportLogs,
  getAnysearchStats
};
