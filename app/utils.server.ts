import axios, { isAxiosError } from 'axios';
import fsPromise from 'fs/promises';
import path from 'path';
import https from 'https';

import { v4 as uuidv4 } from 'uuid';

import type { Loadout, UserConfig, UserConfigV1, UserConfigV2 } from '~/utils';
import { generateRequestHeaders, User } from 'server/userman';
import { Regions, Shards } from 'types';

async function exists(filename: string) {
	try {
		await fsPromise.access(filename);
		return true;
	} catch {
		return false;
	}
}

export async function getLockfile() {
	const lockfilePath = path.resolve(
		process.env.LOCALAPPDATA!,
		'Riot Games',
		'Riot Client',
		'Config',
		'lockfile'
	);

	if (!(await exists(lockfilePath))) {
		return;
	}

	const lockfile = await fsPromise.readFile(lockfilePath, 'utf8');
	const [name, pid, port, password] = lockfile.split(':');

	return {
		name,
		pid,
		port,
		password,
	};
}

function readTextFile(filename: string) {
	return fsPromise.readFile(filename, 'utf-8');
}

function writeTextFile(filename: string, content: string) {
	return fsPromise.writeFile(filename, content);
}

export function randomUUID() {
	return uuidv4();
}

export function randomItem<T>(array: T[]) {
	const index = Math.floor(Math.random() * array.length);
	return array[index];
}

export function getDefaultLoadout(): Loadout {
	return {
		id: randomUUID(),
		name: 'Default Loadout',
		enabled: true,
		agentIds: [],
		weapons: {
			'63e6c2b6-4a8e-869c-3d4c-e38355226584': { templates: [] },
			'55d8a0f4-4274-ca67-fe2c-06ab45efdf58': { templates: [] },
			'9c82e19d-4575-0200-1a81-3eacf00cf872': { templates: [] },
			'ae3de142-4d85-2547-dd26-4e90bed35cf7': { templates: [] },
			'ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a': { templates: [] },
			'ec845bf4-4f79-ddda-a3da-0db3774b2794': { templates: [] },
			'910be174-449b-c412-ab22-d0873436b21b': { templates: [] },
			'44d4e95c-4157-0037-81b2-17841bf2e8e3': { templates: [] },
			'29a0cfab-485b-f5d5-779a-b59f85e204a8': { templates: [] },
			'1baa85b4-4c70-1284-64bb-6481dfc3bb4e': { templates: [] },
			'e336c6b8-418d-9340-d77f-7a9e4cfe0702': { templates: [] },
			'42da8ccc-40d5-affc-beec-15aa47b42eda': { templates: [] },
			'a03b24d3-4319-996d-0f8c-94bbfba1dfc7': { templates: [] },
			'4ade7faa-4cf1-8376-95ef-39884480959b': { templates: [] },
			'c4883e50-4494-202c-3ec3-6b8a9284f00b': { templates: [] },
			'462080d1-4035-2937-7c09-27aa2a5c27a7': { templates: [] },
			'f7e1b454-4ad4-1063-ec0a-159e56b58941': { templates: [] },
			'2f59173c-4bed-b6c3-2191-dea9b58be9c7': { templates: [] },
			'5f0aaf7a-4289-3998-d5ff-eb9a5cf7ef5c': { templates: [] },
		},
		playerCardIds: [],
		playerTitleIds: [],
		sprayIds: {
			top: [],
			right: [],
			bottom: [],
			left: [],
		},
	};
}

const CONFIG_VERSION = 2;

const migratePipeline = [
	{
		version: 2,
		migrate(old: UserConfigV1): UserConfigV2 {
			return {
				...old,
				loadouts: old.loadouts.map((loadout) => ({
					...loadout,
					sprayIds: {
						top: loadout.sprayIds.midRound,
						right: loadout.sprayIds.postRound,
						bottom: [],
						left: loadout.sprayIds.preRound,
					},
				})),
				version: CONFIG_VERSION,
			};
		},
	},
] as const;

function migrateConfig(config: any) {
	const configVersion = 'version' in config ? config.version : 1;

	if (configVersion === CONFIG_VERSION) {
		return config;
	}

	const pipeline = migratePipeline.filter(
		({ version }) => version > configVersion
	);

	if (!pipeline.length) {
		throw new Error(
			`No migration pipeline for config version ${configVersion}`
		);
	}

	return pipeline.reduce((acc, { migrate }) => migrate(acc), config);
}

export async function getUserConfig(userId: string): Promise<UserConfig> {
	const userFileName = `user_${userId}.json`;
	const userFilenamePath = path.resolve(process.cwd(), userFileName);

	if (!(await exists(userFilenamePath))) {
		const newConfig: UserConfig = {
			loadouts: [getDefaultLoadout()],
			version: CONFIG_VERSION,
		};

		await writeTextFile(userFilenamePath, JSON.stringify(newConfig));
	}

	return migrateConfig(JSON.parse(await readTextFile(userFilenamePath)));
}

export async function saveUserConfig(
	userId: string,
	config: Omit<UserConfig, 'version'>
) {
	const userFileName = `user_${userId}.json`;
	const userFilenamePath = path.resolve(process.cwd(), userFileName);

	await writeTextFile(
		userFilenamePath,
		JSON.stringify({
			...config,
			version: CONFIG_VERSION,
		})
	);
}

const httpClient = axios.create({
	httpsAgent: new https.Agent({
		rejectUnauthorized: false,
	}),
});

declare global {
	var userShardRegionCache: Map<string, { region: Regions; shard: Shards }>;
}

global.userShardRegionCache =
	global.userShardRegionCache ||
	new Map<string, { region: Regions; shard: Shards }>();

export async function getUser() {
	try {
		const lockfile = await getLockfile();

		if (!lockfile) {
			return null;
		}

		const { port, password } = lockfile;

		const tokens = (
			await httpClient.get<{
				accessToken: string;
				entitlements: unknown[];
				issuer: string;
				subject: string;
				token: string;
			}>(`https://127.0.0.1:${port}/entitlements/v1/token`, {
				headers: {
					Authorization: `Basic ${Buffer.from(`riot:${password}`).toString(
						'base64'
					)}`,
				},
			})
		).data;

		const shardRegionMap = [
			[Shards.NorthAmerica, Regions.NorthAmerica],
			[Shards.NorthAmerica, Regions.LatinAmerica],
			[Shards.NorthAmerica, Regions.Brazil],
			[Shards.PBE, Regions.NorthAmerica],
			[Shards.Europe, Regions.Europe],
			[Shards.AsiaPacific, Regions.AsiaPacific],
			[Shards.Korea, Regions.Korea],
		] as const;

		const res =
			global.userShardRegionCache.get(tokens.subject) ||
			(await (async function findRegionAndShard(attempts = 0): Promise<{
				region: Regions;
				shard: Shards;
			} | null> {
				for (const [shard, region] of shardRegionMap) {
					try {
						const response = await httpClient.get(
							`https://glz-${region}-1.${shard}.a.pvp.net/parties/v1/players/${tokens.subject}`,
							{
								headers: generateRequestHeaders({
									accessToken: tokens.accessToken,
									entitlementsToken: tokens.token,
								}),
							}
						);

						if (!response.data.Subject) {
							continue;
						}

						return {
							region,
							shard,
						};
					} catch (e) {
						if (isAxiosError(e)) {
							switch (e.response?.status) {
								case 404: {
									console.log('tried', region, shard, 'got 404, continuing');
									break;
								}
								default: {
									console.warn(
										'Caught error trying to get user for region/shard detection',
										region,
										shard,
										e
									);
									break;
								}
							}
						}
					}
				}

				if (attempts < 5) {
					console.log('Failed to find user region and shard, retrying in 2.5s');
					await new Promise((resolve) => setTimeout(resolve, 2500));
					return findRegionAndShard(attempts + 1);
				}

				return null;
			})());

		if (!res) {
			return null;
		}

		console.log('Found user region and shard', res);
		userShardRegionCache.set(tokens.subject, res);

		return new User({
			accessToken: tokens.accessToken,
			entitlementsToken: tokens.token,
			region: res.region,
			shard: res.shard,
			userId: tokens.subject,
		});
	} catch (e) {
		console.warn('Caught error trying to get user', e);
		return null;
	}
}
