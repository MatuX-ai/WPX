/**
 * 启动入口
 * - 加载配置
 * - 连接 Postgres / Redis
 * - 启动 HTTP 服务
 * - 注册进程级兜底日志
 */
'use strict';

const config = require('./config');
const logger = require('./utils/logger');
const { createApp } = require('./app');
const db = require('./models/db');
const redis = require('./models/redis');
const { installProcessHandlers } = require('./middleware/error-handler');

async function main() {
  installProcessHandlers();

  logger.info('Booting wpx-server', { config: config.describe() });

  // 连接 Redis（失败不阻塞启动，记录告警）
  try {
    await redis.connect();
  } catch (err) {
    logger.warn('Redis connect failed at boot', { err: err.message });
  }

  // 探测 PG（失败直接退出，避免提供不完整服务）
  try {
    const ok = await db.ping();
    if (!ok) throw new Error('ping 返回非 1');
    logger.info('PostgreSQL ready', { host: config.pg.host, db: config.pg.database });
  } catch (err) {
    logger.error('PostgreSQL connect failed', { err: err.message });
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info('HTTP listening', { port: config.port, env: config.env });
    // PM2 wait_ready 协议：告知上游进程已准备好接收流量
    if (typeof process.send === 'function') {
      try { process.send('ready'); } catch (_) { /* 非 PM2 环境时忽略 */ }
    }
  });

  // 优雅关闭
  const shutdown = async (signal) => {
    logger.info('Received signal, shutting down', { signal });
    server.close(async (err) => {
      if (err) logger.error('server.close error', { err: err.message });
      try { await db.close(); } catch (e) { logger.warn('db close', { err: e.message }); }
      try { await redis.close(); } catch (e) { logger.warn('redis close', { err: e.message }); }
      process.exit(0);
    });
    // 兜底：超过 10s 强制退出
    setTimeout(() => {
      logger.error('Forced exit after timeout');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal during boot', { err: err.message, stack: err.stack });
  process.exit(1);
});
