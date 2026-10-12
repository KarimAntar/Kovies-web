/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#0E0D13',
        card: {
          DEFAULT: '#1A173E',
          hover: '#241E4A',
        },
        primary: {
          DEFAULT: '#7B5BF5',
          hover: '#997FF9',
        },
        imdb: '#F6C700',
        surface: {
          950: '#0A090F',
          900: '#0E0D13',
          850: '#131122',
          800: '#1A173E',
          750: '#201A45',
          700: '#241E4A',
          600: '#322A63',
        }
      },
      fontFamily: {
        title: ['"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
