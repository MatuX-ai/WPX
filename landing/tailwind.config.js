/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // WPX 品牌色：蓝紫渐变
        primary: {
          DEFAULT: '#3B53E0',
          from: '#2563EB', // blue-600
          via: '#4F46E5', // indigo-600
          to: '#7C3AED', // violet-600
          50: '#EEF2FF',
          100: '#E0E7FF',
          500: '#4F46E5',
          600: '#4338CA',
          700: '#3730A3'
        },
        // WPX 强调色
        accent: {
          yellow: '#FBBF24', // amber-400
          mint: '#34D399'    // emerald-400
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
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease infinite'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' }
        }
      }
    }
  },
  plugins: []
}
