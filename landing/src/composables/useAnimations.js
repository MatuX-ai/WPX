/**
 * useAnimations.js
 * ------------------------------------------------------------
 * WPX 营销网站 · 通用 GSAP 动画 Composable
 *
 * - 全局注册 ScrollTrigger 插件（仅注册一次）
 * - 提供 fadeIn / slideUp / staggerFade / typewriter 四个常用动画
 * - 自动绑定 onMounted / onBeforeUnmount 生命周期
 * - 离开页面时自动 kill timeline，避免内存泄漏
 *
 * 用法：
 *   const { fadeIn, slideUp, staggerFade, typewriter } = useAnimations()
 *   onMounted(() => fadeIn(refEl, { delay: 0.2 }))
 * ------------------------------------------------------------
 */

import { onBeforeUnmount, onMounted } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// ---------------- 插件注册（全局单例） ----------------
let pluginRegistered = false
function ensurePluginRegistered() {
  if (!pluginRegistered) {
    gsap.registerPlugin(ScrollTrigger)
    pluginRegistered = true
  }
}
ensurePluginRegistered()

// 默认配置
const DEFAULTS = {
  duration: 0.8,
  ease: 'power3.out',
  delay: 0
}

// 元素解析：支持 ref (Ref/HTMLElement) 或 selector string
function resolveEl(target) {
  if (!target) return null
  if (typeof target === 'string') return document.querySelector(target)
  if (target.value) return target.value
  if (target.$el) return target.$el
  return target
}

// 解析一组元素（ref 数组、NodeList、selector）
function resolveAll(target) {
  if (!target) return []
  if (typeof target === 'string') {
    return Array.from(document.querySelectorAll(target))
  }
  if (Array.isArray(target)) {
    return target.map((t) => resolveEl(t)).filter(Boolean)
  }
  if (target.value) {
    const v = target.value
    if (v instanceof NodeList || Array.isArray(v)) {
      return Array.from(v)
    }
    return [v]
  }
  if (target.$el) return [target.$el]
  if (target instanceof NodeList || Array.isArray(target)) {
    return Array.from(target)
  }
  return [target]
}

// ====================================================
//                   动画方法
// ====================================================

/**
 * 淡入
 * @param {Ref|string|HTMLElement} target
 * @param {Object} options { duration, ease, delay, y, x, scrollTrigger }
 */
function fadeIn(target, options = {}) {
  const el = resolveEl(target)
  if (!el) return null
  const { duration, ease, delay, scrollTrigger, ...rest } = {
    ...DEFAULTS,
    ...options
  }
  const vars = {
    opacity: 0,
    duration,
    ease,
    delay,
    ...rest
  }
  if (scrollTrigger) {
    vars.scrollTrigger = scrollTrigger
  } else {
    // 默认：进入视口才播放
    vars.scrollTrigger = {
      trigger: el,
      start: 'top 85%',
      toggleActions: 'play none none reverse'
    }
  }
  const tween = gsap.fromTo(el, { opacity: 0 }, { opacity: 1, ...vars })
  return tween
}

/**
 * 上滑淡入
 */
function slideUp(target, options = {}) {
  const el = resolveEl(target)
  if (!el) return null
  const {
    duration = DEFAULTS.duration,
    ease = DEFAULTS.ease,
    delay = DEFAULTS.delay,
    distance = 40,
    scrollTrigger,
    ...rest
  } = options

  const vars = { opacity: 0, y: distance, duration, ease, delay, ...rest }
  if (scrollTrigger) {
    vars.scrollTrigger = scrollTrigger
  } else {
    vars.scrollTrigger = {
      trigger: el,
      start: 'top 88%',
      toggleActions: 'play none none reverse'
    }
  }
  return gsap.fromTo(el, { opacity: 0, y: distance }, { opacity: 1, y: 0, ...vars })
}

/**
 * 错开淡入：传入子元素集合或父元素（自动取子元素）
 * @param {Ref|string|HTMLElement|Array} target
 * @param {Object} options { stagger, from, distance, ... }
 */
function staggerFade(target, options = {}) {
  const els = resolveAll(target)
  if (!els.length) return null
  const {
    duration = 0.7,
    ease = 'power3.out',
    delay = 0,
    stagger = 0.1,
    distance = 24,
    childSelector = ':scope > *',
    scrollTrigger,
    ...rest
  } = options

  // 若是单个父元素，取它的子元素
  let targets = els
  if (els.length === 1 && childSelector) {
    const parent = els[0]
    if (parent?.querySelectorAll) {
      const children = parent.querySelectorAll(childSelector)
      if (children.length) targets = Array.from(children)
    }
  }

  const vars = {
    opacity: 0,
    y: distance,
    duration,
    ease,
    stagger,
    delay,
    ...rest
  }
  if (scrollTrigger) {
    vars.scrollTrigger = scrollTrigger
  } else {
    vars.scrollTrigger = {
      trigger: targets[0],
      start: 'top 85%',
      toggleActions: 'play none none reverse'
    }
  }
  return gsap.fromTo(
    targets,
    { opacity: 0, y: distance },
    { opacity: 1, y: 0, ...vars }
  )
}

/**
 * 打字机效果
 * - 不依赖付费 TextPlugin
 * - 通过 split + gsap.to 步进实现
 * - 支持光标闪烁
 *
 * @param {Ref|string|HTMLElement} target
 * @param {string|Array<string>} text  - 单字符串或字符串数组（多段依次打出）
 * @param {Object} options
 *   - speed:        每字符间隔秒数（默认 0.04）
 *   - startDelay:   起始延迟
 *   - cursor:       是否显示光标（默认 true）
 *   - cursorChar:   光标字符
 *   - keepCursor:   动画结束后是否保留光标
 *   - onComplete:   全部完成回调
 *   - scrollTrigger: 触发器
 */
function typewriter(target, text, options = {}) {
  const el = resolveEl(target)
  if (!el) return null

  const {
    speed = 0.04,
    startDelay = 0,
    cursor = true,
    cursorChar: cursorCh = '|',
    cursorColor,
    keepCursor = true,
    onComplete,
    scrollTrigger
  } = options

  // 把目标元素包裹一层，把可写文本作为子节点
  const lines = Array.isArray(text) ? text : [text]
  const fullText = lines.join('\n')
  const totalChars = fullText.length

  // 初始化：清空
  el.textContent = ''

  // 预设占位以防高度塌陷
  if (!el.dataset?.wpxTwPlaceholder) {
    const h = el.offsetHeight
    if (h > 0) el.style.minHeight = h + 'px'
    if (el.dataset) el.dataset.wpxTwPlaceholder = '1'
  }

  // 创建文本节点和光标
  const textNode = document.createTextNode('')
  el.appendChild(textNode)

  // 光标
  let cursorEl = null
  if (cursor) {
    cursorEl = document.createElement('span')
    cursorEl.className = 'wpx-typewriter-cursor'
    cursorEl.textContent = cursorCh
    if (cursorColor) cursorEl.style.color = cursorColor
    cursorEl.style.display = 'inline-block'
    cursorEl.style.marginLeft = '2px'
    el.appendChild(cursorEl)

    // 光标闪烁
    gsap.to(cursorEl, {
      opacity: 0,
      duration: 0.5,
      repeat: -1,
      yoyo: true,
      ease: 'power1.inOut'
    })
  }

  // 进度代理对象
  const proxy = { progress: 0 }

  const vars = {
    progress: 1,
    duration: Math.max(0.05, totalChars * speed),
    delay: startDelay,
    ease: 'none',
    onUpdate: function () {
      const p = proxy.progress
      const visibleCount = Math.floor(p * totalChars)
      textNode.data = fullText.slice(0, visibleCount)
    },
    onComplete: () => {
      textNode.data = fullText
      if (!keepCursor && cursorEl?.parentNode) {
        cursorEl.parentNode.removeChild(cursorEl)
      }
      onComplete && onComplete()
    }
  }

  if (scrollTrigger) {
    vars.scrollTrigger = scrollTrigger
  } else {
    vars.scrollTrigger = {
      trigger: el,
      start: 'top 90%',
      toggleActions: 'play none none none'
    }
  }

  // gsap 不允许非数字字段，这里先把 progress 改成 0 再动画到 1
  // 但 progress 是 number 字段，没问题
  return gsap.to(proxy, vars)
}

// ====================================================
//                默认 Composable 导出
// ====================================================
/**
 * useAnimations()
 * 返回所有动画方法 + 自动绑定清理。
 * - 记录所有 timeline/tween，组件卸载时统一 kill
 * - 可在 setup() 中直接调用，方法内部已用 onMounted 包裹
 *
 * 用法：
 *   const { slideUp, staggerFade } = useAnimations()
 *   onMounted(() => {
 *     slideUp(titleRef)
 *     staggerFade(cardsRef.value?.children)
 *   })
 */
export function useAnimations() {
  // 当前组件实例的所有 tweens
  const tweens = []
  const scrollTriggers = []

  const track = (tween) => {
    if (!tween) return tween
    tweens.push(tween)
    if (tween.scrollTrigger) {
      scrollTriggers.push(tween.scrollTrigger)
    }
    return tween
  }

  // 装饰方法
  const wrap = (fn) => (target, options = {}) => {
    // 强制让默认行为推迟到 onMounted 之后执行
    onMounted(() => track(fn(target, options)))
    return null
  }

  onBeforeUnmount(() => {
    tweens.forEach((t) => {
      try {
        t.scrollTrigger && t.scrollTrigger.kill()
        t.kill()
      } catch (e) {
        /* noop */
      }
    })
    scrollTriggers.forEach((st) => {
      try {
        st.kill()
      } catch (e) {
        /* noop */
      }
    })
    tweens.length = 0
    scrollTriggers.length = 0
  })

  return {
    gsap,
    ScrollTrigger,
    /** 直接调用版本（适合放在 onMounted 里） */
    fadeIn: (t, o) => track(fadeIn(t, o)),
    slideUp: (t, o) => track(slideUp(t, o)),
    staggerFade: (t, o) => track(staggerFade(t, o)),
    typewriter: (t, txt, o) => track(typewriter(t, txt, o)),
    /** 自动 onMounted 版本 */
    fadeInOnMount: wrap(fadeIn),
    slideUpOnMount: wrap(slideUp),
    staggerFadeOnMount: wrap(staggerFade),
    typewriterOnMount: typewriter, // 不用 wrap（参数顺序不同）
    /** 工具方法 */
    refresh: () => ScrollTrigger.refresh(),
    killAll: () => {
      tweens.forEach((t) => t.kill())
      scrollTriggers.forEach((st) => st.kill())
      tweens.length = 0
      scrollTriggers.length = 0
    }
  }
}

// 单独导出，方便在普通 JS / 非 setup 上下文使用
export { fadeIn, slideUp, staggerFade, typewriter }

export default useAnimations
