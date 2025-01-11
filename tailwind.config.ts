import type { Config } from 'tailwindcss';

export default {
	content: ['./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}'],
	theme: {},
	plugins: [
		require('tailwind-scrollbar')({
			preferredStrategy: 'pseudoelements',
			nocompatible: true,
		}),
	],
} satisfies Config;
