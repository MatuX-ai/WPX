/**
 * 简易 CSV 序列化工具
 *  - 字段包含逗号 / 引号 / 换行 时自动加双引号包裹并转义
 *  - value 为对象/数组时序列化为 JSON
 *  - value 为 null/undefined 输出空字段
 */

'use strict';

function escapeCell(v) {
  if (v === null || v === undefined) return '';
  let s;
  if (typeof v === 'object') {
    try {
      s = JSON.stringify(v);
    } catch (_) {
      s = String(v);
    }
  } else {
    s = String(v);
  }
  if (/[",\r\n]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCSV(rows, columns) {
  if (!Array.isArray(rows)) rows = [];
  // 推导列：取首行 key 或使用 columns 入参
  let cols;
  if (Array.isArray(columns) && columns.length) {
    cols = columns.map((c) => (typeof c === 'string' ? { key: c, header: c } : c));
  } else if (rows.length > 0) {
    cols = Object.keys(rows[0]).map((k) => ({ key: k, header: k }));
  } else {
    return '';
  }

  const lines = [];
  lines.push(cols.map((c) => escapeCell(c.header)).join(','));
  for (const r of rows) {
    lines.push(cols.map((c) => escapeCell(r ? r[c.key] : '')).join(','));
  }
  // Excel 友好：行尾 CRLF
  return lines.join('\r\n');
}

module.exports = { toCSV, escapeCell };