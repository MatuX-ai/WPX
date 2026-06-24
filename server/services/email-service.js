/**
 * WPX 邮件服务（基于 nodemailer）
 *
 * 提供：
 *  - sendVerifyEmail(to, token)        注册邮箱验证
 *  - sendResetPasswordEmail(to, token) 找回密码
 *
 * SMTP 配置读取自 config.smtp（对应环境变量 SMTP_HOST/PORT/SECURE/USER/PASS/FROM）。
 * 当 SMTP_HOST 为空时，邮件发送将进入「日志模式」：仅写入控制台而不真正发出，
 * 验证 / 重置链接会回显到日志，便于本地开发。
 */
'use strict';

const nodemailer = require('nodemailer');
const crypto = require('node:crypto');
const config = require('../config');
const logger = require('../utils/logger');

let cachedTransporter = null;

function isMailConfigured() {
  return Boolean(config.smtp && config.smtp.host);
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  if (!isMailConfigured()) return null;

  cachedTransporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: Boolean(config.smtp.secure),
    auth:
      config.smtp.user || config.smtp.pass
        ? { user: config.smtp.user, pass: config.smtp.pass }
        : undefined
  });

  return cachedTransporter;
}

/**
 * 生成一次性令牌（URL-safe base64，48 字节熵）
 */
function generateToken() {
  return crypto.randomBytes(48).toString('base64url');
}

/**
 * 拼接验证 / 重置链接。
 */
function buildLink(kind, token) {
  const base = String(config.publicWebBase || 'https://prowpx.com').replace(/\/$/, '');
  const path = kind === 'reset' ? '/auth/reset-password' : '/auth/verify-email';
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

/**
 * 内部：实际发送邮件。未配置 SMTP 时降级为日志输出。
 * @param {{ to: string, subject: string, html: string, text: string }} payload
 */
async function sendMail(payload) {
  const transporter = getTransporter();
  const from = config.smtp.from || 'WPX <noreply@prowpx.com>';

  if (!transporter) {
    logger.warn('[email] SMTP 未配置，进入日志模式（不会真实发送）', {
      to: payload.to,
      subject: payload.subject,
      preview: payload.text.slice(0, 200)
    });
    return { ok: true, mode: 'log' };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text
    });
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    logger.error('[email] 发送失败', { to: payload.to, err: error.message });
    throw error;
  }
}

/**
 * 发送注册邮箱验证邮件
 * @param {{ to: string, token: string, nickname?: string }} payload
 */
async function sendVerifyEmail(payload) {
  const link = buildLink('verify', payload.token);
  const nickname = payload.nickname ? `，${payload.nickname}` : '';
  const subject = '【WPX】请验证你的邮箱';
  const text =
    `你好${nickname}：\n\n` +
    `感谢注册 WPX。点击下方链接完成邮箱验证，链接将在 24 小时内有效：\n${link}\n\n` +
    `若链接无法点击，请复制完整地址到浏览器中打开。\n\n` +
    `如果这不是你的操作，请忽略本邮件。\n— WPX 团队`;
  const html =
    `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0f172a">` +
    `<p>你好${escapeHtml(nickname)}：</p>` +
    `<p>感谢注册 WPX。点击下方按钮完成邮箱验证，链接将在 24 小时内有效：</p>` +
    `<p><a href="${link}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none">验证邮箱</a></p>` +
    `<p style="color:#64748b;font-size:13px">若按钮无法点击，请复制以下链接到浏览器：<br><code>${link}</code></p>` +
    `<p style="color:#64748b;font-size:13px">如果这不是你的操作，请忽略本邮件。</p>` +
    `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"><p style="color:#94a3b8;font-size:12px">WPX 团队</p>` +
    `</div>`;
  return sendMail({ to: payload.to, subject, html, text });
}

/**
 * 发送密码重置邮件
 * @param {{ to: string, token: string, nickname?: string }} payload
 */
async function sendResetPasswordEmail(payload) {
  const link = buildLink('reset', payload.token);
  const nickname = payload.nickname ? `，${payload.nickname}` : '';
  const subject = '【WPX】重置你的密码';
  const text =
    `你好${nickname}：\n\n` +
    `我们收到了你的密码重置请求。点击下方链接设置新密码，链接将在 30 分钟内有效：\n${link}\n\n` +
    `若链接无法点击，请复制完整地址到浏览器中打开。\n\n` +
    `如果这不是你的操作，请忽略本邮件，你的账号仍然安全。\n— WPX 团队`;
  const html =
    `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0f172a">` +
    `<p>你好${escapeHtml(nickname)}：</p>` +
    `<p>我们收到了你的密码重置请求。点击下方按钮设置新密码，链接将在 30 分钟内有效：</p>` +
    `<p><a href="${link}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none">设置新密码</a></p>` +
    `<p style="color:#64748b;font-size:13px">若按钮无法点击，请复制以下链接到浏览器：<br><code>${link}</code></p>` +
    `<p style="color:#64748b;font-size:13px">如果这不是你的操作，请忽略本邮件。</p>` +
    `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"><p style="color:#94a3b8;font-size:12px">WPX 团队</p>` +
    `</div>`;
  return sendMail({ to: payload.to, subject, html, text });
}

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  generateToken,
  sendVerifyEmail,
  sendResetPasswordEmail,
  isMailConfigured
};
