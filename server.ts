import compression from 'compression';
import express from 'express';
import { readdirSync } from 'fs';
import morgan from 'morgan';
import path from 'path';

(async () => {
	const PORT = Number.parseInt(process.env.PORT || '3000');

	const app = express();

	app.use(compression());
	app.disable('x-powered-by');

	if (process.env.NODE_ENV === 'development') {
		console.log('Starting development server');
		const viteDevServer = await import('vite').then((vite) =>
			vite.createServer({
				server: { middlewareMode: true },
			}),
		);
		app.use(viteDevServer.middlewares);
		app.use(async (req, res, next) => {
			try {
				const source = await viteDevServer.ssrLoadModule('./server/app.ts');
				const server = await source.init();
				return await server(req, res, next);
			} catch (error) {
				if (typeof error === 'object' && error instanceof Error) {
					viteDevServer.ssrFixStacktrace(error);
				}
				next(error);
			}
		});
	} else {
		console.log('Starting production server');
		app.use(
			'/assets',
			express.static(path.join(__dirname, '../build/client/assets'), {
				immutable: true,
				maxAge: '1y',
			}),
		);
		app.use(
			express.static(path.join(__dirname, '../build/client'), { maxAge: '1h' }),
		);
		// @ts-ignore
		const server = await import('./build/server/index.js');
		app.use(await server.init());
	}

	app.use(morgan('tiny'));

	app.listen(PORT, () => {
		console.log(`Server is running on http://localhost:${PORT}`);
	});
})();
