/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#b7ccff',
          300: '#88a8ff',
          400: '#5d80ff',
          500: '#3a5cf2',
          600: '#2a44cc',
          700: '#23359e',
          800: '#1e2d7a',
          900: '#0f1a4a',
          950: '#070d2b',
        },
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        ink: {
          50: '#f7f8fa',
          100: '#eef0f4',
          200: '#dde1e9',
          300: '#bcc3d1',
          400: '#8a93a6',
          500: '#5e6679',
          600: '#414a5d',
          700: '#2e3543',
          800: '#1f2430',
          900: '#11141c',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 26, 74, 0.04), 0 4px 12px rgba(15, 26, 74, 0.06)',
        card: '0 2px 6px rgba(15, 26, 74, 0.05), 0 12px 24px rgba(15, 26, 74, 0.06)',
        glow: '0 0 0 4px rgba(58, 92, 242, 0.18)',
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(249, 115, 22, 0.6)' },
          '70%': { transform: 'scale(1)', boxShadow: '0 0 0 16px rgba(249, 115, 22, 0)' },
          '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(249, 115, 22, 0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
