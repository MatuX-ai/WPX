import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  constrainFloatingWindow,
  getFloatingParentBounds,
} from '@/composables/floatingWindowBounds'

/**
 * 浮动窗口 composable：初始定位、parentLimitation、窗口 resize 时位置钳制
 * @param {object} config
 * @param {number} config.defaultW
 * @param {number} config.defaultH
 * @param {number} [config.minW]
 * @param {number} [config.minH]
 * @param {(bounds: { width: number, height: number }) => { x: number, y: number }} config.calcInitialPosition
 * @param {() => number} [config.getMinTop]
 */
export function useFloatingWindow(config) {
  const posX = ref(0)
  const posY = ref(0)
  const windowW = ref(config.defaultW)
  const windowH = ref(config.defaultH)

  function getMinTop() {
    return config.getMinTop?.() ?? 0
  }

  function clampPosition(x, y, w, h, options = {}) {
    const result = constrainFloatingWindow({
      x,
      y,
      w,
      h,
      minW: config.minW ?? 0,
      minH: config.minH ?? 0,
      minTop: getMinTop(),
      snap: options.snap ?? false,
      bounds: getFloatingParentBounds(),
    })
    return { x: result.x, y: result.y }
  }

  function applyBounds(options = {}) {
    const result = constrainFloatingWindow({
      x: posX.value,
      y: posY.value,
      w: windowW.value,
      h: windowH.value,
      minW: config.minW ?? 0,
      minH: config.minH ?? 0,
      minTop: getMinTop(),
      snap: options.snap ?? false,
      bounds: getFloatingParentBounds(),
    })
    posX.value = result.x
    posY.value = result.y
    windowW.value = result.w
    windowH.value = result.h
  }

  function initPosition() {
    const bounds = getFloatingParentBounds()
    const position = config.calcInitialPosition(bounds)
    const result = constrainFloatingWindow({
      x: position.x,
      y: position.y,
      w: windowW.value,
      h: windowH.value,
      minW: config.minW ?? 0,
      minH: config.minH ?? 0,
      minTop: getMinTop(),
      snap: false,
      bounds,
    })
    posX.value = result.x
    posY.value = result.y
    windowW.value = result.w
    windowH.value = result.h
  }

  function handleWindowResize() {
    applyBounds({ snap: false })
  }

  onMounted(() => {
    initPosition()
    window.addEventListener('resize', handleWindowResize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleWindowResize)
  })

  return {
    posX,
    posY,
    windowW,
    windowH,
    initPosition,
    clampPosition,
    applyBounds,
  }
}

/**
 * AI 对话窗初始位置：右下角，位于头像上方且不遮挡头像
 * @param {{ width: number, height: number }} bounds
 * @param {{ defaultW: number, defaultH: number, marginRight?: number, avatarGap?: number }} windowConfig
 * @param {{ size: number, marginBottom?: number }} avatarConfig
 * @param {{ minTop?: number }} [options]
 */
export function calcAiChatInitialPosition(bounds, windowConfig, avatarConfig, options = {}) {
  const w = windowConfig.defaultW
  const h = windowConfig.defaultH
  const minTop = options.minTop ?? 0
  const reservedBottom =
    (avatarConfig.marginBottom ?? 20) + avatarConfig.size + (windowConfig.avatarGap ?? 12)

  return {
    x: Math.max(0, bounds.width - w - (windowConfig.marginRight ?? 20)),
    y: Math.max(minTop, bounds.height - h - reservedBottom),
  }
}
