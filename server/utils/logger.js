/**
 * 轻量日志器
 * 支持 level 过滤、结构化 JSON 输出
 * 不依赖第三方库，便于服务端定制
 */
'use strict';

const config = require('../config');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const currentLevel = LEVELS[config.logLevel] || LEVELS.info;

function format(level, msg, meta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: typeof msg === 'string' ? msg : (msg && msg.message) || String(msg),
    ...(meta && typeof meta === 'object' ? meta : {})
  };
  if (entry.msg instanceof Error) {
    entry.stack = entry.msg.stack;
    entry.msg = entry.msg.message;
  }
  return JSON.stringify(entry);
}

function log(level, msg, meta) {
  if (LEVELS[level] < currentLevel) return;
  const line = format(level, msg, meta);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

module.exports = {
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  child(bindings = {}) {
    return {
      debug: (msg, meta) => log('debug', msg, { ...bindings, ...meta }),
      info: (msg, meta) => log('info', msg, { ...bindings, ...meta }),
      warn: (msg, meta) => log('warn', msg, { ...bindings, ...meta }),
      error: (msg, meta) => log('error', msg, { ...bindings, ...meta })
    };
  }
};
