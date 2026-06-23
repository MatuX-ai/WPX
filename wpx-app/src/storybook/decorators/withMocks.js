import { h } from 'vue'

/**
 * Read parameters.mocks and push to a globally accessible store
 * so singleton mock modules can read reactive overrides per story.
 */
export const withMocks = (storyFn, context) => {
  const mocks = context.parameters?.mocks ?? {}

  return {
    setup() {
      /* Attach a reactive signal bus for mock modules */
      if (typeof window !== 'undefined') {
        if (!window.__wpxMockBus) {
          window.__wpxMockBus = {
            _listeners: [],
            subscribe(fn) {
              this._listeners.push(fn)
              return () => {
                this._listeners = this._listeners.filter((l) => l !== fn)
              }
            },
            publish(payload) {
              this._listeners.forEach((fn) => fn(payload))
            },
          }
        }
        window.__wpxMockBus.publish(mocks)
        window.__wpxMocks = { ...(window.__wpxMocks || {}), ...mocks }
      }

      return () => h(storyFn(context))
    },
  }
}
