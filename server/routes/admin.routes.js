/**
 * 管理后台路由
 * 所有路由均需 JWT 鉴权 + admin 角色
 */
'use strict';

const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/admin.controller');

// 用户管理
router.get('/users', requireAuth, requireRole('admin'), ctrl.listUsers);
router.get('/users/:id', requireAuth, requireRole('admin'), ctrl.getUser);
router.put('/users/:id/status', requireAuth, requireRole('admin'), ctrl.updateUserStatus);
router.delete('/users/:id', requireAuth, requireRole('admin'), ctrl.deleteUser);

// 统计
router.get('/stats/dashboard', requireAuth, requireRole('admin'), ctrl.getDashboard);
router.get('/stats/trends', requireAuth, requireRole('admin'), ctrl.getTrends);
router.get('/stats/anysearch', requireAuth, requireRole('admin'), ctrl.getAnysearchStats);

// 模型管理
// 注意：/monitor 必须在 /:id 之前注册，避免被参数路由抢走
router.get('/models/monitor', requireAuth, requireRole('admin'), ctrl.getModelMonitor);
router.get('/models', requireAuth, requireRole('admin'), ctrl.listModels);
router.post('/models', requireAuth, requireRole('admin'), ctrl.createModel);
router.put('/models/:id', requireAuth, requireRole('admin'), ctrl.updateModel);
router.delete('/models/:id', requireAuth, requireRole('admin'), ctrl.deleteModel);

// 字体管理
router.get('/fonts', requireAuth, requireRole('admin'), ctrl.listFonts);
router.post('/fonts', requireAuth, requireRole('admin'), ctrl.createFont);
router.put('/fonts/:id', requireAuth, requireRole('admin'), ctrl.updateFont);
router.put('/fonts/:id/status', requireAuth, requireRole('admin'), ctrl.updateFontStatus);
router.get('/fonts/:id/stats', requireAuth, requireRole('admin'), ctrl.getFontStats);

// Skills 管理
// 注意：/stats /top /online 等具体路径必须在 /:id 之前注册
router.get('/skills/online/list', requireAuth, requireRole('admin'), ctrl.listOnlineSkills);
router.get('/skills/online/check-updates', requireAuth, requireRole('admin'), ctrl.checkSkillUpdates);
router.get('/skills/online/:id', requireAuth, requireRole('admin'), ctrl.getOnlineSkill);
router.post('/skills/online/:id/install', requireAuth, requireRole('admin'), ctrl.installOnlineSkill);
router.get('/skills/top/usage', requireAuth, requireRole('admin'), ctrl.getTopSkillUsage);
router.post('/skills/log-usage', requireAuth, requireRole('admin'), ctrl.logSkillUsage);
router.get('/skills', requireAuth, requireRole('admin'), ctrl.listSkills);
router.post('/skills', requireAuth, requireRole('admin'), ctrl.createSkill);
router.get('/skills/:id/stats', requireAuth, requireRole('admin'), ctrl.getSkillStats);
router.put('/skills/:id', requireAuth, requireRole('admin'), ctrl.updateSkill);

// Token 管理
router.get('/token/orders', requireAuth, requireRole('admin'), ctrl.listTokenOrders);
router.post('/token/refund', requireAuth, requireRole('admin'), ctrl.refundTokenOrder);
router.get('/token/consumption', requireAuth, requireRole('admin'), ctrl.listTokenConsumptions);
router.get('/token/revenue', requireAuth, requireRole('admin'), ctrl.getTokenRevenue);

// 公告管理
router.get('/announcements', requireAuth, requireRole('admin'), ctrl.listAnnouncements);
router.get('/announcements/:id', requireAuth, requireRole('admin'), ctrl.getAnnouncement);
router.post('/announcements', requireAuth, requireRole('admin'), ctrl.createAnnouncement);
router.put('/announcements/:id', requireAuth, requireRole('admin'), ctrl.updateAnnouncement);
router.delete('/announcements/:id', requireAuth, requireRole('admin'), ctrl.deleteAnnouncement);

// 版本管理
router.get('/versions', requireAuth, requireRole('admin'), ctrl.listVersions);
router.get('/versions/:id', requireAuth, requireRole('admin'), ctrl.getVersion);
router.post('/versions', requireAuth, requireRole('admin'), ctrl.createVersion);
router.put('/versions/:id', requireAuth, requireRole('admin'), ctrl.updateVersion);
router.delete('/versions/:id', requireAuth, requireRole('admin'), ctrl.deleteVersion);

// 系统设置
router.get('/settings', requireAuth, requireRole('admin'), ctrl.getSettings);
router.put('/settings', requireAuth, requireRole('admin'), ctrl.updateSettings);

// 管理员账号
router.get('/admins', requireAuth, requireRole('admin'), ctrl.listAdmins);
router.get('/admins/:id', requireAuth, requireRole('admin'), ctrl.getAdmin);
router.post('/admins', requireAuth, requireRole('admin'), ctrl.createAdmin);
router.put('/admins/:id', requireAuth, requireRole('admin'), ctrl.updateAdmin);
router.delete('/admins/:id', requireAuth, requireRole('admin'), ctrl.deleteAdmin);

// 操作日志
// 注意：/export 必须在 /:id 之前注册（当前结构未使用 :id，但保持习惯）
router.get('/logs/export', requireAuth, requireRole('admin'), ctrl.exportLogs);
router.get('/logs', requireAuth, requireRole('admin'), ctrl.listLogs);

module.exports = router;
