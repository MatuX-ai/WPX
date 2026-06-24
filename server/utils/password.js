/**
 * WPX 密码哈希工具（基于 bcryptjs）
 *
 * 推荐使用 bcryptjs 而非 native bcrypt：
 *   - 纯 JS 实现，无需 node-gyp，避免编译失败
 *   - 跨平台表现一致
 *
 * 成本因子 12 是 2024+ 推荐值（OWASP：>= 10）。
 */
'use strict';

const bcrypt = require('bcryptjs');

const COST = Number.parseInt(process.env.BCRYPT_COST, 10) || 12;

async function hashPassword(plaintext) {
  const value = String(plaintext || '');
  if (value.length < 8) {
    throw new Error('密码长度至少 8 位');
  }
  return bcrypt.hash(value, COST);
}

async function verifyPassword(plaintext, hashed) {
  if (!plaintext || !hashed) return false;
  try {
    return await bcrypt.compare(String(plaintext), String(hashed));
  } catch (_) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword, COST };
