/**
 * 通用响应辅助工具
 * 提供 ok/fail 统一格式
 */
'use strict';

function ok(res, data = null, meta) {
  const body = { ok: true };
  if (data !== null && data !== undefined) body.data = data;
  if (meta) body.meta = meta;
  return res.json(body);
}

function fail(res, status, code, message, details) {
  const body = { ok: false, error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return res.status(status).json(body);
}

module.exports = { ok, fail };
