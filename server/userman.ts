import https from 'https';
import events from 'events';

import axios from 'axios';
import { getUserConfig, randomItem } from 'app/utils.server';
import {
	EntitlementsByCategory,
	EntitlementsByType,
	Gun,
	Identity,
	Session,
	EquippedSpray,
	ValorantLoadout,
	Shards,
	regionToShard,
	PregamePlayer,
	PregameMatch,
} from 'types';
import { entitlementIdToTypeMap, Regions } from 'types';

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

const parseTokensFromUrl = (uri: string) => {
	const url = new URL(uri);

	return {
		accessToken: url.searchParams.get('access_token')!,
		idToken: url.searchParams.get('id_token')!,
	};
};

function getPlayerDataServiceUrl(region: Regions) {
	return `https://pd.${region}.a.pvp.net`;
}

function getPartyServiceUrl(region: Regions, shard: Shards) {
	return `https://glz-${region}-1.${shard}.a.pvp.net`;
}

function generateRequestHeaders(
	args: {
		accessToken: string;
		entitlementsToken: string;
	},
	extraHeaders: Record<string, string> = {}
) {
	const defaultHeaders = {
		Authorization: `Bearer ${args.accessToken}`,
		'X-Riot-Entitlements-JWT': args.entitlementsToken,
		'X-Riot-ClientVersion': 'release-05.12-shipping-21-808353',
		'X-Riot-ClientPlatform': btoa(
			JSON.stringify({
				platformType: 'PC',
				platformOS: 'Windows',
				platformOSVersion: '10.0.19042.1.256.64bit',
				platformChipset: 'Unknown',
			})
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
		userId: string;
		region: Regions;
	}) {
		this.accessToken = args.accessToken;
		this.entitlementsToken = args.entitlementsToken;
		this.userId = args.userId;
		this.region = args.region;
		this.shard = regionToShard[this.region];
		this.requestHeaders = generateRequestHeaders({
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
			Sprays: EquippedSpray[];
			Identity: Identity;
			Incognito: boolean;
		}>(
			`${getPlayerDataServiceUrl(this.region)}/personalization/v2/players/${
				this.userId
			}/playerloadout`,
			{
				headers: this.requestHeaders,
			}
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
			}
		);

		return data.EntitlementsByTypes.reduce<EntitlementsByCategory>(
			(acc, curr) => {
				const entitlementType = entitlementIdToTypeMap[curr.ItemTypeID];
				if (!entitlementType) {
					console.warn('Unknown entitlement type');
					return acc;
				}

				acc[entitlementType] = curr.Entitlements;
				return acc;
			},
			{
				skin_level: [],
				skin_chroma: [],
				agent: [],
				contract_definition: [],
				buddy: [],
				spray: [],
				player_card: [],
				player_title: [],
			}
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
			}
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
			}
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
			}
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
			}
		);

		const { data: pregameData } = await httpClient.get<PregameMatch>(
			`${getPartyServiceUrl(this.region, this.shard)}/pregame/v1/matches/${
				data.MatchID
			}`,
			{
				headers: this.requestHeaders,
			}
		);

		return pregameData;
	}

	async equipLoadout(loadout: ValorantLoadout) {
		const { data } = await httpClient.put(
			`${getPlayerDataServiceUrl(this.region)}/personalization/v2/players/${
				this.userId
			}/playerloadout`,
			loadout,
			{
				headers: this.requestHeaders,
			}
		);

		return data;
	}
}
