/**
 * AnySearch 适配器
 *
 * 封装 AnySearch API，提供：
 *   - 网页搜索（支持 Markdown 结果缓存）
 *   - 自动注入 AI 对话上下文
 *   - 用户自带 AnySearch Key 支持
 *   - 降级策略：API 不可用时返回空，不阻塞 AI 对话
 *
 * 环境变量：
 *   - ANYSEARCH_API_URL    AnySearch API 地址 (默认 https://api.anysearch.cc)
 *   - ANYSEARCH_API_KEY    平台默认 API Key（用户未自带时使用）
 *   - ANYSEARCH_TIMEOUT    请求超时毫秒 (默认 10000)
 *   - ANYSEARCH_CACHE_TTL  缓存时间秒 (默认 3600)
 */

'use strict';

const https = require('https');
const http = require('http');

const API_URL = process.env.ANYSEARCH_API_URL || 'https://api.anysearch.cc';
const PLATFORM_KEY = process.env.ANYSEARCH_API_KEY || '';
const TIMEOUT = parseInt(process.env.ANYSEARCH_TIMEOUT || '10000', 10);
const CACHE_TTL = parseInt(process.env.ANYSEARCH_CACHE_TTL || '3600', 10);

/**
 * 简易内存缓存
 */
const cache = new Map();

/**
 * 调用统计
 */
const DAILY_LIMIT = 1000;
let todayCalls = 0;
let totalCalls = 0;
let userKeyCalls = 0;
let platformKeyCalls = 0;
let cacheHits = 0;
let degradedCount = 0;
let todayDate = getDateKey();
const dailyHistory = []; // [{ date, calls, userKeyCalls, platformKeyCalls, degraded }]
const domainDistribution = {}; // { web: 10, news: 2, ... }

function getDateKey() {
  const d = new Date();
  // UTC+8
  const local = new Date(d.getTime() + 8 * 3600 * 1000);
  return local.toISOString().slice(0, 10);
}

function resetDailyIfNeeded() {
  const today = getDateKey();
  if (today !== todayDate) {
    // 保存昨日数据
    dailyHistory.push({
      date: todayDate,
      calls: todayCalls,
      userKeyCalls,
      platformKeyCalls,
      degraded: degradedCount
    });
    // 只保留最近 30 天
    if (dailyHistory.length > 30) dailyHistory.shift();
    // 重置
    todayCalls = 0;
    userKeyCalls = 0;
    platformKeyCalls = 0;
    degradedCount = 0;
    todayDate = today;
  }
}

function getStats() {
  resetDailyIfNeeded();
  return {
    todayCalls,
    dailyLimit: DAILY_LIMIT,
    totalCalls,
    userKeyCalls,
    platformKeyCalls,
    cacheHits,
    degradedCount,
    dailyHistory,
    domainDistribution
  };
}

function getCacheKey(query) {
  return `anysearch:${query.toLowerCase().trim()}`;
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL * 1000) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
  // 限制缓存条目数
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

/**
 * HTTP POST 请求
 */
function httpPost(urlStr, body, headers = {}) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);
    const req = mod.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'WPX-Server/1.0',
          'Content-Length': Buffer.byteLength(payload),
          ...headers
        },
        timeout: TIMEOUT
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ ok: true, data: JSON.parse(data), status: res.statusCode });
          } catch (_e) {
            resolve({ ok: false, error: 'Invalid JSON response', status: res.statusCode });
          }
        });
      }
    );
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
    req.write(payload);
    req.end();
  });
}

/**
 * 执行 AnySearch 搜索
 *
 * @param {object} params
 * @param {string} params.query       - 搜索关键词
 * @param {string} [params.userKey]   - 用户自带的 AnySearch API Key
 * @param {string} [params.searchType] - 搜索类型: web | news | scholar | image
 * @param {number} [params.maxResults] - 最大结果数 (默认 5)
 * @param {boolean} [params.returnMarkdown] - 返回 Markdown 格式 (默认 true)
 * @returns {Promise<object>}
 */
async function search(params = {}) {
  const {
    query,
    userKey,
    searchType = 'web',
    maxResults = 5,
    returnMarkdown = true
  } = params;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return { ok: false, error: '搜索关键词为空', results: [] };
  }

  const apiKey = userKey || PLATFORM_KEY;
  if (!apiKey) {
    return { ok: false, error: '未配置 AnySearch API Key', results: [] };
  }

  // 检查缓存
  const cacheKey = getCacheKey(query);
  const cached = getCached(cacheKey);
  if (cached) {
    cacheHits++;
    return { ok: true, results: cached, fromCache: true };
  }

  resetDailyIfNeeded();

  const usingUserKey = Boolean(userKey);

  // 调用 AnySearch API
  const result = await httpPost(
    `${API_URL}/v1/search`,
    {
      query: query.trim(),
      type: searchType,
      count: Math.min(maxResults, 20),
      format: returnMarkdown ? 'markdown' : 'json'
    },
    { 'Authorization': `Bearer ${apiKey}` }
  );

  if (!result.ok) {
    degradedCount++;
    return { ok: false, error: result.error || 'AnySearch API 调用失败', results: [] };
  }

  // 更新统计
  todayCalls++;
  totalCalls++;
  if (usingUserKey) {
    userKeyCalls++;
  } else {
    platformKeyCalls++;
  }
  // 记录搜索领域
  const domain = searchType || 'web';
  domainDistribution[domain] = (domainDistribution[domain] || 0) + 1;

  // 解析结果
  const rawResults = result.data?.results || result.data?.data || [];

  const formatted = rawResults.map((r, i) => ({
    index: i + 1,
    title: r.title || r.name || '无标题',
    url: r.url || r.link || '',
    snippet: r.snippet || r.description || r.content || '',
    content: returnMarkdown ? (r.content_md || r.content || r.snippet || '') : '',
    source: r.source || r.domain || '',
    publishedAt: r.published_at || r.date || null
  }));

  // 缓存结果
  if (formatted.length > 0) {
    setCache(cacheKey, formatted);
  }

  return { ok: true, results: formatted, query: query.trim() };
}

/**
 * 构建注入 AI 对话上下文的搜索结果文本
 *
 * @param {Array} results - 搜索结果数组
 * @param {string} originalQuery - 原始查询
 * @returns {string} Markdown 格式的搜索结果文本
 */
function buildContextText(results, originalQuery) {
  if (!results || results.length === 0) return '';

  const parts = [
    `## 🔍 网络搜索结果：${originalQuery}`,
    '',
    '以下是根据你的问题搜索到的最新信息，请参考这些内容回答问题。',
    ''
  ];

  for (const r of results) {
    parts.push(`### [${r.title}](${r.url})`);
    if (r.source) parts.push(`*来源: ${r.source}*`);
    parts.push('');
    parts.push(r.content || r.snippet || '');
    parts.push('');
  }

  parts.push('---');
  parts.push('请综合以上搜索结果回答用户的问题。如果搜索结果不足以回答问题，请如实说明。');

  return parts.join('\n');
}

/**
 * 检测用户查询是否需要触发搜索
 * 基于关键词和意图分析
 *
 * @param {string} message - 用户消息
 * @returns {boolean}
 */
function shouldTriggerSearch(message) {
  if (!message || typeof message !== 'string') return false;

  const lower = message.toLowerCase().trim();

  // 明确的搜索意图关键词
  const searchTriggers = [
    '搜索', '查一下', '帮我查', '搜索一下',
    '最新', '最近', '新闻', '今天', '现在',
    'search', 'find', 'look up',
    '什么是', '什么是...', '怎么做', '如何',
    '价格', '天气', '股票', '汇率',
    'who is', 'what is', 'how to', 'when did',
    '最新消息', '最新进展', '最近发生'
  ];

  for (const trigger of searchTriggers) {
    if (lower.includes(trigger)) return true;
  }

  // 包含 URL 的模式（用户可能想了解某网页内容）
  if (/https?:\/\/[^\s]+/.test(message)) return true;

  // 问句模式
  if (lower.includes('?') || lower.includes('？')) {
    const questionWords = ['什么', '怎么', '为什么', '哪里', '谁', '什么时候', '多少', '哪'];
    if (questionWords.some(w => lower.includes(w))) return true;
  }

  return false;
}

/**
 * 清除缓存
 */
function clearCache() {
  cache.clear();
}

module.exports = {
  search,
  buildContextText,
  shouldTriggerSearch,
  clearCache,
  getStats
};
