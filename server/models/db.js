/**
 * PostgreSQL 连接池
 * 单例导出，应用启动时自动 connect 一次
 */
'use strict';

const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

// 优先使用 config.pg.connectionString（DATABASE_URL），未配置时退回拆分的 host/port/user/password/database 字段
const poolConfig = config.pg.connectionString
  ? {
      connectionString: config.pg.connectionString,
      max: config.pg.max,
      idleTimeoutMillis: config.pg.idleTimeoutMillis,
      ssl: config.pg.ssl || false
    }
  : {
      host: config.pg.host,
      port: config.pg.port,
      user: config.pg.user,
      password: config.pg.password,
      database: config.pg.database,
      max: config.pg.max,
      idleTimeoutMillis: config.pg.idleTimeoutMillis,
      ssl: config.pg.ssl || false
    }

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error('PostgreSQL pool error', { err: err.message });
});

/**
 * 执行查询，自动释放连接
 * @param {string} text SQL 文本
 * @param {Array} params 参数数组
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 200) {
    logger.warn('Slow query', { duration, rows: res.rowCount, sql: text.slice(0, 200) });
  }
  return res;
}

/**
 * 事务封装：传入 fn，fn 接收 client，回滚时自动抛出
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* noop */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 健康检查
 */
async function ping() {
  const res = await pool.query('SELECT 1 AS ok');
  return res.rows[0] && res.rows[0].ok === 1;
}

async function close() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  withTransaction,
  ping,
  close
};
