/**
 * E2E 认证 / 访客 mock
 *
 * 适配 WPX 自托管邮箱认证（prowpx.com）：
 * - 不再模拟打开外部浏览器（移除 auth.startLogin / auth.onCallback）
 * - 直接 mock `https://prowpx.com/api/auth/*` 网络接口
 * - E2E 测试中点击登录会弹出嵌入式 AuthModal，提交后由路由 mock 返回登录态
 * - AI 子域改为 `https://ai.prowpx.com`
 */
import { expect } from '@playwright/test'

/**
 * @typedef {{
 *   id: string,
 *   nickname: string,
 *   avatar?: string,
 *   email?: string
 * }} AuthUserPayload
 *
 * @typedef {{
 *   access: string,
 *   refresh: string
 * }} TokenPair
 *
 * @typedef {{
 *   user?: AuthUserPayload,
 *   tokens?: TokenPair,
 *   refreshValid?: boolean,
 *   withFonts?: boolean,
 *   loginShouldFail?: boolean,
 *   loginErrorMessage?: string
 * }} SetupAuthOptions
 */

/** @param {SetupAuthOptions} [options] */
export async function setupAuthE2eMocks(page, options = {}) {
  await setupAuthInitScript(page, options)
  await setupAuthAccountRoutes(page, options)
}

/**
 * 在浏览器环境注入 electronAPI + 凭据存储桩
 * @param {import('@playwright/test').Page} page
 * @param {SetupAuthOptions} [options]
 */
async function setupAuthInitScript(page, options = {}) {
  const user = options.user ?? {
    id: 'e2e-user-1',
    nickname: 'E2E 测试用户',
    avatar: '',
    email: 'e2e@prowpx.com',
  }
  const tokens = options.tokens ?? {
    access: 'e2e-access-token',
    refresh: 'e2e-refresh-token',
  }

  await page.addInitScript(
    ({
      user,
      tokens,
      withFonts,
      loginShouldFail,
      loginErrorMessage,
    }) => {
      /** @type {{ token: string, refreshToken: string } | null} */
      let storedCredentials = null
      const storageKey = 'wpx-e2e-auth-credentials'

      try {
        const raw = sessionStorage.getItem(storageKey)
        if (raw) {
          storedCredentials = JSON.parse(raw)
        }
      } catch {
        storedCredentials = null
      }

      function persistCredentials() {
        if (!storedCredentials) {
          sessionStorage.removeItem(storageKey)
          return
        }
        sessionStorage.setItem(storageKey, JSON.stringify(storedCredentials))
      }

      window.__WPX_E2E_AUTH__ = {
        user,
        tokens,
        lastLoginPayload: null,
        lastRegisterPayload: null,
        loginShouldFail: Boolean(loginShouldFail),
        loginErrorMessage: loginErrorMessage || '账号或密码错误',
      }

      const baseApi = window.electronAPI || {}

      window.electronAPI = {
        ...baseApi,
        processType: 'renderer',
        platform: 'win32',
        localServer: {
          getBaseUrl: () => Promise.resolve(window.location.origin),
          ...(baseApi.localServer || {}),
        },
        auth: {
          getToken: async () =>
            storedCredentials
              ? {
                  token: storedCredentials.token,
                  refreshToken: storedCredentials.refreshToken,
                }
              : { token: '', refreshToken: '' },
          storeToken: async (payload) => {
            storedCredentials = {
              token: String(payload?.token || '').trim(),
              refreshToken: String(payload?.refreshToken || '').trim(),
            }
            persistCredentials()
            return { ok: true }
          },
          clearToken: async () => {
            storedCredentials = null
            persistCredentials()
            return { ok: true }
          },
        },
        models: {
          ...(baseApi.models || {}),
          testConnection: async () => ({
            ok: true,
            message: '连接成功，模型服务可用',
          }),
        },
      }

      if (withFonts && !window.electronAPI.fonts) {
        window.electronAPI.fonts = {
          getAll: async () => ({ ok: true, fonts: [] }),
          getCommercialList: async () => ({
            ok: true,
            fonts: [
              {
                id: 'founder-lanting-hei',
                name: '方正兰亭黑',
                category: '黑体',
                vendor: '方正字库',
                price_per_char: 1,
              },
            ],
          }),
          getPreferences: async () => ({ ok: true, disabledFontIds: [] }),
          decryptPreview: async ({ fontId }) => ({
            ok: true,
            tempPath: `C:/WPX/temp/${fontId}.ttf`,
          }),
        }
      }
    },
    {
      user,
      tokens,
      withFonts: Boolean(options.withFonts),
      loginShouldFail: Boolean(options.loginShouldFail),
      loginErrorMessage: options.loginErrorMessage || '',
    },
  )
}

/**
 * mock prowpx.com / ai.prowpx.com 上的网络接口。
 * 须在 setupE2eMocks 之后调用，避免被 `/api/**` 兜底路由覆盖。
 * @param {import('@playwright/test').Page} page
 * @param {SetupAuthOptions} [options]
 */
export async function setupAuthAccountRoutes(page, options = {}) {
  const user = options.user ?? {
    id: 'e2e-user-1',
    nickname: 'E2E 测试用户',
    avatar: '',
    email: 'e2e@prowpx.com',
  }
  const tokens = options.tokens ?? {
    access: 'e2e-access-token',
    refresh: 'e2e-refresh-token',
  }
  const refreshValid = options.refreshValid !== false
  const loginShouldFail = Boolean(options.loginShouldFail)
  const loginErrorMessage = options.loginErrorMessage || '账号或密码错误'

  // 兜底：记录每次网络请求，便于排查。
  await page.route('**/prowpx.com/**', async (route) => {
    const request = route.request()
    const url = request.url()
    const method = request.method()

    // POST /api/auth/login
    if (url.includes('/api/auth/login') && method === 'POST') {
      let body = null
      try {
        body = JSON.parse(request.postData() || '{}')
      } catch {
        body = {}
      }
      // 记录最近一次登录请求体（测试可读取 window.__WPX_E2E_AUTH__.lastLoginPayload）
      await route
        .request()
        ?.frame?.page?.()
        ?.evaluate?.(
          (payload) => {
            const auth = window.__WPX_E2E_AUTH__
            if (auth) auth.lastLoginPayload = payload
          },
          body,
        )
        .catch(() => {})

      if (loginShouldFail) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: loginErrorMessage }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: tokens.access,
          refresh_token: tokens.refresh,
          user,
        }),
      })
      return
    }

    // POST /api/auth/register
    if (url.includes('/api/auth/register') && method === 'POST') {
      let body = null
      try {
        body = JSON.parse(request.postData() || '{}')
      } catch {
        body = {}
      }
      const nickname =
        String(body?.nickname || '').trim() ||
        String(body?.email || user.email || '').split('@')[0] ||
        user.nickname
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          token: tokens.access,
          refresh_token: tokens.refresh,
          user: {
            ...user,
            email: body?.email || user.email,
            nickname,
          },
        }),
      })
      return
    }

    // POST /api/auth/refresh
    if (url.includes('/api/auth/refresh') && method === 'POST') {
      if (!refreshValid) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'refresh_token 已过期' }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: tokens.access,
          refresh_token: tokens.refresh,
          user,
        }),
      })
      return
    }

    // GET /api/auth/me
    if (url.includes('/api/auth/me') && method === 'GET') {
      const authHeader = request.headers().authorization || ''
      if (!authHeader.includes(tokens.access)) {
        await route.fulfill({ status: 401, body: '{}' })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user }),
      })
      return
    }

    // POST /api/auth/logout
    if (url.includes('/api/auth/logout') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
      return
    }

    // POST /api/auth/forgot-password
    if (url.includes('/api/auth/forgot-password') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
      return
    }

    // POST /api/auth/reset-password
    if (url.includes('/api/auth/reset-password') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
      return
    }

    // GET /api/auth/verify-email
    if (url.includes('/api/auth/verify-email') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, user }),
      })
      return
    }

    // 兜底：成功响应以便测试容错
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

}

/**
 * 点击 TitleBar 的「登录」按钮。
 * @param {import('@playwright/test').Page} page
 */
export async function clickTitleBarLogin(page) {
  await page.locator('.title-bar').getByRole('button', { name: '登录', exact: true }).click()
}

/**
 * 嵌入式登录：在 AuthModal 中填写邮箱+密码并提交，等待登录完成。
 * @param {import('@playwright/test').Page} page
 * @param {{ email?: string, password?: string, nickname?: string }} [options]
 */
export async function loginThroughTitleBar(page, options = {}) {
  const email = options.email ?? 'e2e@prowpx.com'
  const password = options.password ?? 'e2e-password'
  const nickname = options.nickname ?? 'E2E 测试用户'

  await clickTitleBarLogin(page)
  await expectAuthModal(page)

  await page.locator('.auth-modal input[type="email"]').fill(email)
  await page.locator('.auth-modal input[type="password"]').fill(password)
  await page
    .locator('.auth-modal')
    .getByRole('button', { name: '登录', exact: true })
    .click()

  await expectTitleBarLoggedIn(page, nickname)
}

/**
 * 在 AuthModal 中切换到「注册」标签。
 * @param {import('@playwright/test').Page} page
 */
export async function switchAuthModalToRegister(page) {
  await page.locator('.auth-modal').getByRole('button', { name: '立即注册' }).click()
}

/**
 * 在已打开的 AuthModal 注册表单中填写并提交（不再重复点击 TitleBar 登录）。
 * @param {import('@playwright/test').Page} page
 * @param {{ email?: string, password?: string, nickname?: string }} [options]
 */
export async function submitRegisterFormInAuthModal(page, options = {}) {
  const email = options.email ?? 'new-user@prowpx.com'
  const password = options.password ?? 'e2e-password'
  const nickname = options.nickname ?? 'E2E 注册用户'

  await page.locator('.auth-modal input[type="email"]').fill(email)
  await page.locator('.auth-modal input[autocomplete="nickname"]').fill(nickname)
  await page.locator('.auth-modal input[type="password"]').fill(password)
  await page.locator('.auth-modal').getByRole('button', { name: '注册账号' }).click()

  await expectTitleBarLoggedIn(page, nickname)
}

/**
 * 在 AuthModal 中填写注册信息并提交。
 * @param {import('@playwright/test').Page} page
 * @param {{ email?: string, password?: string, nickname?: string }} [options]
 */
export async function registerThroughAuthModal(page, options = {}) {
  await clickTitleBarLogin(page)
  await expectAuthModal(page)
  await switchAuthModalToRegister(page)
  await submitRegisterFormInAuthModal(page, options)
}

/**
 * 关闭 AuthModal（不登录）。
 * @param {import('@playwright/test').Page} page
 */
export async function dismissAuthModal(page) {
  await page.locator('.auth-modal').getByRole('button', { name: '关闭' }).click()
  await expect(page.locator('.auth-modal')).toHaveCount(0, { timeout: 5_000 })
}

/**
 * 断言 AuthModal 已显示。
 * @param {import('@playwright/test').Page} page
 */
export async function expectAuthModal(page) {
  await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 10_000 })
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} nickname
 */
export async function expectTitleBarLoggedIn(page, nickname) {
  await expect(page.getByRole('button', { name: `${nickname} 账户菜单` })).toBeVisible({
    timeout: 15_000,
  })
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function logoutThroughTitleBar(page) {
  const userMenuButton = page.getByRole('button', { name: /账户菜单$/ })
  await userMenuButton.click()
  const logoutItem = page.getByRole('menuitem', { name: '退出登录' })
  await expect(logoutItem).toBeVisible()
  await logoutItem.click()
  await expect(
    page.locator('.title-bar').getByRole('button', { name: '登录', exact: true }),
  ).toBeVisible({ timeout: 15_000 })
}

/**
 * 测试桩：直接关闭 AuthModal 模拟"用户取消登录"。
 * @param {import('@playwright/test').Page} page
 */
export async function simulateAuthCancel(page) {
  await dismissAuthModal(page)
}