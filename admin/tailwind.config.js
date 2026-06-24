/** @type {import('tailwindcss').Config} */
// 与 landing 项目共享品牌色配置（蓝紫渐变 + 强调色）
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // WPX 品牌色：蓝紫渐变（与 landing 一致）
        primary: {
          DEFAULT: '#3B53E0',
          from: '#2563EB',
          via: '#4F46E5',
          to: '#7C3AED',
          50: '#EEF2FF',
          100: '#E0E7FF',
          500: '#4F46E5',
          600: '#4338CA',
          700: '#3730A3'
        },
        accent: {
          yellow: '#FBBF24',
          mint: '#34D399'
        },
        dark: '#1E1E1E',
        light: '#FAFAFA'
      },
      fontFamily: {
        sans: [
          'Inter',
          '"Noto Sans SC"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'system-ui',
          'sans-serif'
        ],
        display: [
          'Inter',
          '"Noto Sans SC"',
          'system-ui',
          'sans-serif'
        ]
      },
      backgroundImage: {
        'wpx-gradient':
          'linear-gradient(135deg, #2563EB 0%, #4F46E5 50%, #7C3AED 100%)',
        'wpx-gradient-soft':
          'linear-gradient(135deg, rgba(37,99,235,0.10) 0%, rgba(124,58,237,0.10) 100%)'
      },
      boxShadow: {
        wpx: '0 10px 30px -10px rgba(79, 70, 229, 0.35)',
        'wpx-glow':
          '0 0 0 1px rgba(124, 58, 237, 0.15), 0 12px 40px -8px rgba(37, 99, 235, 0.35)'
      }
    }
  },
  plugins: []
}