/** 浮动窗口贴边吸附阈值（px） */
export const FLOATING_WINDOW_EDGE_SNAP = 10

/**
 * @returns {{ width: number, height: number }}
 */
export function getFloatingParentBounds() {
  if (typeof window === 'undefined') {
    return { width: 1200, height: 800 }
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

/**
 * 边缘吸附
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {{ width: number, height: number }} bounds
 * @param {number} [snapThreshold]
 * @param {number} [minTop]
 */
export function snapFloatingWindowPosition(
  x,
  y,
  w,
  h,
  bounds,
  snapThreshold = FLOATING_WINDOW_EDGE_SNAP,
  minTop = 0,
) {
  const maxX = Math.max(0, bounds.width - w)
  const maxY = Math.max(minTop, bounds.height - h)

  let snappedX = x
  let snappedY = y

  if (x <= snapThreshold) {
    snappedX = 0
  } else if (maxX - x <= snapThreshold) {
    snappedX = maxX
  }

  if (y - minTop <= snapThreshold) {
    snappedY = minTop
  } else if (maxY - y <= snapThreshold) {
    snappedY = maxY
  }

  return { x: snappedX, y: snappedY }
}

/**
 * 将浮动窗口约束在父容器内，可选边缘吸附
 * @param {object} params
 * @param {number} params.x
 * @param {number} params.y
 * @param {number} params.w
 * @param {number} params.h
 * @param {number} [params.minW]
 * @param {number} [params.minH]
 * @param {number} [params.minTop]
 * @param {boolean} [params.snap]
 * @param {{ width: number, height: number }} [params.bounds]
 */
export function constrainFloatingWindow({
  x,
  y,
  w,
  h,
  minW = 0,
  minH = 0,
  minTop = 0,
  snap = true,
  bounds = getFloatingParentBounds(),
}) {
  const parentW = Math.max(0, bounds.width)
  const parentH = Math.max(0, bounds.height)
  const availableH = Math.max(minH, parentH - minTop)

  const nextW = Math.min(Math.max(w, minW), parentW)
  const nextH = Math.min(Math.max(h, minH), availableH)

  const maxX = Math.max(0, parentW - nextW)
  const maxY = Math.max(minTop, parentH - nextH)

  let nextX = Math.min(Math.max(0, x), maxX)
  let nextY = Math.min(Math.max(minTop, y), maxY)

  if (snap) {
    const snapped = snapFloatingWindowPosition(
      nextX,
      nextY,
      nextW,
      nextH,
      bounds,
      FLOATING_WINDOW_EDGE_SNAP,
      minTop,
    )
    nextX = Math.min(Math.max(0, snapped.x), maxX)
    nextY = Math.min(Math.max(minTop, snapped.y), maxY)
  }

  return {
    x: nextX,
    y: nextY,
    w: nextW,
    h: nextH,
  }
}
