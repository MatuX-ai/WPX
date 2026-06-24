/**
 * 请求访问日志中间件
 * 打印 method / url / status / duration / ip
 * 同时挂载 req.id 便于链路追踪
 */
'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');

function assignRequestId(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

function accessLog(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const payload = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip || req.connection?.remoteAddress,
      ua: req.headers['user-agent'],
      userId: req.user && req.user.id
    };
    if (res.statusCode >= 500) {
      logger.error('http', payload);
    } else if (res.statusCode >= 400) {
      logger.warn('http', payload);
    } else {
      logger.info('http', payload);
    }
  });
  next();
}

module.exports = { assignRequestId, accessLog };
