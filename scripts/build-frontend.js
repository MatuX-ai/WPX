#!/usr/bin/env node
/**
 * WPX 前端合并构建脚本（Vercel 单 Project 部署专用）
 *
 * 输入（来自两个子项目各自 `npm run build` 的产物）：
 *   - landing/dist/        营销站（根路径）
 *   - admin/dist/          管理后台（base='/admin/'）
 *   - admin/api/proxy.js   Vercel Serverless Function（API 反代）
 *
 * 输出（Vercel 部署目录）：
 *   - public/
 *       ├── index.html, blog.html, about.html ...   ← landing 全部产物
 *       ├── assets/, favicon.svg ...                ← landing 静态资源
 *       └── admin/
 *           ├── index.html                          ← admin SPA 入口
 *           └── assets/...                          ← admin 静态资源
 *   - api/
 *       └── proxy.js                                ← Vercel 自动识别为函数
 *
 * 调用方式：
 *   node scripts/build-frontend.js
 *
 * 行为：
 *   1. 安装 landing + admin 子项目依赖（Vercel installCommand 已设，这里跳过）
 *   2. 串行执行两个子项目 npm run build
 *   3. 把 dist 产物复制到仓库根的 public/ + api/
 *   4. 清理目标目录，避免上次构建残留
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const API_DIR = path.join(ROOT, 'api');

const LANDING_DIR = path.join(ROOT, 'landing');
const ADMIN_DIR = path.join(ROOT, 'admin');

const LANDING_DIST = path.join(LANDING_DIR, 'dist');
const ADMIN_DIST = path.join(ADMIN_DIR, 'dist');
const ADMIN_PROXY_SRC = path.join(ADMIN_DIR, 'api', 'proxy.js');

const SKIP_INSTALL = process.env.WPX_SKIP_INSTALL === '1';

function log(...args) {
  console.log('[build-frontend]', ...args);
}

function rmrf(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else if (entry.isFile()) {
      // .map 源文件如果 landing 产出了 sourcemap 一并复制（debug 用）
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

function main() {
  log('========== WPX 前端合并构建开始 ==========');
  log(`仓库根：${ROOT}`);

  // 1. 安装子项目依赖（通常 Vercel installCommand 已做过；这里兜底）
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

  // 4. 合并产物
  log('步骤 4/4：合并构建产物到 public/ + api/');

  rmrf(PUBLIC_DIR);
  rmrf(API_DIR);
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(API_DIR, { recursive: true });

  // landing/dist/* → public/*
  log('  - 复制 landing/dist → public/');
  copyDir(LANDING_DIST, PUBLIC_DIR);

  // admin/dist/* → public/admin/*
  log('  - 复制 admin/dist → public/admin/');
  copyDir(ADMIN_DIST, path.join(PUBLIC_DIR, 'admin'));

  // admin/api/proxy.js → api/proxy.js（Vercel 自动识别）
  log('  - 复制 admin/api/proxy.js → api/proxy.js');
  fs.copyFileSync(ADMIN_PROXY_SRC, path.join(API_DIR, 'proxy.js'));

  // 5. 打印统计
  const publicFiles = countFiles(PUBLIC_DIR);
  log('========== ✅ 构建完成 ==========');
  log(`public/  共 ${publicFiles} 个文件（含 landing + admin）`);
  log(`api/proxy.js 已就位（Vercel Serverless Function）`);
  log('可访问路径：');
  log('  - /                       ← landing 首页');
  log('  - /blog  /about           ← landing 路由');
  log('  - /admin                  ← admin 登录');
  log('  - /api/proxy?path=...     ← 反代到 API_TARGET');
}

main();
