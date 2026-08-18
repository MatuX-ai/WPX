#!/usr/bin/env node
/**
 * scripts/verify-prod.mjs
 *
 * Verify the deployed production marketing site (https://www.prowpx.com)
 * against the 4 viewports used in the local fix verification.
 *
 * Outputs screenshots to i:\WPX\responsive-test-prod\
 */

'use strict'

import { chromium } from 'file:///I:/WPX/wpx-app/node_modules/playwright/index.mjs'
import path from 'node:path'
import fs from 'node:fs'

const URL = process.env.WPX_PREVIEW_URL || 'https://www.prowpx.com/'
const OUT_DIR = 'i:\\WPX\\responsive-test-prod'

fs.mkdirSync(OUT_DIR, { recursive: true })

const VIEWPORTS = [
  { name: 'desktop-1280', width: 1280, height: 800, fullPage: true, openNav: false },
  { name: 'tablet-768',   width: 768,  height: 1024, fullPage: true, openNav: false },
  { name: 'mobile-375',   width: 375,  height: 812, fullPage: true, openNav: false },
  { name: 'mobile-375-nav-open', width: 375, height: 812, fullPage: false, openNav: true }
]

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})

const context = await browser.newContext()
const page = await context.newPage()

for (const vp of VIEWPORTS) {
  console.log(`\n--- ${vp.name} (${vp.width}x${vp.height}) ---`)
  await page.setViewportSize({ width: vp.width, height: vp.height })
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

  if (vp.openNav) {
    const burger = await page.locator('button[aria-label*=menu i], button[aria-controls*=mobile], header button:not([aria-label*=close i])').first()
    try {
      await burger.click({ timeout: 3000 })
      await page.waitForTimeout(700)
    } catch (e) {
      console.warn('  [warn] hamburger click failed:', e.message)
    }
  }

  await page.screenshot({
    path: path.join(OUT_DIR, `${vp.name}.png`),
    fullPage: vp.fullPage
  })
  console.log(`  saved ${vp.name}.png`)

  if (vp.openNav) {
    const overlayItems = await page.locator('.fullscreen-item').count().catch(() => 0)
    const visibleItems = await page.locator('.fullscreen-item:visible').count().catch(() => 0)
    console.log(`  fullscreen-item count = ${overlayItems}, visible = ${visibleItems}`)
  }
}

await browser.close()
console.log(`\n[done] screenshots in ${OUT_DIR}`)
