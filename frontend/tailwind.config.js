/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#F6FAFF',
          card: '#FFFFFF',
          border: '#D8E3F2',
          muted: '#5B6B83',
        },
        accent: {
          cyan: '#06B6D4',
          sky: '#0EA5E9',
          lime: '#84CC16',
          coral: '#F97316',
          violet: '#7C3AED',
        },
        bias: {
          left: '#2563EB',
          center: '#14B8A6',
          right: '#DC2626',
        },
        tone: {
          positive: '#16A34A',
          neutral: '#64748B',
          negative: '#EA580C',
        },
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.no-scrollbar::-webkit-scrollbar': { display: 'none' },
        '.no-scrollbar': { '-ms-overflow-style': 'none', 'scrollbar-width': 'none' },
      })
    },
  ],
}

