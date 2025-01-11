import https from 'https';

import axios from 'axios';
import type {
	EntitlementsByCategory,
	EntitlementsByType,
	Gun,
	Identity,
	Session,
	ValorantLoadout,
	Shards,
	PregamePlayer,
	PregameMatch,
	Regions,
	ActiveExpression,
} from 'types';
import { entitlementIdToTypeMap } from 'types';

const agent = new https.Agent({
	ciphers: [
		'TLS_CHACHA20_POLY1305_SHA256',
		'TLS_AES_128_GCM_SHA256',
		'TLS_AES_256_GCM_SHA384',
		'TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256',
	].join(':'),
	honorCipherOrder: true,
	minVersion: 'TLSv1.2',
});

const httpClient = axios.create({
	httpsAgent: agent,
});

function getPlayerDataServiceUrl(region: Regions) {
	return `https://pd.${region}.a.pvp.net`;
}

function getPartyServiceUrl(region: Regions, shard: Shards) {
	return `https://glz-${region}-1.${shard}.a.pvp.net`;
}

export function generateRequestHeaders(
	args: {
		accessToken: string;
		entitlementsToken: string;
		riotClientVersion: string;
	},
	extraHeaders: Record<string, string> = {},
) {
	const defaultHeaders = {
		Authorization: `Bearer ${args.accessToken}`,
		'X-Riot-Entitlements-JWT': args.entitlementsToken,
		'X-Riot-ClientVersion': args.riotClientVersion,
		'X-Riot-ClientPlatform': btoa(
			JSON.stringify({
				platformType: 'PC',
				platformOS: 'Windows',
				platformOSVersion: '10.0.19042.1.256.64bit',
				platformChipset: 'Unknown',
			}),
		),
	};

	// merge in extra headers
	return {
		...defaultHeaders,
		...extraHeaders,
	};
}

export class User {
	private accessToken: string;
	private entitlementsToken: string;
	public userId: string;
	public region: Regions;
	public shard: Shards;

	private requestHeaders: Record<string, string>;

	constructor(args: {
		accessToken: string;
		entitlementsToken: string;
		riotClientVersion: string;
		userId: string;
		region: Regions;
		shard: Shards;
	}) {
		this.accessToken = args.accessToken;
		this.entitlementsToken = args.entitlementsToken;
		this.userId = args.userId;
		this.region = args.region;
		this.shard = args.shard;
		this.requestHeaders = generateRequestHeaders({
			riotClientVersion: args.riotClientVersion,
			accessToken: this.accessToken,
			entitlementsToken: this.entitlementsToken,
		});
	}

	getTokens() {
		return {
			accessToken: this.accessToken,
			entitlementsToken: this.entitlementsToken,
		};
	}

	async getLoadout() {
		const { data } = await httpClient.get<{
			Subject: string;
			Version: number;
			Guns: Gun[];
			ActiveExpressions: ActiveExpression[];
			Identity: Identity;
			Incognito: boolean;
		}>(
			`${getPlayerDataServiceUrl(this.region)}/personalization/v3/players/${
				this.userId
			}/playerloadout`,
			{
				headers: this.requestHeaders,
			},
		);

		return data;
	}

	async getEntitlements() {
		const { data } = await httpClient.get<{
			EntitlementsByTypes: EntitlementsByType[];
		}>(
			`${getPlayerDataServiceUrl(this.region)}/store/v1/entitlements/${
				this.userId
			}`,
			{
				headers: this.requestHeaders,
			},
		);

		return data.EntitlementsByTypes.reduce<EntitlementsByCategory>(
			(acc, curr) => {
				const entitlementType = entitlementIdToTypeMap[curr.ItemTypeID];
				if (!entitlementType) {
					return acc;
				}

				acc[entitlementType].push(...curr.Entitlements);
				return acc;
			},
			{
				skin_level: [],
				skin_chroma: [],
				agent: [],
				contract_definition: [],
				buddy: [],
				spray: [],
				flex: [
					{
						ItemID: 'af52b5a0-4a4c-03b2-c9d7-8187a08a2675',
						TypeID: '03a572de-4234-31ed-d344-ababa488f981',
						InstanceID: 'af52b5a0-4a4c-03b2-c9d7-8187a08a2675',
					},
				],
				player_card: [],
				player_title: [],
			} as EntitlementsByCategory,
		);
	}

	async getPlayer() {
		const { data } = await httpClient.put<
			Array<{
				DisplayName: string;
				Subject: string;
				GameName: string;
				TagLine: string;
			}>
		>(
			`${getPlayerDataServiceUrl(this.region)}/name-service/v2/players`,
			[this.userId],
			{
				headers: this.requestHeaders,
			},
		);

		return data[0];
	}

	async getSession() {
		const { data } = await httpClient.get<Session>(
			`${getPartyServiceUrl(this.region, this.shard)}/session/v1/sessions/${
				this.userId
			}`,
			{
				headers: this.requestHeaders,
			},
		);

		return data;
	}

	async getParty() {
		const { data } = await httpClient.get(
			`${getPartyServiceUrl(this.region, this.shard)}/parties/v1/players/${
				this.userId
			}`,
			{
				headers: this.requestHeaders,
			},
		);

		return data;
	}

	async getPregame() {
		const { data } = await httpClient.get<PregamePlayer>(
			`${getPartyServiceUrl(this.region, this.shard)}/pregame/v1/players/${
				this.userId
			}`,
			{
				headers: this.requestHeaders,
			},
		);

		const { data: pregameData } = await httpClient.get<PregameMatch>(
			`${getPartyServiceUrl(this.region, this.shard)}/pregame/v1/matches/${
				data.MatchID
			}`,
			{
				headers: this.requestHeaders,
			},
		);

		return pregameData;
	}

	async equipLoadout(loadout: ValorantLoadout) {
		const { data } = await httpClient.put(
			`${getPlayerDataServiceUrl(this.region)}/personalization/v3/players/${
				this.userId
			}/playerloadout`,
			loadout,
			{
				headers: this.requestHeaders,
			},
		);

		return data;
	}
}
