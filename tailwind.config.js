/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        valmer: {
          ink: '#1c2733',
          slate: '#2f3e4d',
          sage: '#5b7c6f',
          sand: '#e8e2d6',
          clay: '#c0714f',
          gold: '#c79a4b',
          mist: '#f5f3ee',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Fraunces"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
