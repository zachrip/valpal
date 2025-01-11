import 'react-router';
import { createRequestHandler } from '@react-router/express';
import express from 'express';

declare module 'react-router' {
	interface AppLoadContext {
		VALUE_FROM_EXPRESS: string;
	}
}

import { AppManager } from './appman';
import { initSkinData } from './valorantApi';

import packageJson from '../package.json';
import axios from 'axios';

declare global {
	var appManager: AppManager;
}

export async function init() {
	await initSkinData();

	global.appManager = new AppManager();

	if (process.env.NODE_ENV === 'production') {
		try {
			const { data } = await axios.get(
				`https://api.github.com/repos/zachrip/valpal/releases/latest`,
			);

			if (data.tag_name !== packageJson.version) {
				global.appManager.notify(
					'Update Available',
					`There's a new version of ValPal available! Please update at: ${data.html_url}`,
				);
			}
		} catch (e) {
			global.appManager.notify(
				'Update Check Failed',
				'Failed to check for updates. ' + e,
			);
		}
	}

	const app = express();

	app.use(
		createRequestHandler({
			// @ts-expect-error - virtual module provided by React Router at build time
			build: () => import('virtual:react-router/server-build'),
			getLoadContext() {
				return {
					VALUE_FROM_EXPRESS: 'Hello from Express',
				};
			},
		}),
	);

	return app;
}
