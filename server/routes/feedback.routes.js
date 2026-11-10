/**
 * 用户反馈路由
 *
 * POST   /api/feedback/submit       — 用户提交反馈（公开，可选 auth）
 * GET    /api/admin/feedbacks       — 管理员查看反馈列表
 * GET    /api/admin/feedbacks/stats — 管理员查看反馈统计
 * GET    /api/admin/feedbacks/:id   — 管理员查看反馈详情
 * PUT    /api/admin/feedbacks/:id   — 管理员更新反馈状态
 */
'use strict';

const router = require('express').Router();
const { requireAuth, requireRole, optionalAuth } = require('../middleware/auth');
const feedbackModel = require('../models/feedback');
const asyncHandler = require('../utils/async-handler');
const { ok } = require('../utils/response');
const { BadRequestError, NotFoundError } = require('../utils/errors');

// =========================
// 公开 API：用户提交反馈
// =========================

/**
 * POST /api/feedback/submit
 * Body: { category?, title, content, contact?, appVersion?, os? }
 * P0-2 补充修复：保留匿名反馈能力，但 userId 只取自服务端身份；
 * 未登录用户一律记录为 'anonymous'，客户端提交的 body.userId 不再被采信
 * （旧逻辑 body.userId 兜底允许匿名请求伪造任意账户提交反馈）。
 */
router.post('/submit', optionalAuth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.content || String(body.content).trim().length === 0) {
    throw new BadRequestError('反馈内容不能为空');
  }

  const feedback = await feedbackModel.submit({
    userId: req.user?.accountId || 'anonymous',
    category: body.category || 'general',
    title: body.title || '',
    content: body.content,
    contact: body.contact || '',
    appVersion: body.appVersion || '',
    os: body.os || '',
  });

  return ok(res, feedback);
}));

// =========================
// 管理员 API：反馈管理
// =========================

/**
 * GET /admin/feedbacks?status=pending&category=bug&page=1&pageSize=20
 */
router.get('/admin/feedbacks', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const { status, category, page, pageSize } = req.query;
  const result = await feedbackModel.list({ status, category, page, pageSize });
  return ok(res, result);
}));

/**
 * GET /admin/feedbacks/stats
 */
router.get('/admin/feedbacks/stats', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await feedbackModel.stats();
  return ok(res, result);
}));

/**
 * GET /admin/feedbacks/:id
 */
router.get('/admin/feedbacks/:id', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const feedback = await feedbackModel.getById(req.params.id);
  return ok(res, feedback);
}));

/**
 * PUT /admin/feedbacks/:id
 * Body: { status?, adminNote? }
 */
router.put('/admin/feedbacks/:id', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await feedbackModel.updateStatus(req.params.id, req.body || {});
  return ok(res, result);
}));

module.exports = router;
