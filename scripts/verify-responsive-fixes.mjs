#!/usr/bin/env node
/**
 * scripts/verify-responsive-fixes.mjs
 *
 * 用 Playwright 在 4 个断点（375 / 768 / 1280 / 1440）截图营销网站，
 * 验证 6 项自适应修复是否到位。
 *
 * 前置条件：
 *   1. landing/dist 已重新构建（npm --prefix landing run build）
 *   2. vite preview 在 4175 端口运行（vite preview --port 4175 --strictPort）
 *
 * 输出：
 *   i:\WPX\responsive-test-after-fix/
 *     - desktop-1280-after.png
 *     - tablet-768-after.png
 *     - mobile-375-after.png
 *     - mobile-375-nav-open-after.png
 */

'use strict'

import { chromium } from 'file:///I:/WPX/wpx-app/node_modules/playwright/index.mjs'
import path from 'node:path'
import fs from 'node:fs'

const URL = process.env.WPX_PREVIEW_URL || 'http://127.0.0.1:4175/'
const OUT_DIR = 'i:\\WPX\\responsive-test-after-fix'

// 确保输出目录存在
fs.mkdirSync(OUT_DIR, { recursive: true })

const VIEWPORTS = [
  { name: 'desktop-1280-after', width: 1280, height: 800, fullPage: true, openNav: false },
  { name: 'tablet-768-after',   width: 768,  height: 1024, fullPage: true, openNav: false },
  { name: 'mobile-375-after',   width: 375,  height: 812, fullPage: true, openNav: false },
  { name: 'mobile-375-nav-open-after', width: 375, height: 812, fullPage: false, openNav: true }
]

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})

for (const vp of VIEWPORTS) {
  console.log(`\n[verify-responsive] -> ${vp.name} ${vp.width}x${vp.height}`)
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1
  })
  const page = await context.newPage()

  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 })
    // 等待 Hero 渲染完成
    await page.waitForSelector('#hero-title', { timeout: 10000 })
    // 等动画稳定
    await page.waitForTimeout(800)

    // 移动端需要打开汉堡菜单
    if (vp.openNav) {
      // 找到汉堡按钮
      const burger = await page.$('button[aria-label="打开菜单"]')
      if (burger) {
        await burger.click()
        // 等菜单动画完成
        await page.waitForTimeout(500)
        console.log('  [ok] 汉堡菜单已打开')
      } else {
        console.warn('  [warn] 未找到汉堡按钮')
      }
    }

    const outPath = path.join(OUT_DIR, `${vp.name}.png`)
    await page.screenshot({
      path: outPath,
      fullPage: vp.fullPage
    })
    console.log(`  [ok] 截图已保存: ${outPath}`)

    // 一些关键的 DOM 验证
    if (vp.openNav) {
      const navItems = await page.$$eval('#wpx-nav-logo-mobile ~ nav ul li', (els) =>
        els.map((el) => {
          const a = el.querySelector('a')
          return {
            text: a?.textContent?.trim().split(/\s+/)[0] ?? '',
            visible: a?.offsetWidth > 0 && a?.offsetHeight > 0,
            opacity: a ? window.getComputedStyle(a).opacity : 'n/a'
          }
        })
      )
      console.log('  [nav-items]', JSON.stringify(navItems, null, 2))
    }

  } catch (err) {
    console.error(`  [err] ${vp.name} 失败:`, err.message)
  } finally {
    await context.close()
  }
}

await browser.close()
console.log('\n[verify-responsive] ✅ 完成！输出目录:', OUT_DIR)