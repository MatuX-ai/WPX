/**
 * 用户记忆模型 (User Memory Model)
 *
 * 追踪用户的写作习惯，包括:
 *   - 文档结构模式 (结构学习)
 *   - 高频词汇与用语 (用语学习)
 *   - 签名语与称呼习惯 (用语学习)
 *   - 文档类型偏好 (智能模板)
 *
 * 当用户对同一类型文档写够 N 次后，自动生成专属模板。
 *
 * 表结构:
 *   user_writing_memory:
 *     - id SERIAL PRIMARY KEY
 *     - user_id TEXT NOT NULL
 *     - doc_type TEXT NOT NULL          (文档类型: weekly_report, ppt_outline, essay, paper, resume, etc.)
 *     - doc_count INTEGER DEFAULT 1    (该类型已写次数)
 *     - structures JSONB               (识别到的结构模式)
 *     - high_freq_terms TEXT[]         (高频词汇)
 *     - signatures TEXT[]              (签名语/称呼习惯)
 *     - template_generated BOOLEAN DEFAULT FALSE
 *     - template_id TEXT               (关联的智能模板 ID)
 *     - last_doc_id TEXT               (最近一篇文档 ID)
 *     - updated_at TIMESTAMPTZ DEFAULT NOW()
 *     - created_at TIMESTAMPTZ DEFAULT NOW()
 */

'use strict';

const db = require('./db');

const TABLE = 'user_writing_memory';
const MIN_DOCS_FOR_TEMPLATE = 3; // 最少需要 3 篇同类型文档才能生成模板

/**
 * 确保表存在
 */
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      doc_count INTEGER DEFAULT 1,
      structures JSONB,
      high_freq_terms TEXT[] DEFAULT '{}',
      signatures TEXT[] DEFAULT '{}',
      template_generated BOOLEAN DEFAULT FALSE,
      template_id TEXT,
      last_doc_id TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, doc_type)
    );
    CREATE INDEX IF NOT EXISTS idx_wm_user_id ON ${TABLE}(user_id);
    CREATE INDEX IF NOT EXISTS idx_wm_doc_type ON ${TABLE}(doc_type);
  `);
}

let tableReady = false;
async function init() {
  if (!tableReady) { await ensureTable(); tableReady = true; }
}

// ============ 结构分析 ============

/**
 * 分析文档结构
 * 提取标题层级、段落模式、列表模式等
 *
 * @param {string} content - 文档内容（Markdown）
 * @returns {object} 结构描述
 */
function analyzeStructure(content) {
  if (!content || typeof content !== 'string') return {};

  const lines = content.split('\n');
  const structure = {
    headingCount: 0,
    headingLevels: [],     // [{ level: 2, text: '...' }]
    sections: [],          // [{ title: '...', paragraphCount: number, hasList: boolean }]
    totalParagraphs: 0,
    hasNumberedList: false,
    hasBulletList: false,
    hasTable: false,
    signatureLine: null,   // 签名行
    greetingLine: null     // 称呼行
  };

  let currentSection = null;

  for (const line of lines) {
    // 标题匹配
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      structure.headingCount++;
      structure.headingLevels.push({ level, text: headingMatch[2].trim() });

      if (currentSection) {
        structure.sections.push(currentSection);
      }
      currentSection = {
        title: headingMatch[2].trim(),
        paragraphCount: 0,
        hasList: false
      };
      continue;
    }

    // 空行 = 段落分隔
    if (line.trim() === '') {
      if (currentSection) currentSection.paragraphCount++;
      continue;
    }

    // 列表检测
    if (/^\d+[\.\)]\s/.test(line.trim()) || /^[①②③④⑤⑥⑦⑧⑨⑩]/.test(line.trim())) {
      structure.hasNumberedList = true;
      if (currentSection) currentSection.hasList = true;
    }
    if (/^[\-\*\+]\s/.test(line.trim())) {
      structure.hasBulletList = true;
      if (currentSection) currentSection.hasList = true;
    }

    // 表格检测
    if (/^\|.+\|/.test(line.trim()) && !/^[\-\|:]+$/.test(line.trim().replace(/\s/g, ''))) {
      structure.hasTable = true;
    }

    // 签名行检测 (以 "—" 或 "--" 开头，或包含 "此致"、"敬礼" 等)
    if (/^[—\-]{2,}\s*\S/.test(line.trim()) || /此致|敬礼|顺颂|商祺/.test(line)) {
      structure.signatureLine = line.trim();
    }

    // 称呼行检测 (以 "尊敬的"/"亲爱的"/"Hi"/"Dear" 开头)
    if (/^(尊敬的|亲爱的|敬爱的|Hi\s|Dear\s|Hello\s)/.test(line.trim())) {
      structure.greetingLine = line.trim();
    }
  }

  if (currentSection) {
    structure.sections.push(currentSection);
  }

  structure.totalParagraphs = structure.sections.reduce((sum, s) => sum + s.paragraphCount, 0);

  return structure;
}

/**
 * 提取高频词汇（Top N 个出现最多的 2-4 字词）
 * 简单实现：提取中文词汇（2-4字连续汉字）
 *
 * @param {string} content
 * @param {number} [topN=20]
 * @returns {string[]}
 */
function extractHighFreqTerms(content, topN = 20) {
  if (!content) return [];

  const termFreq = new Map();

  // 提取中文连续词组 (2-4字)
  const chineseTerms = content.match(/[\u4e00-\u9fff]{2,4}/g) || [];
  for (const term of chineseTerms) {
    termFreq.set(term, (termFreq.get(term) || 0) + 1);
  }

  // 提取英文词汇
  const englishTerms = content.match(/[a-zA-Z]{3,}/g) || [];
  for (const term of englishTerms) {
    const lower = term.toLowerCase();
    // 过滤常见停用词
    if (['the', 'and', 'for', 'that', 'this', 'with', 'from', 'have'].includes(lower)) continue;
    termFreq.set(lower, (termFreq.get(lower) || 0) + 1);
  }

  // 排序取 Top N
  return [...termFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term]) => term);
}

/**
 * 提取签名语（文档末尾的署名段落）
 * @param {string} content
 * @returns {string[]}
 */
function extractSignatures(content) {
  if (!content) return [];
  const lines = content.split('\n');
  const signatures = [];

  // 检查最后 10 行中的签名模式
  const tail = lines.slice(-10);
  for (const line of tail) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 日期 + 署名模式
    if (/\d{4}[年\-\/]\d{1,2}[月\-\/]\d{1,2}日?/.test(trimmed)) {
      signatures.push(trimmed);
    }
    // 署名模式
    if (/^[—\-]{2,}\s*\S/.test(trimmed) || /此致|敬礼|顺颂|商祺/.test(trimmed)) {
      signatures.push(trimmed);
    }
  }

  return signatures;
}

// ============ 记忆更新 ============

/**
 * 记录用户写了一篇文档，更新记忆
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.docType    - 文档类型
 * @param {string} [params.docId]    - 文档 ID
 * @param {string} [params.content]  - 文档内容（用于分析）
 * @returns {Promise<object>} 更新后的记忆条目
 */
async function recordDocument({ userId, docType, docId, content }) {
  await init();
  if (!userId || !docType) return null;

  const existing = await getMemory(userId, docType);

  let structures = existing?.structures || [];
  const allTerms = existing?.high_freq_terms || [];
  const allSignatures = existing?.signatures || [];
  const newCount = (existing?.doc_count || 0) + 1;

  // 分析本次文档
  if (content) {
    const struct = analyzeStructure(content);
    structures.push(struct);

    const terms = extractHighFreqTerms(content);
    for (const t of terms) {
      if (!allTerms.includes(t)) allTerms.push(t);
    }

    const sigs = extractSignatures(content);
    for (const s of sigs) {
      if (!allSignatures.includes(s)) allSignatures.push(s);
    }
  }

  // 保持高频词汇不超过 100 个
  const trimmedTerms = allTerms.slice(0, 100);
  const trimmedSignatures = allSignatures.slice(0, 20);
  const trimmedStructures = structures.slice(-10); // 只保留最近 10 次的结构

  const sql = `
    INSERT INTO ${TABLE}
      (user_id, doc_type, doc_count, structures, high_freq_terms, signatures, last_doc_id, template_generated)
    VALUES ($1, $2, $3, $4::jsonb, $5::text[], $6::text[], $7, $8)
    ON CONFLICT (user_id, doc_type) DO UPDATE SET
      doc_count = EXCLUDED.doc_count,
      structures = EXCLUDED.structures,
      high_freq_terms = EXCLUDED.high_freq_terms,
      signatures = EXCLUDED.signatures,
      last_doc_id = COALESCE(EXCLUDED.last_doc_id, ${TABLE}.last_doc_id),
      updated_at = NOW()
    RETURNING *
  `;

  const res = await db.query(sql, [
    userId, docType, newCount,
    JSON.stringify(trimmedStructures),
    trimmedTerms, trimmedSignatures,
    docId || null,
    existing?.template_generated || false
  ]);

  const memory = res.rows[0];
  memory.shouldGenerateTemplate = newCount >= MIN_DOCS_FOR_TEMPLATE && !memory.template_generated;

  return memory;
}

/**
 * 获取用户的某类文档记忆
 * @param {string} userId
 * @param {string} docType
 * @returns {Promise<object|null>}
 */
async function getMemory(userId, docType) {
  await init();
  const res = await db.query(
    `SELECT * FROM ${TABLE} WHERE user_id = $1 AND doc_type = $2 LIMIT 1`,
    [userId, docType]
  );
  return res.rows[0] || null;
}

/**
 * 获取用户所有文档类型的记忆列表
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getAllMemories(userId) {
  await init();
  const res = await db.query(
    `SELECT * FROM ${TABLE} WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId]
  );
  return res.rows;
}

/**
 * 标记某类文档模板已生成
 * @param {string} userId
 * @param {string} docType
 * @param {string} templateId
 */
async function markTemplateGenerated(userId, docType, templateId) {
  await init();
  await db.query(
    `UPDATE ${TABLE} SET template_generated = TRUE, template_id = $3
     WHERE user_id = $1 AND doc_type = $2`,
    [userId, docType, templateId]
  );
}

/**
 * 获取可以生成模板的文档类型（写了足够次数但还没生成模板的）
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getTemplateReadyTypes(userId) {
  await init();
  const res = await db.query(
    `SELECT * FROM ${TABLE}
     WHERE user_id = $1
       AND doc_count >= $2
       AND template_generated = FALSE
     ORDER BY doc_count DESC`,
    [userId, MIN_DOCS_FOR_TEMPLATE]
  );
  return res.rows;
}

/**
 * 构建智能模板的 System Prompt
 * 基于用户的历史结构和用语习惯
 *
 * @param {string} userId
 * @param {string} docType
 * @returns {Promise<object|null>} { systemPrompt: string, structures: object[], terms: string[], signatures: string[] }
 */
async function buildTemplatePrompt(userId, docType) {
  const memory = await getMemory(userId, docType);
  if (!memory || memory.doc_count < MIN_DOCS_FOR_TEMPLATE) return null;

  const structures = memory.structures || [];
  const terms = memory.high_freq_terms || [];
  const signatures = memory.signatures || [];

  // 分析结构模式：找出最常见的标题层次
  const headingPatterns = [];
  const sectionCounts = [];
  for (const s of structures) {
    if (s.headingLevels && s.headingLevels.length > 0) {
      headingPatterns.push(s.headingLevels.map(h => h.text));
    }
    sectionCounts.push((s.sections || []).length);
  }

  const avgSections = sectionCounts.length > 0
    ? Math.round(sectionCounts.reduce((a, b) => a + b, 0) / sectionCounts.length)
    : 3;

  // 生成模板提示词
  const promptParts = [
    `你正在帮助用户撰写一份「${docType}」类型的文档。`,
    ``,
    `## 用户写作习惯`,
    `- 该用户已写过 ${memory.doc_count} 篇同类型文档`,
    `- 通常包含 ${avgSections} 个主要段落`,
    ``,
    `## 高频用语`,
    terms.length > 0
      ? `用户常用以下词汇：${terms.slice(0, 15).join('、')}`
      : '',
    ``,
    `## 签名习惯`,
    signatures.length > 0
      ? `用户通常在文档末尾使用以下格式收尾：${signatures.join('；')}`
      : '',
    ``,
    `请参考以上习惯，按照用户偏好的风格生成文档内容。`
  ].filter(Boolean);

  return {
    systemPrompt: promptParts.join('\n'),
    structures: structures.slice(-3), // 最近 3 次的结构
    terms: terms.slice(0, 20),
    signatures,
    avgSections,
    docCount: memory.doc_count
  };
}

module.exports = {
  MIN_DOCS_FOR_TEMPLATE,
  analyzeStructure,
  extractHighFreqTerms,
  extractSignatures,
  recordDocument,
  getMemory,
  getAllMemories,
  markTemplateGenerated,
  getTemplateReadyTypes,
  buildTemplatePrompt
};
