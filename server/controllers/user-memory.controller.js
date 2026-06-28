/**
 * 用户记忆与智能模板控制器
 *
 * 提供以下 API：
 *   - 记录文档写入 → 自动更新记忆
 *   - 获取用户记忆列表
 *   - 获取智能模板（推荐/列表/详情）
 *   - 触发模板自动生成
 *   - 模板 CRUD
 */

'use strict';

const asyncHandler = require('../utils/async-handler');
const { ok } = require('../utils/response');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const userMemoryModel = require('../models/user-memory');
const smartTemplateModel = require('../models/smart-template');

// =========================
// 用户记忆
// =========================

/**
 * POST /api/user-memory/record
 * Body: { docType, docId?, content? }
 * 记录一篇文档写入，自动分析并更新用户记忆
 */
const recordDocument = asyncHandler(async (req, res) => {
  const userId = req.user?.accountId || req.body.userId;
  if (!userId) throw new BadRequestError('缺少用户标识');

  const { docType, docId, content } = req.body || {};
  if (!docType) throw new BadRequestError('缺少 docType');

  const memory = await userMemoryModel.recordDocument({
    userId, docType, docId, content
  });

  // 检查是否应该自动生成模板
  if (memory && memory.shouldGenerateTemplate) {
    const promptData = await userMemoryModel.buildTemplatePrompt(userId, docType);
    return ok(res, {
      memory,
      templateReady: true,
      templatePrompt: promptData
    });
  }

  return ok(res, { memory, templateReady: false });
});

/**
 * GET /api/user-memory/list
 * 获取用户所有文档类型的记忆列表
 */
const listMemories = asyncHandler(async (req, res) => {
  const userId = req.user?.accountId;
  if (!userId) throw new BadRequestError('缺少用户标识');
  const memories = await userMemoryModel.getAllMemories(userId);
  return ok(res, { items: memories });
});

/**
 * GET /api/user-memory/:docType
 * 获取某类文档的记忆
 */
const getMemoryByType = asyncHandler(async (req, res) => {
  const userId = req.user?.accountId;
  if (!userId) throw new BadRequestError('缺少用户标识');
  const { docType } = req.params;
  const memory = await userMemoryModel.getMemory(userId, docType);
  if (!memory) throw new NotFoundError('未找到该文档类型的记忆');
  return ok(res, memory);
});

/**
 * GET /api/user-memory/:docType/template-prompt
 * 获取某类文档的模板提示词（用于 AI 生成模板）
 */
const getTemplatePrompt = asyncHandler(async (req, res) => {
  const userId = req.user?.accountId;
  if (!userId) throw new BadRequestError('缺少用户标识');
  const { docType } = req.params;
  const prompt = await userMemoryModel.buildTemplatePrompt(userId, docType);
  if (!prompt) {
    throw new BadRequestError(
      `需要至少 ${userMemoryModel.MIN_DOCS_FOR_TEMPLATE} 篇同类型文档才能生成模板`
    );
  }
  return ok(res, prompt);
});

/**
 * GET /api/user-memory/template-ready
 * 获取可以生成模板的文档类型列表
 */
const getTemplateReadyTypes = asyncHandler(async (req, res) => {
  const userId = req.user?.accountId;
  if (!userId) throw new BadRequestError('缺少用户标识');
  const types = await userMemoryModel.getTemplateReadyTypes(userId);

  // 为每个类型构建提示词
  const result = [];
  for (const t of types) {
    const prompt = await userMemoryModel.buildTemplatePrompt(userId, t.doc_type);
    result.push({
      docType: t.doc_type,
      docCount: t.doc_count,
      prompt
    });
  }

  return ok(res, { items: result });
});

// =========================
// 智能模板
// =========================

/**
 * POST /api/smart-templates/generate
 * Body: { docType, name?, description? }
 * 自动生成智能模板（基于用户历史记忆）
 * 需要 AI 配合：先由 AI 生成 templateContent，再调用此接口保存
 */
const generateTemplate = asyncHandler(async (req, res) => {
  const userId = req.user?.accountId;
  if (!userId) throw new BadRequestError('缺少用户标识');

  const { docType, name, description, templateContent, promptHint } = req.body || {};
  if (!docType) throw new BadRequestError('缺少 docType');
  if (!templateContent) throw new BadRequestError('缺少 templateContent');

  // 获取用户的记忆数据
  const memory = await userMemoryModel.getMemory(userId, docType);
  if (!memory) throw new BadRequestError('未找到该文档类型的记忆');

  const template = await smartTemplateModel.create({
    userId,
    docType,
    name: name || `${docType} 智能模板`,
    description: description || `基于 ${memory.doc_count} 篇文档自动生成`,
    templateContent,
    promptHint,
    docCount: memory.doc_count,
    structures: memory.structures,
    highFreqTerms: memory.high_freq_terms,
    signatures: memory.signatures
  });

  // 标记记忆中的模板已生成
  await userMemoryModel.markTemplateGenerated(userId, docType, template.id);

  return ok(res, { template });
});

/**
 * GET /api/smart-templates/list?docType=
 * 获取用户的智能模板列表
 */
const listTemplates = asyncHandler(async (req, res) => {
  const userId = req.user?.accountId;
  if (!userId) throw new BadRequestError('缺少用户标识');

  const { docType } = req.query;
  const templates = await smartTemplateModel.listByUser(userId, { docType });
  return ok(res, { items: templates });
});

/**
 * GET /api/smart-templates/recommended?docType=&limit=5
 * 获取推荐模板（新建文档时优先展示）
 */
const getRecommendedTemplates = asyncHandler(async (req, res) => {
  const userId = req.user?.accountId;
  if (!userId) throw new BadRequestError('缺少用户标识');

  const { docType, limit } = req.query;
  const templates = await smartTemplateModel.getRecommended(
    userId,
    docType || null,
    parseInt(limit || '5', 10)
  );
  return ok(res, { items: templates });
});

/**
 * GET /api/smart-templates/:id
 * 获取单个模板详情
 */
const getTemplate = asyncHandler(async (req, res) => {
  const template = await smartTemplateModel.findById(req.params.id);
  if (!template) throw new NotFoundError('模板不存在');
  return ok(res, template);
});

/**
 * PUT /api/smart-templates/:id
 * 更新模板
 */
const updateTemplate = asyncHandler(async (req, res) => {
  const updated = await smartTemplateModel.update(req.params.id, req.body || {});
  if (!updated) throw new NotFoundError('模板不存在');
  return ok(res, { template: updated });
});

/**
 * POST /api/smart-templates/:id/use
 * 标记模板被使用（增加使用计数）
 */
const useTemplate = asyncHandler(async (req, res) => {
  await smartTemplateModel.incrementUsage(req.params.id);
  return ok(res, { used: true });
});

/**
 * DELETE /api/smart-templates/:id
 * 删除模板（软删除）
 */
const deleteTemplate = asyncHandler(async (req, res) => {
  const okDeleted = await smartTemplateModel.remove(req.params.id);
  if (!okDeleted) throw new NotFoundError('模板不存在');
  return ok(res, { deleted: true });
});

module.exports = {
  recordDocument,
  listMemories,
  getMemoryByType,
  getTemplatePrompt,
  getTemplateReadyTypes,
  generateTemplate,
  listTemplates,
  getRecommendedTemplates,
  getTemplate,
  updateTemplate,
  useTemplate,
  deleteTemplate
};
