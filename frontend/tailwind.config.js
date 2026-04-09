/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0F172A',
          card: '#1E293B',
          border: '#334155',
          muted: '#64748B',
        },
        bias: {
          left: '#3B82F6',
          center: '#10B981',
          right: '#EF4444',
        },
        tone: {
          positive: '#22C55E',
          neutral: '#94A3B8',
          negative: '#F97316',
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

