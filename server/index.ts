import path from 'path';

import axios from 'axios';
import express from 'express';
import compression from 'compression';
import morgan from 'morgan';
import { createRequestHandler } from '@remix-run/express';

import { AppManager } from './appman';
import { initSkinData } from './valorantApi';

import packageJson from '../package.json';

declare global {
	var appManager: AppManager;
}

(async () => {
	await initSkinData();

	global.appManager = new AppManager();

	try {
		const { data } = await axios.get(
			`https://api.github.com/repos/zachrip/valpal/releases/latest`
		);

		if (data.tag_name !== packageJson.version) {
			global.appManager.notify(
				'Update Available',
				`There's a new version of ValPal available! Please update at: ${data.html_url}`
			);
		}
	} catch (e) {
		global.appManager.notify(
			'Update Check Failed',
			'Failed to check for updates. ' + e
		);
	}

	const BUILD_DIR = path.join(__dirname, '../build');

	const app = express();

	app.use(compression());

	// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
	app.disable('x-powered-by');

	// Remix fingerprints its assets so we can cache forever.
	app.use(
		'/build',
		express.static(path.resolve(__dirname, '../public/build'), {
			immutable: true,
			maxAge: '1y',
		})
	);

	// Everything else (like favicon.ico) is cached for an hour. You may want to be
	// more aggressive with this caching.
	app.use(
		express.static(path.resolve(__dirname, '../public'), { maxAge: '1h' })
	);

	app.use(morgan('tiny'));

	app.all(
		'*',
		process.env.NODE_ENV === 'development'
			? (req, res, next) => {
					purgeRequireCache();

					return createRequestHandler({
						build: require(BUILD_DIR),
						mode: process.env.NODE_ENV,
					})(req, res, next);
			  }
			: createRequestHandler({
					build: require(BUILD_DIR),
					mode: process.env.NODE_ENV,
			  })
	);
	const port = process.env.PORT || 3000;

	app.listen(port, () => {
		console.log(`Express server listening on port ${port}`);
	});

	function purgeRequireCache() {
		// purge require cache on requests for "server side HMR" this won't let
		// you have in-memory objects between requests in development,
		// alternatively you can set up nodemon/pm2-dev to restart the server on
		// file changes, but then you'll have to reconnect to databases/etc on each
		// change. We prefer the DX of this, so we've included it for you by default
		for (const key in require.cache) {
			if (key.startsWith(BUILD_DIR)) {
				delete require.cache[key];
			}
		}
	}
})();
