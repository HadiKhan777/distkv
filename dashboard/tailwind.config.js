export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#080808',
        surface: '#0f0f0f',
        border:  'rgba(240,239,232,0.07)',
        accent:  '#C8FF00',
        cyan:    '#00D4FF',
        muted:   '#4a4a46',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body:    ['Outfit', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
