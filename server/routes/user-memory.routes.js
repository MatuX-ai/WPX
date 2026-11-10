/**
 * 用户记忆与智能模板路由
 */

'use strict';

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/user-memory.controller');

// 用户记忆
// P0-2 补充修复：记忆数据必须归属账户，改为强制登录；
// 旧版 optionalAuth + body.userId 兜底允许客户端伪造任意账户写入记忆。
router.post('/user-memory/record', requireAuth, ctrl.recordDocument);
router.get('/user-memory/list', requireAuth, ctrl.listMemories);
router.get('/user-memory/template-ready', requireAuth, ctrl.getTemplateReadyTypes);
router.get('/user-memory/:docType/template-prompt', requireAuth, ctrl.getTemplatePrompt);
router.get('/user-memory/:docType', requireAuth, ctrl.getMemoryByType);

// 智能模板
router.post('/smart-templates/generate', requireAuth, ctrl.generateTemplate);
router.get('/smart-templates/recommended', requireAuth, ctrl.getRecommendedTemplates);
router.get('/smart-templates/list', requireAuth, ctrl.listTemplates);
router.get('/smart-templates/:id', requireAuth, ctrl.getTemplate);
router.put('/smart-templates/:id', requireAuth, ctrl.updateTemplate);
router.post('/smart-templates/:id/use', requireAuth, ctrl.useTemplate);
router.delete('/smart-templates/:id', requireAuth, ctrl.deleteTemplate);

module.exports = router;
