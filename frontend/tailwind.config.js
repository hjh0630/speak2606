/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 调和蓝梯度(2026-06-09 确立,源自黑白蓝撞色图)
        brand: {
          50: '#D6E1E7',   // 图·极浅
          100: '#C7D6E0',  // 插值
          200: '#ABC9D5',  // 图·浅
          300: '#8FBAC9',  // 插值
          400: '#73ABBC',  // 图·中
          500: '#1F8FB3',  // 图·强蓝(品牌标志色)
          600: '#1A7DA0',  // hover
          700: '#14598D',  // 图·深海军
          800: '#0F4670',  // 插值
          900: '#0A3454',  // 插值
          950: '#062238',  // 最深
        },
        // 暖桃强调(保留一个暖色,交互清晰;500 拉深一档保 WCAG AA)
        accent: {
          50: '#FDF5EF',
          100: '#FCEADC',
          200: '#F9D5BB',
          300: '#F5BC95',
          400: '#F0A878',  // 用户选定的暖桃
          500: '#D17F50',  // CTA 主色/按钮 bg
          600: '#B6683D',  // hover
          700: '#8E4E2D',
          800: '#5F341E',
          900: '#3A2014',
        },
        // 冷调灰(中级档位 +5% 蓝调,与新蓝梯度协调)
        ink: {
          50: '#f6f8fb',
          100: '#ecf0f6',
          200: '#d8dee9',
          300: '#b5bfd1',
          400: '#8590a8',
          500: '#586475',
          600: '#3c4859',
          700: '#2a3142',
          800: '#1c2230',
          900: '#0e121b',
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
        soft: '0 1px 2px rgba(10, 52, 84, 0.04), 0 4px 12px rgba(10, 52, 84, 0.06)',
        card: '0 2px 6px rgba(10, 52, 84, 0.05), 0 12px 24px rgba(10, 52, 84, 0.06)',
        glow: '0 0 0 4px rgba(31, 143, 179, 0.18)',  // brand.500 透明
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(209, 127, 80, 0.6)' },   // accent.500
          '70%': { transform: 'scale(1)', boxShadow: '0 0 0 16px rgba(209, 127, 80, 0)' },
          '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(209, 127, 80, 0)' },
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
