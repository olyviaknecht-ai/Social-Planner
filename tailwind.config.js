/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        valmer: {
          ink: '#181225', // deep plum-black for text
          slate: '#544f6b', // muted violet-grey for secondary text
          sage: '#14b8a6', // teal accent (selected, success, focus)
          sand: '#efe9fb', // light lavender placeholder
          clay: '#ec4899', // pink — primary accent
          gold: '#8b5cf6', // violet — secondary accent
          mist: '#faf7ff', // light cool panel/modal background
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
