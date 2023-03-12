/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./app/**/*.{js,ts,jsx,tsx}'],
	theme: {
		extend: {
			animation: {
				marquee: 'marquee 5s linear infinite',
			},
			keyframes: {
				marquee: {
					'0%': { left: '0' },
					'100%': { left: '-100%' },
				},
			},
		},
	},
	plugins: [],
};
/*
.marquee {
  height: 25px;
  width: 420px;

  overflow: hidden;
  position: relative;
}

.marquee div {
  display: block;
  width: 200%;
  height: 30px;

  position: absolute;
  overflow: hidden;

  animation: marquee 5s linear infinite;
}

.marquee span {
  float: left;
  width: 50%;
}

@keyframes marquee {
  0% { left: 0; }
  100% { left: -100%; }
}*/
