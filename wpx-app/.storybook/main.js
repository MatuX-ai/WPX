import { fileURLToPath, URL } from 'node:url'

export default {
  stories: ['../src/**/*.stories.@(js|ts)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  docs: { autodocs: false },
  core: { disableTelemetry: true },
  typescript: { reactDocgen: false },
  viteFinal(config) {
    config.resolve = config.resolve || {}
    // Storybook-specific aliases MUST come BEFORE the global @ alias
    // so exact path matches take priority over the catch-all @/ → ./src/ match.
    config.resolve.alias = [
      // 1. vue3-draggable-resizable: keep the existing vite.config.js shim
      {
        find: /^vue3-draggable-resizable$/,
        replacement: fileURLToPath(
          new URL('../src/shims/vue3-draggable-resizable.js', import.meta.url),
        ),
      },
      // 2. Storybook mock overrides (exact path regex – higher priority than @ alias)
      {
        find: /^@\/composables\/useFloatingWindows$/,
        replacement: fileURLToPath(
          new URL('../src/storybook/mocks/useFloatingWindows.mock.js', import.meta.url),
        ),
      },
      {
        find: /^@vueuse\/integrations\/useFocusTrap$/,
        replacement: fileURLToPath(
          new URL('../src/storybook/mocks/useFocusTrap.mock.js', import.meta.url),
        ),
      },
      // 3. Original vite.config.js aliases (re-added manually to control priority)
      { find: '@', replacement: fileURLToPath(new URL('../src', import.meta.url)) },
    ]
    return config
  },
}
