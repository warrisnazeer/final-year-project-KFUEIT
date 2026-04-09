/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#F7F4EF',
          card: '#FFFFFF',
          border: '#E4D9C8',
          muted: '#8C7B6B',
        },
        gold: {
          DEFAULT: '#C8973A',
          light: '#FDF3E0',
          mid:   '#DDB96A',
          dark:  '#9A6F2A',
        },
        bias: {
          left: '#2563EB',
          center: '#C8973A',
          right: '#DC2626',
        },
        tone: {
          positive: '#16A34A',
          neutral:  '#8C7B6B',
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

