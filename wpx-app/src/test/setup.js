import { config } from '@vue/test-utils'
import { vi } from 'vitest'

config.global.stubs = {
  transition: false,
  transitionGroup: false,
}

if (!window.scrollBy) {
  window.scrollBy = vi.fn()
}

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = vi.fn()
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn()
}

function createMockRect() {
  return {
    top: 0,
    left: 0,
    bottom: 20,
    right: 100,
    width: 100,
    height: 20,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }
}

function createClientRectList() {
  const rects = [createMockRect()]
  rects.item = (index) => rects[index] ?? null
  return rects
}

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => createClientRectList()
}

if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => createMockRect()
}

if (!Element.prototype.getClientRects) {
  Element.prototype.getClientRects = function getClientRects() {
    return createClientRectList()
  }
}

if (!Element.prototype.getBoundingClientRect) {
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (typeof originalGetBoundingClientRect === 'function') {
      try {
        const rect = originalGetBoundingClientRect.call(this)
        if (rect) return rect
      } catch {
        // jsdom may throw for detached nodes
      }
    }
    return createMockRect()
  }
}

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}
