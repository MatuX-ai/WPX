/**
 * AnySearch 路由
 *
 * POST /api/anysearch/search  — 执行搜索（供 AI 代理或前端调用）
 * GET  /api/anysearch/health  — 健康检查
 */
'use strict';

const router = require('express').Router();
const anysearch = require('../adapters/anysearch-adapter');

/**
 * POST /api/anysearch/search
 * Body: { query, userKey?, searchType?, maxResults?, returnMarkdown? }
 */
router.post('/search', async (req, res) => {
  const { query, userKey, searchType, maxResults, returnMarkdown } = req.body || {};

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ ok: false, error: '缺少搜索关键词' });
  }

  const result = await anysearch.search({
    query: query.trim(),
    userKey,
    searchType,
    maxResults,
    returnMarkdown
  });

  if (!result.ok) {
    return res.status(200).json({
      ok: true,
      results: [],
      degraded: true,
      reason: result.error || '搜索不可用'
    });
  }

  res.json({
    ok: true,
    results: result.results,
    query: result.query,
    fromCache: result.fromCache || false
  });
});

/**
 * GET /api/anysearch/health
 * 检查 AnySearch 是否可用
 */
router.get('/health', (_req, res) => {
  const platformKey = process.env.ANYSEARCH_API_KEY || '';
  res.json({
    ok: true,
    available: Boolean(platformKey),
    hasPlatformKey: Boolean(platformKey)
  });
});

module.exports = router;
