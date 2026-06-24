/**
 * Express 应用工厂
 * 单独导出 app 便于测试注入
 */
'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/error-handler');
const { assignRequestId, accessLog } = require('./middleware/request-logger');
const logger = require('./utils/logger');

function createApp() {
  const app = express();

  // 关闭 x-powered-by，避免泄露框架信息
  app.disable('x-powered-by');

  // 反向代理场景下要信任 X-Forwarded-* 才能正确取到 req.ip
  app.set('trust proxy', config.trustProxyHops);

  // 安全相关响应头
  app.use(helmet({
    contentSecurityPolicy: false, // 纯 API 不需要 CSP
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));

  // 跨域：origins 包含 '*' 时放行任意 origin；显式白名单时按 origin 校验
  const corsWildcard = Array.isArray(config.cors.origins) && config.cors.origins.includes('*');
  const corsOptions = corsWildcard
    ? { origin: true, credentials: false }
    : {
        origin: (origin, cb) => {
          // 同源请求（curl / 服务端）没有 origin，放行
          if (!origin) return cb(null, true);
          if (config.cors.origins.includes(origin)) return cb(null, true);
          // 非白名单：不抛错，不返回 CORS 头，让浏览器阻断；服务端日志记录
          require('./utils/logger').warn('CORS rejected', { origin });
          return cb(null, false);
        },
        credentials: config.cors.credentials
      };
  app.use(cors(corsOptions));

  // 请求体
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: config.bodyLimit }));

  // 请求 ID + 访问日志
  app.use(assignRequestId);
  app.use(accessLog);

  // 根路径
  app.get('/', (req, res) => {
    res.json({
      ok: true,
      data: {
        name: 'wpx-server',
        env: config.env,
        ts: new Date().toISOString()
      }
    });
  });

  // 业务路由
  app.use(routes);

  // 404
  app.use(notFoundHandler);

  // 全局错误处理
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
