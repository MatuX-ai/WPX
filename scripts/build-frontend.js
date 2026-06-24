#!/usr/bin/env node
/**
 * WPX 前端合并构建脚本（Vercel 单 Project 部署专用）
 *
 * 输入（来自两个子项目各自 `npm run build` 的产物）：
 *   - landing/dist/        营销站（根路径）
 *   - admin/dist/          管理后台（base='/admin/'）
 *   - admin/api/proxy.js   Vercel Serverless Function（API 反代）
 *
 * 输出（直接放到项目根，作为 Vercel 部署源）：
 *   - 项目根/
 *       ├── index.html
 *       ├── blog/index.html
 *       ├── about/index.html
 *       ├── assets/...
 *       ├── admin/index.html
 *       ├── admin/assets/...
 *       ├── favicon.svg, robots.txt, sitemap.xml ...
 *       └── api/proxy.js                              ← Vercel Serverless Function
 *
 * 关键点：
 *   - 不用 public/ 作为 outputDirectory，原因：
 *     1. Vercel 设了 outputDirectory 后，部署源就锁死在 outputDirectory 内
 *     2. outputDirectory 内的 .js 文件被 Vercel 当静态资源，不是函数
 *     3. outputDirectory 外的文件（哪怕是 api/proxy.js 在项目根）Vercel 看不见
 *   - 所以产物直接放项目根，配合 .vercelignore 排除源文件
 *
 * 调用方式：
 *   node scripts/build-frontend.js
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

const LANDING_DIR = path.join(ROOT, 'landing');
const ADMIN_DIR = path.join(ROOT, 'admin');

const LANDING_DIST = path.join(LANDING_DIR, 'dist');
const ADMIN_DIST = path.join(ADMIN_DIR, 'dist');
const ADMIN_PROXY_SRC = path.join(ADMIN_DIR, 'api', 'proxy.js');

const SKIP_INSTALL = process.env.WPX_SKIP_INSTALL === '1';

// 每次构建前要清掉的项目根文件/目录（避免上次构建残留）
// 重要：不能写 'admin'！会误删源码 admin/ 目录
// 原因：源码 admin/ 与我们要部署的 admin 构建产物同名，会冲突
// 解决：admin 部署在项目根的 wp-admin/ 下，vercel.json rewrites 负责 /admin 映射
const STALE_PATHS = [
  'index.html', 'index.html.gz', 'index.html.br',
  'favicon.svg', 'browserconfig.xml', 'og-image.svg',
  'robots.txt', 'sitemap.xml',
  'assets', 'blog', 'about',
  'wp-admin', 'api',
];

function log(...args) {
  console.log('[build-frontend]', ...args);
}

function rmrf(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(src, dest, options = {}) {
  const { skip = [] } = options;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.includes(entry.name)) {
      const what = entry.isDirectory() ? '子目录' : entry.isSymbolicLink() ? '符号链接' : '文件';
      log(`  ↳ 跳过${what}：${path.join(src, entry.name)}`);
      continue;
    }
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d, options);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    } else if (entry.isSymbolicLink()) {
      const real = fs.realpathSync(s);
      fs.copyFileSync(real, d);
    }
  }
}

function assertExists(p, label) {
  if (!fs.existsSync(p)) {
    console.error(`[build-frontend] ❌ 缺少构建产物：${label}`);
    console.error(`  期望路径: ${p}`);
    console.error(`  请确认对应子项目的 package.json 中有 "build" 脚本`);
    process.exit(1);
  }
}

function runNpm(prefix, args) {
  const cmd = `npm --prefix "${prefix}" ${args}`;
  log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

function countFiles(dir) {
  let n = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countFiles(path.join(dir, e.name));
    else n++;
  }
  return n;
}

function cleanStale() {
  log('清理上次构建的产物（项目根）');
  for (const p of STALE_PATHS) {
    const full = path.join(ROOT, p);
    if (fs.existsSync(full)) {
      rmrf(full);
      log(`  ↳ 已删除：${p}`);
    }
  }
}

function main() {
  log('========== WPX 前端合并构建开始 ==========');
  log(`仓库根：${ROOT}`);

  // 1. 安装子项目依赖
  if (!SKIP_INSTALL) {
    log('步骤 1/4：安装子项目依赖（installCommand 已执行则可跳过）');
    try {
      runNpm(LANDING_DIR, 'install --no-audit --no-fund');
      runNpm(ADMIN_DIR, 'install --no-audit --no-fund');
    } catch (err) {
      console.error('[build-frontend] ❌ npm install 失败：', err.message);
      process.exit(1);
    }
  } else {
    log('步骤 1/4：跳过 npm install（WPX_SKIP_INSTALL=1）');
  }

  // 2. 构建子项目
  log('步骤 2/4：构建 landing');
  try {
    runNpm(LANDING_DIR, 'run build');
  } catch (err) {
    console.error('[build-frontend] ❌ landing 构建失败：', err.message);
    process.exit(1);
  }

  log('步骤 3/4：构建 admin');
  try {
    runNpm(ADMIN_DIR, 'run build');
  } catch (err) {
    console.error('[build-frontend] ❌ admin 构建失败：', err.message);
    process.exit(1);
  }

  // 3. 校验输入
  assertExists(LANDING_DIST, 'landing/dist');
  assertExists(ADMIN_DIST, 'admin/dist');
  assertExists(ADMIN_PROXY_SRC, 'admin/api/proxy.js');

  // 4. 合并产物到项目根
  log('步骤 4/4：合并构建产物到项目根（Vercel 部署源）');

  cleanStale();

  // landing/dist/* → 项目根/*
  // 排除 dist/server/（Vite SSR 产物，Vercel 静态部署不需要）
  log('  - 复制 landing/dist → 项目根  (跳过 server/ SSR 产物)');
  copyDir(LANDING_DIST, ROOT, { skip: ['server'] });

  // 删除 Netlify/Cloudflare 专属文件
  for (const f of ['_redirects', '_headers']) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      log(`  ↳ 删除 Netlify/Cloudflare 专用文件：${f}`);
    }
  }

  // admin/dist/* → 项目根/wp-admin/*（避免与源码 admin/ 同名冲突）
  log('  - 复制 admin/dist → 项目根/wp-admin/');
  copyDir(ADMIN_DIST, path.join(ROOT, 'wp-admin'));

  // admin/api/proxy.js → 项目根/api/proxy.js（Vercel Serverless Function）
  // 不再放 public/api/，原因：设了 outputDirectory 会与函数检测冲突
  // 这里直接放项目根，配合 vercel.json 去掉 outputDirectory
  log('  - 复制 admin/api/proxy.js → 项目根/api/proxy.js');
  const ROOT_API_DIR = path.join(ROOT, 'api');
  fs.mkdirSync(ROOT_API_DIR, { recursive: true });
  fs.copyFileSync(ADMIN_PROXY_SRC, path.join(ROOT_API_DIR, 'proxy.js'));

  // 5. 打印统计
  log('========== ✅ 构建完成 ==========');
  log('项目根产物：');
  for (const p of STALE_PATHS) {
    if (fs.existsSync(path.join(ROOT, p))) {
      const stat = fs.statSync(path.join(ROOT, p));
      log(`  ${p}${stat.isDirectory() ? '/' : ''}`);
    }
  }
  log('可访问路径：');
  log('  - /                       ← landing 首页');
  log('  - /blog  /about           ← landing 路由');
  log('  - /admin                  ← admin 登录');
  log('  - /api/proxy?path=...     ← 反代到 API_TARGET');
}

main();
