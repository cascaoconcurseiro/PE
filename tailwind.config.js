import tailwindAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class', // Isso é essencial para o botão de alternar tema funcionar
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
        },
    },
    plugins: [
        tailwindAnimate,
    ],
}