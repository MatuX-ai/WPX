/**
 * SkillHub 在线 Skills 适配器
 *
 * 对接 skillhub.prowpx.com，提供：
 *   - 在线 Skills 列表浏览（支持搜索/分类/分页）
 *   - 单个 Skill 详情
 *   - 下载/安装在线 Skill 到本地
 *   - 在线 Skill 版本更新检测
 *
 * 降级策略：SkillHub 不可用时返回空列表，不阻塞本地 Skills 功能。
 */

'use strict';

const https = require('https');
const http = require('http');

const SKILLHUB_URL = process.env.SKILLHUB_URL || 'https://skillhub.prowpx.com';
const SKILLHUB_TIMEOUT = parseInt(process.env.SKILLHUB_TIMEOUT || '8000', 10);

/**
 * 发起 HTTP GET 请求
 * @param {string} urlStr
 * @returns {Promise<object>}
 */
function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.get(
      url,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'WPX-Server/1.0'
        },
        timeout: SKILLHUB_TIMEOUT
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (_e) {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * 获取在线 Skills 列表
 * @param {object} params
 * @param {string} [params.q] 搜索关键词
 * @param {string} [params.category] 分类: student | teacher | general
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=20]
 * @param {string} [params.sort='popular'] popular | newest | updated
 * @returns {Promise<{items: Array, pagination: object} | null>}
 */
async function listOnlineSkills(params = {}) {
  try {
    const { q, category, page = 1, pageSize = 20, sort = 'popular' } = params;
    const url = new URL('/api/v1/skills', SKILLHUB_URL);
    if (q) url.searchParams.set('q', q);
    if (category) url.searchParams.set('category', category);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    url.searchParams.set('sort', sort);

    const data = await httpGet(url.toString());
    return data || null;
  } catch (_e) {
    return null;
  }
}

/**
 * 获取单个在线 Skill 详情
 * @param {string} skillId
 * @returns {Promise<object | null>}
 */
async function getOnlineSkillDetail(skillId) {
  try {
    const url = `${SKILLHUB_URL}/api/v1/skills/${encodeURIComponent(skillId)}`;
    return await httpGet(url);
  } catch (_e) {
    return null;
  }
}

/**
 * 获取在线 Skill 的下载/安装配置
 * @param {string} skillId
 * @returns {Promise<object | null>} 返回 { id, name, code, systemPrompt, config, ... }
 */
async function getSkillInstallConfig(skillId) {
  try {
    const url = `${SKILLHUB_URL}/api/v1/skills/${encodeURIComponent(skillId)}/install`;
    return await httpGet(url);
  } catch (_e) {
    return null;
  }
}

/**
 * 检测已安装在线 Skills 的可用更新
 * @param {Array<{id: string, version?: string}>} installedSkills
 * @returns {Promise<Array<{id: string, currentVersion: string, latestVersion: string, hasUpdate: boolean}>>}
 */
async function checkUpdates(installedSkills = []) {
  if (!installedSkills.length) return [];
  try {
    const ids = installedSkills.map(s => s.id).join(',');
    const url = `${SKILLHUB_URL}/api/v1/skills/check-updates?ids=${encodeURIComponent(ids)}`;
    const data = await httpGet(url);
    return (data && data.updates) ? data.updates : [];
  } catch (_e) {
    return [];
  }
}

/**
 * 搜索在线 Skills（用于管理后台搜索）
 * @param {string} q
 * @param {object} [options]
 * @returns {Promise<Array>}
 */
async function searchOnlineSkills(q, options = {}) {
  try {
    const url = new URL('/api/v1/skills/search', SKILLHUB_URL);
    url.searchParams.set('q', q);
    if (options.category) url.searchParams.set('category', options.category);
    url.searchParams.set('limit', String(options.limit || 20));

    const data = await httpGet(url.toString());
    return (data && data.items) ? data.items : [];
  } catch (_e) {
    return [];
  }
}

/**
 * 获取 SkillHub 热门/推荐 Skills
 * @param {number} [limit=10]
 * @returns {Promise<Array>}
 */
async function getFeaturedSkills(limit = 10) {
  try {
    const url = `${SKILLHUB_URL}/api/v1/skills/featured?limit=${limit}`;
    const data = await httpGet(url);
    return (data && data.items) ? data.items : [];
  } catch (_e) {
    return [];
  }
}

/**
 * 提交社区 Skill（P2 功能预留）
 * @param {object} skillData
 * @returns {Promise<object | null>}
 */
async function submitCommunitySkill(skillData) {
  try {
    const url = `${SKILLHUB_URL}/api/v1/skills/submit`;
    return await httpPost(url, skillData);
  } catch (_e) {
    return null;
  }
}

/**
 * HTTP POST 请求
 * @param {string} urlStr
 * @param {object} body
 * @returns {Promise<object>}
 */
function httpPost(urlStr, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);
    const req = mod.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'WPX-Server/1.0',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: SKILLHUB_TIMEOUT
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch (_e) { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

module.exports = {
  listOnlineSkills,
  getOnlineSkillDetail,
  getSkillInstallConfig,
  checkUpdates,
  searchOnlineSkills,
  getFeaturedSkills,
  submitCommunitySkill
};
