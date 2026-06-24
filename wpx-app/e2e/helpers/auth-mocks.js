/**
 * E2E 认证 / 访客 / 免费额度 mock
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
 *   guestQuota?: { limit?: number, used?: number, remaining?: number },
 *   userQuota?: { limit?: number, used?: number, remaining?: number },
 *   quotaExhausted?: boolean,
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
  const guestQuota = {
    limit: options.guestQuota?.limit ?? 0,
    used: options.guestQuota?.used ?? 0,
    remaining:
      options.guestQuota?.remaining ??
      Math.max(0, (options.guestQuota?.limit ?? 0) - (options.guestQuota?.used ?? 0)),
  }
  const userQuota = {
    limit: options.userQuota?.limit ?? 100_000_000,
    used: options.userQuota?.used ?? 0,
    remaining:
      options.userQuota?.remaining ??
      Math.max(
        0,
        (options.userQuota?.limit ?? 100_000_000) - (options.userQuota?.used ?? 0),
      ),
  }
  const quotaExhausted = Boolean(options.quotaExhausted)

  await page.addInitScript(
    ({
      user,
      tokens,
      guestQuota,
      userQuota,
      quotaExhausted,
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

      function getTodayKey() {
        return new Date().toISOString().slice(0, 10)
      }

      function isLoggedIn() {
        return Boolean(storedCredentials?.token)
      }

      function buildSubjectKey() {
        if (isLoggedIn()) {
          return `user:${user.id}`
        }
        let deviceId = localStorage.getItem('wpx-device-id') || ''
        if (!deviceId) {
          deviceId = crypto.randomUUID()
          localStorage.setItem('wpx-device-id', deviceId)
        }
        return `guest:${deviceId}`
      }

      function readTokenUsage() {
        const key = 'wpx-free-quota-web'
        const subjectKey = buildSubjectKey()
        try {
          const raw = localStorage.getItem(key)
          const parsed = raw ? JSON.parse(raw) : {}
          const row = parsed[subjectKey]
          const today = getTodayKey()
          if (!row || row.date !== today) return 0
          return Number(row.tokensUsed) || 0
        } catch {
          return 0
        }
      }

      function writeTokenUsage(tokensUsed) {
        const key = 'wpx-free-quota-web'
        const subjectKey = buildSubjectKey()
        const today = getTodayKey()
        try {
          const raw = localStorage.getItem(key)
          const parsed = raw ? JSON.parse(raw) : {}
          parsed[subjectKey] = { date: today, tokensUsed }
          localStorage.setItem(key, JSON.stringify(parsed))
        } catch {
          // ignore
        }
      }

      function getActiveQuotaConfig() {
        if (isLoggedIn()) {
          return userQuota
        }
        return guestQuota
      }

      function buildQuotaStatus() {
        const config = getActiveQuotaConfig()
        const used = quotaExhausted ? config.limit : readTokenUsage()
        const remaining = Math.max(0, config.limit - used)
        return {
          ok: true,
          isGuest: !isLoggedIn(),
          limit: config.limit,
          used,
          remaining,
          unit: 'token',
          subjectKey: buildSubjectKey(),
        }
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
        freeQuota: {
          getStatus: async () => buildQuotaStatus(),
          check: async () => {
            const status = buildQuotaStatus()
            if (status.limit <= 0 || status.remaining <= 0) {
              return {
                ok: false,
                code: 'FREE_QUOTA_EXHAUSTED',
                ...status,
              }
            }
            return {
              ok: true,
              ...status,
            }
          },
          consumeTokens: async (payload = {}) => {
            const tokens = Math.max(0, Math.ceil(Number(payload.tokens) || 0))
            const status = buildQuotaStatus()
            if (tokens === 0) {
              return { ok: true, consumed: 0, ...status }
            }
            const nextUsed = status.used + tokens
            writeTokenUsage(nextUsed)
            const refreshed = buildQuotaStatus()
            return {
              ok: true,
              consumed: tokens,
              ...refreshed,
            }
          },
          resetDeviceId: async () => {
            const oldDeviceId = localStorage.getItem('wpx-device-id') || ''
            const newDeviceId = crypto.randomUUID()
            if (oldDeviceId) {
              try {
                const raw = localStorage.getItem('wpx-free-quota-web')
                const parsed = raw ? JSON.parse(raw) : {}
                delete parsed[`guest:${oldDeviceId}`]
                localStorage.setItem('wpx-free-quota-web', JSON.stringify(parsed))
              } catch {
                // ignore
              }
            }
            localStorage.setItem('wpx-device-id', newDeviceId)
            return { ok: true, deviceId: newDeviceId, previousDeviceId: oldDeviceId || null }
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
      guestQuota,
      userQuota,
      quotaExhausted,
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
  const guestQuota = {
    limit: options.guestQuota?.limit ?? 0,
    used: options.guestQuota?.used ?? 0,
    remaining:
      options.guestQuota?.remaining ??
      Math.max(0, (options.guestQuota?.limit ?? 0) - (options.guestQuota?.used ?? 0)),
  }
  const userQuota = {
    limit: options.userQuota?.limit ?? 100_000_000,
    used: options.userQuota?.used ?? 0,
    remaining:
      options.userQuota?.remaining ??
      Math.max(
        0,
        (options.userQuota?.limit ?? 100_000_000) - (options.userQuota?.used ?? 0),
      ),
  }
  const quotaExhausted = Boolean(options.quotaExhausted)
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
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          token: tokens.access,
          refresh_token: tokens.refresh,
          user: { ...user, email: body?.email || user.email },
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

  // AI 子域改为 ai.prowpx.com
  await page.route('**/ai.prowpx.com/api/free/quota', async (route) => {
    const activeQuota = userQuota.limit > 0 ? userQuota : guestQuota
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        limit: activeQuota.limit,
        remaining: quotaExhausted ? 0 : activeQuota.remaining,
        used: quotaExhausted ? activeQuota.limit : activeQuota.used,
        unit: 'token',
      }),
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
 * 在 AuthModal 中填写注册信息并提交。
 * @param {import('@playwright/test').Page} page
 * @param {{ email?: string, password?: string, nickname?: string }} [options]
 */
export async function registerThroughAuthModal(page, options = {}) {
  const email = options.email ?? 'new-user@prowpx.com'
  const password = options.password ?? 'e2e-password'
  const nickname = options.nickname ?? 'E2E 注册用户'

  await clickTitleBarLogin(page)
  await expectAuthModal(page)
  await switchAuthModalToRegister(page)

  await page.locator('.auth-modal input[type="email"]').fill(email)
  await page
    .locator('.auth-modal input[autocomplete="nickname"]')
    .fill(nickname)
  await page.locator('.auth-modal input[type="password"]').fill(password)
  await page
    .locator('.auth-modal')
    .getByRole('button', { name: '注册账号' })
    .click()

  await expectTitleBarLoggedIn(page, nickname)
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