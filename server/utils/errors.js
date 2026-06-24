/**
 * 统一业务错误类型
 * 业务层抛出后由错误中间件捕获并返回标准化响应
 */
'use strict';

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

class BadRequestError extends HttpError {
  constructor(message = '请求参数错误', details) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

class UnauthorizedError extends HttpError {
  constructor(message = '未认证', details) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

class ForbiddenError extends HttpError {
  constructor(message = '无权限', details) {
    super(403, 'FORBIDDEN', message, details);
  }
}

class NotFoundError extends HttpError {
  constructor(message = '资源不存在', details) {
    super(404, 'NOT_FOUND', message, details);
  }
}

class ConflictError extends HttpError {
  constructor(message = '资源冲突', details) {
    super(409, 'CONFLICT', message, details);
  }
}

class InternalError extends HttpError {
  constructor(message = '服务器内部错误', details) {
    super(500, 'INTERNAL_ERROR', message, details);
  }
}

module.exports = {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalError
};
