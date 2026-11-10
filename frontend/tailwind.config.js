/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        temple: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          500: '#f97316',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        sacred: {
          maroon: '#800000',
          gold: '#D4AF37',
          ochre: '#CC7722',
        }
      },
      fontFamily: {
        telugu: ['Noto Sans Telugu', 'sans-serif'],
        english: ['Noto Sans', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
