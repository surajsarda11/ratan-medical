import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: { colors: { forest: { 50: '#edf7f1', 100: '#d6ecdf', 600: '#24734c', 700: '#1d5f3e', 800: '#184c33', 900: '#123b28' } } } },
  plugins: [],
};
export default config;
