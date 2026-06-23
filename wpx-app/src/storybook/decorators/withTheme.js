import { h } from 'vue'
import { useThemeStore } from '@/stores/theme'

/**
 * Read theme from context.parameters.theme and wrap story in <div data-theme="...">
 * so CSS variables apply. Also sync Pinia themeStore so components like AiChatWindow
 * respond to isDark.
 */
export const withTheme = (storyFn, context) => {
  const theme = context.parameters?.theme || context.globals?.theme || 'light'

  // Sync Pinia theme store with the selected theme
  if (typeof window !== 'undefined' && window.__wpxPinia) {
    try {
      const store = useThemeStore(window.__wpxPinia)
      store.setTheme(theme === 'dark' ? 'dark' : 'light')
    } catch {
      // Pinia not ready yet — will fall back to data-theme CSS only
    }
  }

  return {
    setup() {
      return () =>
        h(
          'div',
          {
            'data-theme': theme,
            class: `story-theme-root story-theme-root--${theme}`,
            style: {
              minHeight: '100vh',
              padding: '24px',
              background: theme === 'dark' ? '#1e1e1e' : '#ffffff',
              color: theme === 'dark' ? '#e0e0e0' : '#0f172a',
            },
          },
          [h(storyFn(context))],
        )
    },
  }
}
