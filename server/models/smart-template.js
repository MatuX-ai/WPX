/**
 * 智能模板模型 (Smart Template Model)
 *
 * 存储根据用户写作习惯自动生成的专属模板。
 *
 * 表结构:
 *   smart_templates:
 *     - id TEXT PRIMARY KEY
 *     - user_id TEXT NOT NULL
 *     - doc_type TEXT NOT NULL
 *     - name TEXT NOT NULL
 *     - description TEXT
 *     - template_content TEXT NOT NULL  (Markdown 模板内容)
 *     - prompt_hint TEXT                (AI System Prompt 片段)
 *     - doc_count INTEGER               (生成时的已写次数)
 *     - structures JSONB                (参考结构)
 *     - high_freq_terms TEXT[]          (高频词汇)
 *     - signatures TEXT[]               (签名习惯)
 *     - usage_count INTEGER DEFAULT 0   (被使用次数)
 *     - is_active BOOLEAN DEFAULT TRUE
 *     - created_at TIMESTAMPTZ DEFAULT NOW()
 *     - updated_at TIMESTAMPTZ DEFAULT NOW()
 */

'use strict';

const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const TABLE = 'smart_templates';

async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      template_content TEXT NOT NULL DEFAULT '',
      prompt_hint TEXT,
      doc_count INTEGER DEFAULT 0,
      structures JSONB,
      high_freq_terms TEXT[] DEFAULT '{}',
      signatures TEXT[] DEFAULT '{}',
      usage_count INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_st_user_type ON ${TABLE}(user_id, doc_type);
    CREATE INDEX IF NOT EXISTS idx_st_user_active ON ${TABLE}(user_id, is_active);
  `);
}

let tableReady = false;
async function init() {
  if (!tableReady) { await ensureTable(); tableReady = true; }
}

/**
 * 创建智能模板
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.docType
 * @param {string} params.name
 * @param {string} [params.description]
 * @param {string} params.templateContent
 * @param {string} [params.promptHint]
 * @param {number} [params.docCount]
 * @param {object} [params.structures]
 * @param {string[]} [params.highFreqTerms]
 * @param {string[]} [params.signatures]
 * @returns {Promise<object>}
 */
async function create(params) {
  await init();
  const {
    userId, docType, name, description = null,
    templateContent, promptHint = null,
    docCount = 0, structures = null,
    highFreqTerms = [], signatures = []
  } = params || {};

  if (!userId) throw new BadRequestError('缺少 userId');
  if (!docType) throw new BadRequestError('缺少 docType');
  if (!name) throw new BadRequestError('缺少 name');
  if (!templateContent) throw new BadRequestError('缺少 templateContent');

  const id = `stpl-${uuidv4().slice(0, 8)}`;

  const sql = `
    INSERT INTO ${TABLE}
      (id, user_id, doc_type, name, description, template_content, prompt_hint,
       doc_count, structures, high_freq_terms, signatures)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::text[], $11::text[])
    RETURNING *
  `;

  const res = await db.query(sql, [
    id, userId, docType, name, description,
    templateContent, promptHint, docCount,
    structures ? JSON.stringify(structures) : null,
    highFreqTerms, signatures
  ]);

  return res.rows[0];
}

/**
 * 获取用户的智能模板列表
 * @param {string} userId
 * @param {object} [options]
 * @param {string} [options.docType] 按文档类型筛选
 * @param {boolean} [options.activeOnly=true] 仅活跃模板
 * @returns {Promise<Array>}
 */
async function listByUser(userId, options = {}) {
  await init();
  const { docType, activeOnly = true } = options;
  const params = [userId];
  const where = ['user_id = $1'];

  if (docType) {
    params.push(docType);
    where.push(`doc_type = $${params.length}`);
  }
  if (activeOnly) {
    where.push('is_active = TRUE');
  }

  const sql = `
    SELECT * FROM ${TABLE}
    WHERE ${where.join(' AND ')}
    ORDER BY usage_count DESC, updated_at DESC
  `;

  const res = await db.query(sql, params);
  return res.rows;
}

/**
 * 获取单个模板
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function findById(id) {
  await init();
  const res = await db.query(`SELECT * FROM ${TABLE} WHERE id = $1 LIMIT 1`, [id]);
  return res.rows[0] || null;
}

/**
 * 更新模板
 * @param {string} id
 * @param {object} patch
 */
async function update(id, patch) {
  await init();
  const fields = [];
  const params = [id];
  const map = {
    name: 'name',
    description: 'description',
    templateContent: 'template_content',
    promptHint: 'prompt_hint',
    isActive: 'is_active'
  };

  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      params.push(patch[k]);
      fields.push(`${col} = $${params.length}`);
    }
  }

  if (fields.length === 0) return findById(id);

  const sql = `
    UPDATE ${TABLE}
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const res = await db.query(sql, params);
  return res.rows[0] || null;
}

/**
 * 增加模板使用计数
 * @param {string} id
 */
async function incrementUsage(id) {
  await init();
  await db.query(
    `UPDATE ${TABLE} SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = $1`,
    [id]
  );
}

/**
 * 删除模板（软删除）
 * @param {string} id
 */
async function remove(id) {
  await init();
  const res = await db.query(
    `UPDATE ${TABLE} SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id]
  );
  return res.rowCount > 0;
}

/**
 * 获取用户的推荐模板（新建文档时优先展示）
 * 按使用次数 + 最近更新时间排序
 * @param {string} userId
 * @param {string} [docType] 可选按类型筛选
 * @param {number} [limit=5]
 * @returns {Promise<Array>}
 */
async function getRecommended(userId, docType, limit = 5) {
  await init();
  const params = [userId];
  const where = ['user_id = $1', 'is_active = TRUE'];

  if (docType) {
    params.push(docType);
    where.push(`doc_type = $${params.length}`);
  }

  const sql = `
    SELECT * FROM ${TABLE}
    WHERE ${where.join(' AND ')}
    ORDER BY usage_count DESC, updated_at DESC
    LIMIT $${params.length + 1}
  `;
  params.push(limit);

  const res = await db.query(sql, params);
  return res.rows;
}

module.exports = {
  create,
  listByUser,
  findById,
  update,
  incrementUsage,
  remove,
  getRecommended
};
