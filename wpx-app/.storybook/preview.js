import { setup } from '@storybook/vue3'
import { createPinia } from 'pinia'
import { withMocks } from '../src/storybook/decorators/withMocks'
import { withTheme } from '../src/storybook/decorators/withTheme'
import '../src/style.css'
import '../src/styles/theme.css'
import '../src/styles/transitions.css'
import 'vue3-draggable-resizable/dist/Vue3DraggableResizable.css'

// Register Pinia globally and expose for decorator use
setup((app) => {
  const pinia = createPinia()
  app.use(pinia)
  window.__wpxPinia = pinia
})

export const decorators = [
  withMocks,
  withTheme,
]

export const parameters = {
  backgrounds: {
    default: 'light',
    values: [
      { name: 'light', value: '#ffffff' },
      { name: 'dark', value: '#1e1e1e' },
      { name: 'subtle', value: '#f8fafc' },
    ],
  },
  controls: {
    expanded: true,
  },
  layout: 'padded',
  theme: 'light',
}
