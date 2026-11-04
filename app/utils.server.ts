import axios, { isAxiosError } from 'axios';
import fsPromise from 'fs/promises';
import path from 'path';
import https from 'https';

import type {
	Loadout,
	UserConfig,
	UserConfigV1,
	UserConfigV2,
	UserConfigV3,
} from '~/utils';
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
	if (!process.env.LOCALAPPDATA) {
		// Le client Riot n'existe que sous Windows
		return;
	}

	const lockfilePath = path.resolve(
		process.env.LOCALAPPDATA!,
		'Riot Games',
		'Riot Client',
		'Config',
		'lockfile',
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
	return crypto.randomUUID();
}

export function randomItem<T>(array: T[]) {
	const index = Math.floor(Math.random() * array.length);
	return array[index];
}

export function getDefaultLoadout(): Loadout {
	const loadout = getBaseDefaultLoadout();
	for (const weapon of global.valorantData?.weapons ?? []) {
		loadout.weapons[weapon.uuid] ??= { templates: [] };
	}
	return loadout;
}

function getBaseDefaultLoadout(): Loadout {
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
		expressionIds: {
			top: {
				sprayIds: [],
				flexIds: [],
			},
			right: {
				sprayIds: [],
				flexIds: [],
			},
			bottom: {
				sprayIds: [],
				flexIds: [],
			},
			left: {
				sprayIds: [],
				flexIds: [],
			},
		},
	};
}

const CONFIG_VERSION = 3;

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
				version: 2,
			};
		},
	},
	{
		version: 3,
		migrate(old: UserConfigV2): UserConfigV3 {
			return {
				...old,
				version: 3,
				loadouts: old.loadouts.map((loadout) => ({
					...loadout,
					expressionIds: {
						top: {
							sprayIds: loadout.sprayIds.top,
							flexIds: [],
						},
						right: {
							sprayIds: loadout.sprayIds.right,
							flexIds: [],
						},
						bottom: {
							sprayIds: loadout.sprayIds.bottom,
							flexIds: [],
						},
						left: {
							sprayIds: loadout.sprayIds.left,
							flexIds: [],
						},
					},
				})),
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
		({ version }) => version > configVersion,
	);

	if (!pipeline.length) {
		throw new Error(
			`No migration pipeline for config version ${configVersion}`,
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

	const config: UserConfig = migrateConfig(
		JSON.parse(await readTextFile(userFilenamePath)),
	);

	// Armes ajoutées par Riot après la création de la config (ex. Bandit en
	// 2026) : on les ajoute pour qu'elles apparaissent dans le configurateur.
	const currentWeaponIds = global.valorantData?.weapons.map((w) => w.uuid) ?? [];
	for (const loadout of config.loadouts) {
		for (const weaponId of currentWeaponIds) {
			loadout.weapons[weaponId] ??= { templates: [] };
		}
	}

	return config;
}

export async function saveUserConfig(
	userId: string,
	config: Omit<UserConfig, 'version'>,
) {
	const userFileName = `user_${userId}.json`;
	const userFilenamePath = path.resolve(process.cwd(), userFileName);

	await writeTextFile(
		userFilenamePath,
		JSON.stringify({
			...config,
			version: CONFIG_VERSION,
		}),
	);
}

const httpClient = axios.create({
	httpsAgent: new https.Agent({
		rejectUnauthorized: false,
	}),
	timeout: 10000,
});

type ShardRegion = { region: Regions; shard: Shards };

declare global {
	var userShardRegionCache: Map<string, ShardRegion>;
	var pendingGetUser: Promise<User | null> | undefined;
}

global.userShardRegionCache =
	global.userShardRegionCache || new Map<string, ShardRegion>();

function localAuthHeader(password: string) {
	return {
		Authorization: `Basic ${Buffer.from(`riot:${password}`).toString('base64')}`,
	};
}

function toRegion(value: string) {
	return Object.values(Regions).find((r) => r.toLowerCase() === value.toLowerCase());
}

function toShard(value: string) {
	return Object.values(Shards).find((s) => s.toLowerCase() === value.toLowerCase());
}

function errorSummary(e: unknown) {
	if (isAxiosError(e)) {
		return e.response ? `HTTP ${e.response.status}` : e.code || e.message;
	}
	return String(e);
}

/**
 * Le jeu est-il réellement lancé (et pas seulement le Riot Client) ?
 * Renvoie aussi les arguments de lancement de Valorant.
 */
async function getValorantSession(port: string, password: string) {
	const { data } = await httpClient.get<
		Record<
			string,
			{ productId: string; launchConfiguration?: { arguments?: string[] } }
		>
	>(`https://127.0.0.1:${port}/product-session/v1/external-sessions`, {
		headers: localAuthHeader(password),
	});

	return Object.values(data).find((session) => session.productId === 'valorant');
}

/** Région/shard lus dans le log du jeu (ex. https://glz-eu-1.eu.a.pvp.net). */
async function readShardRegionFromLog(): Promise<ShardRegion | null> {
	try {
		const logPath = path.resolve(
			process.env.LOCALAPPDATA!,
			'VALORANT',
			'Saved',
			'Logs',
			'ShooterGame.log',
		);
		const content = await fsPromise.readFile(logPath, 'utf8');
		const matches = [
			...content.matchAll(/https:\/\/glz-([a-z]+)-1\.([a-z]+)\.a\.pvp\.net/gi),
		];
		const last = matches.at(-1);
		if (!last) return null;

		const region = toRegion(last[1]);
		const shard = toShard(last[2]);
		return region && shard ? { region, shard } : null;
	} catch {
		return null;
	}
}

/** Région/shard depuis les arguments de lancement (-ares-deployment=eu). */
function readShardRegionFromArgs(args: string[] = []): ShardRegion | null {
	const deployment = args
		.find((a) => a.startsWith('-ares-deployment='))
		?.split('=')[1];
	if (!deployment) return null;

	const shard = toShard(deployment);
	// Les shards EU/AP/KR n'ont qu'une région ; NA peut être NA, LATAM ou BR.
	const region = shard && shard !== Shards.NorthAmerica ? toRegion(deployment) : undefined;
	return shard && region ? { region, shard } : null;
}

/** Dernier recours : on teste chaque région une seule fois. */
async function probeShardRegion(tokens: {
	accessToken: string;
	token: string;
	subject: string;
}): Promise<ShardRegion | null> {
	const candidates = [
		[Shards.Europe, Regions.Europe],
		[Shards.NorthAmerica, Regions.NorthAmerica],
		[Shards.NorthAmerica, Regions.LatinAmerica],
		[Shards.NorthAmerica, Regions.Brazil],
		[Shards.AsiaPacific, Regions.AsiaPacific],
		[Shards.Korea, Regions.Korea],
	] as const;

	for (const [shard, region] of candidates) {
		try {
			const response = await httpClient.get(
				`https://glz-${region}-1.${shard}.a.pvp.net/parties/v1/players/${tokens.subject}`,
				{
					headers: generateRequestHeaders({
						accessToken: tokens.accessToken,
						entitlementsToken: tokens.token,
						riotClientVersion: global.valorantData.version.riotClientVersion,
					}),
				},
			);
			if (response.data?.Subject) {
				return { region, shard };
			}
		} catch (e) {
			console.log(`Région ${region}/${shard} : ${errorSummary(e)}`);
		}
	}

	return null;
}

let lastStatus = '';
function logStatus(message: string) {
	// Évite de répéter le même message toutes les 5 secondes
	if (message !== lastStatus) {
		console.log(message);
		lastStatus = message;
	}
}

async function resolveUser(): Promise<User | null> {
	const lockfile = await getLockfile();

	if (!lockfile) {
		logStatus('Riot Client non détecté : lancez Valorant.');
		return null;
	}

	const { port, password } = lockfile;

	let session: Awaited<ReturnType<typeof getValorantSession>>;
	try {
		session = await getValorantSession(port, password);
	} catch (e) {
		logStatus(`Riot Client injoignable (${errorSummary(e)}), nouvel essai...`);
		return null;
	}

	if (!session) {
		logStatus('Riot Client ouvert mais Valorant pas encore lancé, en attente...');
		return null;
	}

	let tokens: {
		accessToken: string;
		token: string;
		subject: string;
	};
	try {
		tokens = (
			await httpClient.get(`https://127.0.0.1:${port}/entitlements/v1/token`, {
				headers: localAuthHeader(password),
			})
		).data;
	} catch (e) {
		logStatus(`Jetons Riot indisponibles (${errorSummary(e)}), en attente...`);
		return null;
	}

	let res = global.userShardRegionCache.get(tokens.subject) ?? null;

	if (!res) {
		res =
			(await readShardRegionFromLog()) ??
			readShardRegionFromArgs(session.launchConfiguration?.arguments) ??
			(await probeShardRegion(tokens));

		if (!res) {
			logStatus(
				'Région introuvable pour le moment (le jeu est peut-être encore en chargement), nouvel essai...',
			);
			return null;
		}

		console.log('Région détectée :', res.region, '/ shard :', res.shard);
		global.userShardRegionCache.set(tokens.subject, res);
	}

	logStatus('Connecté à Valorant.');

	return new User({
		riotClientVersion: global.valorantData.version.riotClientVersion,
		accessToken: tokens.accessToken,
		entitlementsToken: tokens.token,
		region: res.region,
		shard: res.shard,
		userId: tokens.subject,
	});
}

export async function getUser() {
	// Plusieurs pages/onglets peuvent demander l'utilisateur en même temps :
	// on partage la même recherche au lieu d'en lancer une par requête.
	global.pendingGetUser ??= resolveUser()
		.catch((e) => {
			console.warn('Erreur en récupérant le joueur :', errorSummary(e));
			return null;
		})
		.finally(() => {
			global.pendingGetUser = undefined;
		});

	return global.pendingGetUser;
}
