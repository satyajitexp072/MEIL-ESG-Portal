/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        meil: {
          blue: '#0B3B60',
          dark: '#082842',
          accent: '#008080',
          green: '#10B981',
          gold: '#D97706',
          sand: '#F8FAFC'
        }
      }
    },
  },
  plugins: [],
}
