/**
 * Redis 客户端
 * 提供常用封装与健康检查
 */
'use strict';

const { createClient } = require('redis');
const config = require('../config');
const logger = require('../utils/logger');

const client = createClient({
  url: config.redis.url,
  password: config.redis.password,
  database: config.redis.db
});

let connected = false;

client.on('error', (err) => {
  logger.error('Redis client error', { err: err.message });
});

client.on('ready', () => {
  connected = true;
  logger.info('Redis connected', { url: config.redis.url });
});

client.on('end', () => {
  connected = false;
});

async function connect() {
  if (!connected) {
    await client.connect();
  }
  return client;
}

async function close() {
  if (connected) {
    await client.quit();
  }
}

async function ping() {
  if (!connected) return false;
  try {
    const reply = await client.ping();
    return reply === 'PONG';
  } catch (_) {
    return false;
  }
}

async function getJSON(key) {
  const raw = await client.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

async function setJSON(key, value, ttlSeconds) {
  const payload = JSON.stringify(value);
  if (ttlSeconds) {
    return client.set(key, payload, { EX: ttlSeconds });
  }
  return client.set(key, payload);
}

module.exports = {
  client,
  connect,
  close,
  ping,
  getJSON,
  setJSON
};
