/**
 * 错误处理中间件
 * - 标准化返回结构：{ ok:false, error:{ code, message, details? } }
 * - HttpError 按 status/code 输出
 * - 未知错误记录日志并返回 500
 */
'use strict';

const config = require('../config');
const logger = require('../utils/logger');
const { HttpError } = require('../utils/errors');

// 404 兜底：放在所有路由之后
function notFoundHandler(req, res, next) {
  next(new HttpError(404, 'NOT_FOUND', `路由不存在: ${req.method} ${req.originalUrl}`));
}

// 错误处理：放在最后
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isHttp = err instanceof HttpError;
  const status = isHttp ? err.status : 500;
  const code = isHttp ? err.code : 'INTERNAL_ERROR';
  const message = isHttp
    ? err.message
    : (config.env === 'production' ? '服务器内部错误' : (err.message || '服务器内部错误'));

  const logPayload = {
    method: req.method,
    url: req.originalUrl,
    status,
    code,
    err: err.message,
    stack: err.stack
  };
  if (status >= 500) {
    logger.error('Request failed', logPayload);
  } else {
    logger.warn('Request rejected', logPayload);
  }

  if (res.headersSent) {
    return next(err);
  }

  const body = {
    ok: false,
    error: {
      code,
      message
    }
  };
  if (isHttp && err.details !== undefined) {
    body.error.details = err.details;
  }
  if (status >= 500 && config.env !== 'production') {
    body.error.stack = err.stack;
  }
  // ⚠️ 调试：WPX_DEBUG_ERROR=true 时强制返回错误堆栈（即使 production 环境）
  if (status >= 500 && process.env.WPX_DEBUG_ERROR === 'true') {
    body.error.debug = {
      name: err.name,
      message: err.message,
      stack: (err.stack || '').split('\n').slice(0, 12).join('\n')
    };
  }

  res.status(status).json(body);
}

// 兜底：未捕获的 Promise reject / 异常
function installProcessHandlers() {
  process.on('unhandledRejection', (reason) => {
    logger.error('UnhandledRejection', {
      err: reason && reason.message ? reason.message : String(reason)
    });
  });
  process.on('uncaughtException', (err) => {
    logger.error('UncaughtException', { err: err.message, stack: err.stack });
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
  installProcessHandlers
};
