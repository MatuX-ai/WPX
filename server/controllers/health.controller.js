/**
 * 健康检查控制器
 * 提供 /healthz /readyz
 */
'use strict';

const asyncHandler = require('../utils/async-handler');
const { ok } = require('../utils/response');
const db = require('../models/db');
const redis = require('../models/redis');
const config = require('../config');

const healthz = asyncHandler(async (req, res) => {
  return ok(res, {
    status: 'ok',
    env: config.env,
    uptime: Math.round(process.uptime()),
    ts: new Date().toISOString()
  });
});

const readyz = asyncHandler(async (req, res) => {
  const checks = await Promise.allSettled([db.ping(), redis.ping()]);
  const [pgResult, redisResult] = checks;
  const data = {
    pg: pgResult.status === 'fulfilled' && pgResult.value === true,
    redis: redisResult.status === 'fulfilled' && redisResult.value === true
  };
  const ready = data.pg && data.redis;
  return res.status(ready ? 200 : 503).json({
    ok: ready,
    data
  });
});

module.exports = { healthz, readyz };
