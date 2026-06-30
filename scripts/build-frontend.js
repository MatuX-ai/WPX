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
// Admin 后端 handler（Vercel Function，源在项目根 api/admin/handler.js）

// Vercel 项目 Dashboard 持久配置了 outputDirectory: "public"
// 所有构建产物必须放在 public/ 下，包括 api/proxy.js（Serverless Function）
// 使用 module.exports.config 替代 functions 字段，绕过 CLI 54.10.2+ glob 匹配回归
const PUBLIC_DIR = path.join(ROOT, 'public');

const SKIP_INSTALL = process.env.WPX_SKIP_INSTALL === '1';

// 每次构建前要清掉的 public/ 下旧产物（避免上次构建残留）
// 注意：不能写 'admin'！会误删源码 admin/ 目录
const STALE_PATHS = [
  'index.html', 'index.html.gz', 'index.html.br',
  'favicon.svg', 'browserconfig.xml', 'og-image.svg',
  'robots.txt', 'sitemap.xml',
  'assets', 'blog', 'about',
  'admin', 'admin.html', 'api',
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
  log('清理上次构建的产物（public/）');
  for (const p of STALE_PATHS) {
    const full = path.join(PUBLIC_DIR, p);
    if (fs.existsSync(full)) {
      rmrf(full);
      log(`  ↳ 已删除：${p}`);
    }
  }
  // 确保 public/ 目录存在
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
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

  // 4. 合并产物到 public/（Vercel outputDirectory 要求）
  log('步骤 4/4：合并构建产物到 public/（Vercel outputDirectory');

  cleanStale();

  // 创建 public/ 目录
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  // landing/dist/* → public/*
  // 排除 dist/server/（Vite SSR 产物，Vercel 静态部署不需要）
  log('  - 复制 landing/dist → public/  (跳过 server/ SSR 产物)');
  copyDir(LANDING_DIST, PUBLIC_DIR, { skip: ['server'] });

  // 删除 Netlify/Cloudflare 专属文件
  for (const f of ['_redirects', '_headers']) {
    const p = path.join(PUBLIC_DIR, f);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      log(`  ↳ 删除 Netlify/Cloudflare 专用文件：${f}`);
    }
  }

  // admin/dist/* → public/admin/*（SPA 入口，/admin/ 时触发 directory index）
  log('  - 复制 admin/dist → public/admin/');
  copyDir(ADMIN_DIST, path.join(PUBLIC_DIR, 'admin'));

  // 额外复制 admin/index.html → public/admin.html，让 /admin（无斜杠）也能直接访问
  // 因为 vercel.json 的 rewrite 规则在当前项目中未生效，
  // 需要依靠 cleanUrls 自动匹配 /admin → /admin.html
  const adminHtmlSrc = path.join(ADMIN_DIST, 'index.html');
  const adminHtmlDest = path.join(PUBLIC_DIR, 'admin.html');
  if (fs.existsSync(adminHtmlSrc)) {
    fs.copyFileSync(adminHtmlSrc, adminHtmlDest);
    log('  ↳ 额外复制 admin/index.html → public/admin.html（备用）');
  }

  // ⚠️ Vercel 项目中 rewrites 规则不生效（已知问题）。
  //    为 admin SPA 的顶层路由生成物理 HTML 文件，让 /admin/users 这种路径
  //    能被 Vercel 当作静态文件返回 admin SPA 入口，再由 vue-router 客户端处理。
  //    若遗漏新路由，在 admin SPA 访问该路径时会得到 404。
  const ADMIN_SPA_ROUTES = [
    'login', 'dashboard', 'users', 'fonts', 'skills', 'orders', 'announcements',
    'settings', 'logs', 'feedbacks', 'forbidden',
    'users/visitors', 'models', 'models/monitor', 'fonts/stats',
    'skills/builtin', 'skills/online', 'skills/community',
    'orders/recharge', 'orders/consumption', 'orders/revenue',
    'announcements/versions',
    'settings/basic', 'settings/cdn', 'settings/admins'
  ];
  for (const route of ADMIN_SPA_ROUTES) {
    const destDir = path.join(PUBLIC_DIR, 'admin', route);
    const destFile = path.join(destDir, 'index.html');
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(adminHtmlSrc, destFile);
  }
  log(`  ↳ 为 admin SPA 顶层路由生成物理 HTML（${ADMIN_SPA_ROUTES.length} 个路由）`);

  // admin/api/proxy.js → 项目根 api/proxy.js（Vercel Serverless Function 入口）
  // Vercel 默认从项目根 api/ 扫描 Function（不受 outputDirectory 影响）。
  // 同时复制到 public/api/proxy.js 作为老配置的兼容占位。
  log('  - 复制 admin/api/proxy.js → 项目根 api/proxy.js（Vercel Function）');
  const ROOT_API_DIR = path.join(ROOT, 'api');
  fs.mkdirSync(ROOT_API_DIR, { recursive: true });
  fs.copyFileSync(ADMIN_PROXY_SRC, path.join(ROOT_API_DIR, 'proxy.js'));

  log('  - 复制 admin/api/proxy.js → public/api/proxy.js（兼容占位）');
  const PUBLIC_API_DIR = path.join(PUBLIC_DIR, 'api');
  fs.mkdirSync(PUBLIC_API_DIR, { recursive: true });
  fs.copyFileSync(ADMIN_PROXY_SRC, path.join(PUBLIC_API_DIR, 'proxy.js'));

  // Admin 后端 handler → public/api/admin/handler.js（Vercel Function 入口）
  // 项目根 api/admin/handler.js 已是源文件，Vercel 默认从项目根 api/ 扫描 Function。
  // 但 Dashboard 配了 outputDirectory: public，所以需要同步一份到 public/api/admin/handler.js。
  const ROOT_ADMIN_HANDLER = path.join(ROOT, 'api', 'admin', 'handler.js');
  if (fs.existsSync(ROOT_ADMIN_HANDLER)) {
    log('  - 复制 api/admin/handler.js → public/api/admin/handler.js（Vercel Function）');
    const PUBLIC_ADMIN_API_DIR = path.join(PUBLIC_DIR, 'api', 'admin');
    fs.mkdirSync(PUBLIC_ADMIN_API_DIR, { recursive: true });
    fs.copyFileSync(ROOT_ADMIN_HANDLER, path.join(PUBLIC_ADMIN_API_DIR, 'handler.js'));
  } else {
    log('  ! api/admin/handler.js 不存在，跳过复制（后续 deploy 可能报 404）');
  }

  // Admin 后端 server/ → public/api/admin/server/（与 handler.js 同目录）
  // handler.js 在 /var/task/api/admin/handler.js 中 require(__dirname/server/app.js)，
  // 搜索路径从 __dirname 向上 6 层，因此放在 /var/task/server/、/var/task/api/server/ 等
  // 任意层级都能找到。但因为 .vercelignore 里的 server/** 白名单不适用于 outputDirectory
  // 下的文件（只适用于项目根），且 Vercel Function 容器不递归把 public/ 子目录当函数打包，
  // 我们把 server/ 放在 handler.js 的同目录 public/api/admin/server/ 下，保证 0 层就能定位。
  //
  // 跳�?
  //   - node_modules  → Vercel installCommand 已跑 npm install --prefix server，依赖自动注入
  //   - .env / .env.example → 敏感信息 + 示例文件，运行时用 Vercel Dashboard 环境变量
  //   - Dockerfile / docker-compose.yml / nginx / ecosystem.config.cjs → 独立服务器部署用
  //   - DEPLOY.md / README.md / scripts / __tests__ → 与 Vercel 部署无关
  const ROOT_SERVER = path.join(ROOT, 'server');
  const PUBLIC_SERVER = path.join(PUBLIC_DIR, 'api', 'admin', 'server');
  if (fs.existsSync(ROOT_SERVER)) {
    log('  - 复制 server/ → public/api/admin/server/（同 handler.js 目录，保证 0 层定位）');
    copyDir(ROOT_SERVER, PUBLIC_SERVER, {
      skip: [
        'node_modules',
        '.env', '.env.example', '.env.local', '.env.production',
        'Dockerfile', 'docker-compose.yml', 'nginx',
        'ecosystem.config.cjs', 'ecosystem.config.js',
        'DEPLOY.md', 'README.md',
        'scripts',
        '__tests__'
      ]
    });
  } else {
    log('  ! server/ 不存在，跳过复制（后端将无法启动）');
  }

  // 5. 打印统计
  log('========== ✅ 构建完成 ==========');
  log('public/ 产物：');
  for (const p of STALE_PATHS) {
    if (fs.existsSync(path.join(PUBLIC_DIR, p))) {
      const stat = fs.statSync(path.join(PUBLIC_DIR, p));
      log(`  ${p}${stat.isDirectory() ? '/' : ''}`);
    }
  }
  log(' 可访问路径：');
  log('  - /                       ← landing 首页');
  log('  - /blog  /about           ← landing 路由');
  log('  - /admin                  ← admin 登录');
  log('  - /api/proxy?path=...     ← 反代到 API_TARGET');
}

main();
