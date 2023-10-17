/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // "./app/**/*.{js,ts,jsx,tsx,mdx}",
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        

        brand: '#ff2c2c',
        text: '#ebecf3',

        background: '#111111',
        'bg-opaque': 'rgb(17, 17, 17, 0.25)',
        'background-light': '#232323',
        'background-dark': '#080808',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
