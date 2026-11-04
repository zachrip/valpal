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
	var valpalInitPromise: Promise<void> | undefined;
}

async function loadSkinData() {
	for (let attempt = 1; ; attempt++) {
		try {
			await initSkinData();
			return;
		} catch (e) {
			if (attempt >= 3) {
				throw new Error(
					`Impossible de télécharger les données depuis valorant-api.com (${e}). Vérifiez votre connexion Internet.`,
				);
			}
			console.warn(`valorant-api.com injoignable, nouvel essai (${attempt}/3)...`);
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}
}

// En dev, init() est appelé à chaque requête (rechargement à chaud) :
// on ne télécharge les données et on ne crée l'AppManager qu'une seule fois.
function initOnce() {
	global.valpalInitPromise ??= (async () => {
		await loadSkinData();
		global.appManager = new AppManager();
	})().catch((e) => {
		global.valpalInitPromise = undefined;
		throw e;
	});

	return global.valpalInitPromise;
}

export async function init() {
	const firstInit = !global.valpalInitPromise;
	await initOnce();

	if (firstInit && process.env.NODE_ENV === 'production') {
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
			// @ts-ignore - virtual module provided by React Router at build time
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
