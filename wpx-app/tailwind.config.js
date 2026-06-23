/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--theme-bg)',
        'bg-subtle': 'var(--theme-bg-subtle)',
        'bg-muted': 'var(--theme-bg-muted)',
        fg: 'var(--theme-fg)',
        'fg-muted': 'var(--theme-fg-muted)',
        'fg-subtle': 'var(--theme-fg-subtle)',
        accent: 'var(--theme-accent)',
        'accent-hover': 'var(--theme-accent-hover)',
        'accent-muted': 'var(--theme-accent-muted)',
        border: 'var(--theme-border)',
        surface: 'var(--theme-surface)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--theme-radius-sm)',
        md: 'var(--theme-radius-md)',
        lg: 'var(--theme-radius-lg)',
        xl: 'var(--theme-radius-xl)',
      },
      boxShadow: {
        sm: 'var(--theme-shadow-sm)',
        md: 'var(--theme-shadow-md)',
        lg: 'var(--theme-shadow-lg)',
      },
      keyframes: {
        'save-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        'ai-ring-spin': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'save-blink': 'save-blink 1s ease-in-out infinite',
        'ai-ring': 'ai-ring-spin 2s linear infinite',
      },
    },
  },
}
