/**
 * useEasterEggs.js
 * ------------------------------------------------------------
 * WPX 营销站 · 彩蛋中心（单例 Composable）
 *
 * 架构：
 *  - 全局单例（模块级状态）
 *  - 注册 API：register(egg)
 *  - 触发 API：trigger(id, payload)
 *  - 持久标记：triggered Set，避免重复触发（oneTime 选项）
 *
 * 内置彩蛋：
 *  1) logo-7tap      连击 Logo 7 次 → 贪吃蛇小游戏
 *  2) konami-code    ↑↑↓↓←→←→BA → 复古对话框 + 像素背景
 *  3) unicorn        浮动独角兽图标 → 问候语
 *  4) download-hover 免费下载按钮 hover 文案池
 * ------------------------------------------------------------
 */
import { ref, reactive, computed, h, render, onBeforeUnmount } from 'vue'

/* =========================================================
 *  全局状态（单例）
 * ========================================================= */
const _registry = new Map()        // id -> egg
const _triggered = reactive(new Set()) // 已触发的彩蛋 id（持久）
const activeEggId = ref('')         // 当前激活的彩蛋
const lastEvent = ref(null)         // 最近触发事件

/**
 * 通用注册
 * @param {Object} egg { id, name?, description?, oneTime=true, onTrigger?(payload) }
 */
function register(egg) {
  if (!egg || !egg.id) {
    console.warn('[useEasterEggs] egg 必须有 id')
    return () => {}
  }
  if (_registry.has(egg.id)) {
    console.warn(`[useEasterEggs] 彩蛋 "${egg.id}" 已注册，跳过`)
    return () => _registry.delete(egg.id)
  }
  _registry.set(egg.id, {
    oneTime: true,
    ...egg
  })
  return () => _registry.delete(egg.id)
}

/**
 * 触发某个彩蛋
 * @param {string} id
 * @param {any} payload
 */
function trigger(id, payload = null) {
  const egg = _registry.get(id)
  if (!egg) {
    console.warn(`[useEasterEggs] 未注册彩蛋: ${id}`)
    return false
  }
  // oneTime 检查
  if (egg.oneTime && _triggered.has(id)) {
    return false
  }
  // 触发
  lastEvent.value = { id, at: Date.now(), payload }
  activeEggId.value = id
  _triggered.add(id)
  if (typeof egg.onTrigger === 'function') {
    try {
      egg.onTrigger(payload)
    } catch (e) {
      console.error(`[useEasterEggs] 触发 "${id}" 出错:`, e)
    }
  }
  return true
}

function close() {
  activeEggId.value = ''
}

function isTriggered(id) {
  return _triggered.has(id)
}

/* =========================================================
 *  公共工具
 * ========================================================= */
function $(selector) {
  return document.querySelector(selector)
}

function createOverlay() {
  // 创建覆盖层（用于游戏画布 / 像素背景 / 对话框）
  let el = document.getElementById('__wpx_egg_host')
  if (!el) {
    el = document.createElement('div')
    el.id = '__wpx_egg_host'
    document.body.appendChild(el)
  }
  return el
}

function removeOverlay() {
  const el = document.getElementById('__wpx_egg_host')
  // 安全：innerHTML = '' 仅用于清空容器，不涉及用户输入
  if (el) el.innerHTML = ''
}

/* =========================================================
 *  内置彩蛋 1：Logo 连击 7 次 → 贪吃蛇
 * ========================================================= */
function setupLogoTapEgg({ selector = '#wpx-nav-logo', taps = 7, windowMs = 1500 } = {}) {
  let count = 0
  let lastAt = 0
  let timer = null

  function onClick(e) {
    const target = e.target instanceof Element
      ? e.target.closest(selector)
      : null
    if (!target) return
    const now = Date.now()
    if (now - lastAt > windowMs) count = 0
    lastAt = now
    count++
    clearTimeout(timer)
    timer = setTimeout(() => { count = 0 }, windowMs)

    if (count >= taps) {
      count = 0
      trigger('logo-7tap', { taps })
    }
  }

  document.addEventListener('click', onClick, true)
  return () => {
    document.removeEventListener('click', onClick, true)
    clearTimeout(timer)
  }
}

/* =========================================================
 *  内置彩蛋 2：Konami Code → 复古对话框 + 像素背景
 * ========================================================= */
const KONAMI_SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a'
]

function setupKonamiEgg() {
  let cursor = 0
  function onKeydown(e) {
    const want = KONAMI_SEQUENCE[cursor]
    // 兼容大小写
    const got = e.key.length === 1 ? e.key.toLowerCase() : e.key
    if (got === want || got === want.toLowerCase()) {
      cursor++
      if (cursor >= KONAMI_SEQUENCE.length) {
        cursor = 0
        trigger('konami-code')
      }
    } else {
      cursor = 0
    }
  }
  window.addEventListener('keydown', onKeydown)
  return () => window.removeEventListener('keydown', onKeydown)
}

/* =========================================================
 *  内置彩蛋 3：独角兽图标（浮动 + 点击提示）
 * ========================================================= */
const UNICORN_PHRASES = [
  '你发现了一只独角兽！WPX 祝你今天愉快。',
  '🦄 独角兽说：少熬夜，多写稿。',
  '🦄 等等，这匹马怎么会有角？',
  '恭喜触发稀有事件！奖励：一杯咖啡 ☕',
  '🦄 它朝你眨了眨眼，然后跑掉了…'
]

function setupUnicornEgg() {
  function onClick(e) {
    const target = e.target instanceof Element
      ? e.target.closest('#wpx-unicorn-icon')
      : null
    if (!target) return
    const phrase = UNICORN_PHRASES[Math.floor(Math.random() * UNICORN_PHRASES.length)]
    trigger('unicorn', { phrase })
  }
  document.addEventListener('click', onClick, true)
  return () => document.removeEventListener('click', onClick, true)
}

/* =========================================================
 *  内置彩蛋 4：下载按钮 hover 文案池
 * ========================================================= */
const DOWNLOAD_HOVER_TEXTS = [
  '别犹豫，又不要钱',
  '给 WPS 最后一次机会？',
  'Windows 用户请猛击',
  'Mac 用户也有的',
  '真的不收钱（重要的话说三遍）',
  '600KB · 装完即用 · 不绑 C 盘',
  '👉 下载之后别忘了回来告诉我好不好用',
  'Linux 用户狂喜版：AppImage 一键跑',
  '据说是清华某位同学做了 18 个月的结果'
]

function getDownloadHoverText() {
  return DOWNLOAD_HOVER_TEXTS[Math.floor(Math.random() * DOWNLOAD_HOVER_TEXTS.length)]
}

/* =========================================================
 *  UI 渲染：贪吃蛇小游戏
 * ========================================================= */
function renderSnakeGame() {
  const host = createOverlay()
  host.innerHTML = ''

  const CELL = 18                          // 每格像素
  const COLS = Math.min(40, Math.floor(window.innerWidth / CELL))
  const ROWS = 10                          // 底部条高度 10 格
  const NEED = 10                          // 吃够 10 个胜利
  const INTERVAL_MS = 120                  // 蛇移动速度

  let snake = [{ x: 5, y: Math.floor(ROWS / 2) }, { x: 4, y: Math.floor(ROWS / 2) }, { x: 3, y: Math.floor(ROWS / 2) }]
  let dir = 'right'
  let pendingDir = 'right'
  let food = null
  let score = 0
  let timer = null
  let done = false

  function placeFood() {
    while (true) {
      const f = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
      if (!snake.some(s => s.x === f.x && s.y === f.y)) {
        food = f
        return
      }
    }
  }
  placeFood()

  // 容器：固定底部
  // 安全：以下 innerHTML 使用均来自硬编码 HTML 模板，不包含用户可控输入
  const stage = document.createElement('div')
  stage.className = 'wpx-snake-stage'
  stage.innerHTML = `
    <div class="wpx-snake-hud">
      <span>🎮 开发者模式</span>
      <span class="wpx-snake-score">弹窗: <b>0</b> / ${NEED}</span>
      <button class="wpx-snake-close" aria-label="关闭">×</button>
    </div>
    <div class="wpx-snake-grid" style="--cols:${COLS};--rows:${ROWS}"></div>
  `
  host.appendChild(stage)

  const grid = stage.querySelector('.wpx-snake-grid')
  const scoreEl = stage.querySelector('.wpx-snake-score b')
  const closeBtn = stage.querySelector('.wpx-snake-close')

  function paint() {
    const cells = []
    // 食物
    if (food) {
      cells.push(`<span class="wpx-snake-cell wpx-snake-food" style="grid-column:${food.x + 1};grid-row:${food.y + 1}">📢</span>`)
    }
    // 蛇
    snake.forEach((seg, i) => {
      cells.push(`<span class="wpx-snake-cell ${i === 0 ? 'wpx-snake-head' : 'wpx-snake-body'}" style="grid-column:${seg.x + 1};grid-row:${seg.y + 1}">${i === 0 ? '🐍' : ''}</span>`)
    })
    // 安全：cells 数组中的所有值均来自游戏内部状态（纯数字坐标），无用户输入
    grid.innerHTML = cells.join('')
    scoreEl.textContent = String(score)
  }
  paint()

  function step() {
    if (done) return
    dir = pendingDir
    const head = { ...snake[0] }
    if (dir === 'up') head.y -= 1
    else if (dir === 'down') head.y += 1
    else if (dir === 'left') head.x -= 1
    else if (dir === 'right') head.x += 1

    // 撞墙：结束
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      finish()
      return
    }
    // 撞自己：结束
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      finish()
      return
    }
    snake.unshift(head)
    if (food && head.x === food.x && head.y === food.y) {
      score++
      if (score >= NEED) {
        finish(true)
        return
      }
      placeFood()
    } else {
      snake.pop()
    }
    paint()
  }
  timer = setInterval(step, INTERVAL_MS)

  function onKey(e) {
    const k = e.key
    if (k === 'ArrowUp' && dir !== 'down') pendingDir = 'up'
    else if (k === 'ArrowDown' && dir !== 'up') pendingDir = 'down'
    else if (k === 'ArrowLeft' && dir !== 'right') pendingDir = 'left'
    else if (k === 'ArrowRight' && dir !== 'left') pendingDir = 'right'
    else if (k === 'Escape') finish()
  }
  window.addEventListener('keydown', onKey)

  function finish(win) {
    done = true
    clearInterval(timer)
    window.removeEventListener('keydown', onKey)
    if (win) {
      showAchievement('你已消灭 10 个广告弹窗！', () => {
        removeOverlay()
        close()
      })
    } else {
      // 安全：score 是内部游戏数字变量，无 XSS 风险
      grid.innerHTML = `<div class="wpx-snake-gameover">💥 GAME OVER<br /><small>得分: ${score} / ${NEED}</small><br /><button class="wpx-snake-retry">再来一次</button></div>`
      const retry = grid.querySelector('.wpx-snake-retry')
      retry?.addEventListener('click', () => renderSnakeGame())
    }
  }
  closeBtn.addEventListener('click', () => { clearInterval(timer); removeOverlay(); close() })
}

function showAchievement(text, onClose) {
  // 安全：text 参数来自硬编码字符串（如 '你已消灭 10 个广告弹窗！'），不包含用户输入
  const host = createOverlay()
  const box = document.createElement('div')
  box.className = 'wpx-achievement'
  box.innerHTML = `
    <div class="wpx-achievement-inner">
      <div class="wpx-achievement-icon">🏆</div>
      <div class="wpx-achievement-title">成就解锁</div>
      <div class="wpx-achievement-text">${text}</div>
      <button class="wpx-achievement-btn">收下</button>
    </div>
  `
  host.appendChild(box)
  const btn = box.querySelector('.wpx-achievement-btn')
  const close = () => {
    box.classList.add('wpx-achievement-leave')
    setTimeout(() => {
      box.remove()
      onClose && onClose()
    }, 240)
  }
  btn.addEventListener('click', close)
  setTimeout(close, 4500)
}

/* =========================================================
 *  UI 渲染：Konami 对话框 + 像素背景
 * ========================================================= */
function renderKonamiDialog() {
  const host = createOverlay()

  // 像素背景层
  const pixelBg = document.createElement('div')
  pixelBg.className = 'wpx-pixel-bg'
  host.appendChild(pixelBg)

  // 8-bit 对话框
  // 安全：innerHTML 内容完全硬编码，无用户输入
  const dlg = document.createElement('div')
  dlg.className = 'wpx-konami-dialog'
  dlg.innerHTML = `
    <div class="wpx-konami-titlebar">
      <span class="wpx-konami-titlebar-dot" style="background:#ff5f56"></span>
      <span class="wpx-konami-titlebar-dot" style="background:#ffbd2e"></span>
      <span class="wpx-konami-titlebar-dot" style="background:#27c93f"></span>
      <span class="wpx-konami-titlebar-text">SYSTEM 32 v0.1</span>
    </div>
    <div class="wpx-konami-body">
      <div class="wpx-konami-big">秘籍激活！</div>
      <div class="wpx-konami-line">所有字体已解锁（开玩笑的）</div>
      <div class="wpx-konami-line wpx-konami-small">▶ Press [ENTER] to continue_</div>
    </div>
  `
  host.appendChild(dlg)

  function close() {
    pixelBg.classList.add('wpx-pixel-bg-leave')
    dlg.classList.add('wpx-konami-leave')
    setTimeout(() => { removeOverlay(); close() }, 320)
  }
  function onKey(e) {
    if (e.key === 'Enter' || e.key === 'Escape') {
      window.removeEventListener('keydown', onKey)
      close()
    }
  }
  window.addEventListener('keydown', onKey)
  dlg.addEventListener('click', () => { window.removeEventListener('keydown', onKey); close() })
  setTimeout(() => { window.removeEventListener('keydown', onKey); close() }, 5500)
}

/* =========================================================
 *  UI 渲染：独角兽浮动提示
 * ========================================================= */
function renderUnicornToast(payload) {
  const host = createOverlay()
  const box = document.createElement('div')
  box.className = 'wpx-unicorn-toast'
  // 安全：payload.phrase 来自硬编码 UNICORN_PHRASES 数组（line 174），无 XSS 风险
  box.innerHTML = `
    <span class="wpx-unicorn-emoji">🦄</span>
    <span class="wpx-unicorn-text">${payload?.phrase || '你发现了一只独角兽！WPX 祝你今天愉快。'}</span>
    <button class="wpx-unicorn-close" aria-label="关闭">×</button>
  `
  host.appendChild(box)
  const close = () => {
    box.classList.add('wpx-unicorn-toast-leave')
    setTimeout(() => { box.remove(); close() }, 280)
  }
  box.querySelector('.wpx-unicorn-close').addEventListener('click', close)
  setTimeout(close, 4500)
}

/* =========================================================
 *  注入静态 DOM：独角兽小图标（右下角）
 * ========================================================= */
function mountUnicornIcon() {
  // 避免重复挂载
  if (document.getElementById('wpx-unicorn-icon')) return
  const wrap = document.createElement('button')
  wrap.id = 'wpx-unicorn-icon'
  wrap.type = 'button'
  wrap.className = 'wpx-unicorn-fab'
  wrap.setAttribute('aria-label', '神秘彩蛋')
  wrap.title = '神秘彩蛋'
  // 安全：innerHTML 为纯静态 Unicode emoji，无用户输入
  wrap.innerHTML = `<span aria-hidden="true">🦄</span>`
  document.body.appendChild(wrap)
}

/* =========================================================
 *  注册内置彩蛋
 * ========================================================= */
function registerDefaults() {
  // 1) Logo 连击 → 贪吃蛇
  register({
    id: 'logo-7tap',
    name: '开发者模式',
    description: '连击 Logo 7 次',
    oneTime: false,
    onTrigger: () => renderSnakeGame()
  })
  // 2) Konami → 复古对话框
  register({
    id: 'konami-code',
    name: 'Konami Code',
    description: '↑↑↓↓←→←→BA',
    oneTime: false,
    onTrigger: () => renderKonamiDialog()
  })
  // 3) 独角兽
  register({
    id: 'unicorn',
    name: '独角兽彩蛋',
    description: '右下角隐藏的小独角兽',
    oneTime: false,
    onTrigger: (payload) => renderUnicornToast(payload)
  })
}

/* =========================================================
 *  Composable 入口
 * ========================================================= */
export function useEasterEggs(options = {}) {
  const { autoSetup = true, mountUi = true } = options

  if (autoSetup && typeof window !== 'undefined') {
    // 注册内置彩蛋
    registerDefaults()
    // 安装事件监听（每个只装一次）
    if (!window.__wpxEggSetup) {
      window.__wpxEggSetup = true
      setupLogoTapEgg()
      setupKonamiEgg()
      setupUnicornEgg()
    }
    // 挂载独角兽图标
    if (mountUi) mountUnicornIcon()
  }

  // 卸载钩子
  function dispose() {
    // 监听器用全局 once 标记，这里仅清空注册表
    _registry.clear()
  }

  return {
    // 注册 API
    register,
    trigger,
    close,
    isTriggered,
    // 状态
    activeEggId,
    lastEvent,
    triggeredIds: computed(() => Array.from(_triggered)),
    // 下载按钮 hover 文案
    getDownloadHoverText,
    downloadHoverTexts: DOWNLOAD_HOVER_TEXTS,
    // 卸载
    dispose
  }
}

/* =========================================================
 *  默认导出（全局单例调用）
 * ========================================================= */
export default useEasterEggs