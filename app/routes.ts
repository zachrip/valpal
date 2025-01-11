import {
	type RouteConfig,
	index,
	layout,
	prefix,
	route,
} from '@react-router/dev/routes';

export default [
	index('routes/index.tsx'),
	route('/login', 'routes/login.tsx'),
	...prefix('loadouts', [
		index('routes/loadouts/index.tsx'),
		route(':loadoutId', 'routes/loadouts/$loadoutId.tsx', [
			route(
				'playercards/add',
				'routes/loadouts/$loadoutId/playercards/add.tsx',
			),
			route(
				'playertitles/add',
				'routes/loadouts/$loadoutId/playertitles/add.tsx',
			),
			...prefix('expressions', [
				route('top', 'routes/loadouts/$loadoutId/expressions/top.tsx'),
				route('bottom', 'routes/loadouts/$loadoutId/expressions/bottom.tsx'),
				route('left', 'routes/loadouts/$loadoutId/expressions/left.tsx'),
				route('right', 'routes/loadouts/$loadoutId/expressions/right.tsx'),
			]),
			...prefix('weapons/:weaponId', [
				index('routes/loadouts/$loadoutId/weapons/$weaponId/index.tsx'),
				...prefix('templates', [
					route(
						'new',
						'routes/loadouts/$loadoutId/weapons/$weaponId/templates/new.tsx',
					),
					route(
						':templateId/edit',
						'routes/loadouts/$loadoutId/weapons/$weaponId/templates/$templateId/edit.tsx',
					),
				]),
			]),
		]),
	]),
] satisfies RouteConfig;
