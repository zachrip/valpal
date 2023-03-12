import https from 'https';

import axios from 'axios';
import type {
	Buddy,
	PlayerCard,
	Weapon,
	Spray,
	Agent,
	PlayerTitle,
} from 'types';

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

async function getWeapons() {
	const { data } = await httpClient.get<{
		status: number;
		data: Weapon[];
	}>('https://valorant-api.com/v1/weapons');

	return data.data;
}

async function getBuddies() {
	const { data } = await httpClient.get<{
		status: number;
		data: Buddy[];
	}>('https://valorant-api.com/v1/buddies');

	return data.data;
}

async function getSprays() {
	const { data } = await httpClient.get<{
		status: number;
		data: Spray[];
	}>('https://valorant-api.com/v1/sprays');

	return data.data;
}

async function getPlayerCards() {
	const { data } = await httpClient.get<{
		status: number;
		data: PlayerCard[];
	}>('https://valorant-api.com/v1/playercards');

	return data.data;
}

async function getPlayerTitles() {
	const { data } = await httpClient.get<{
		status: number;
		data: PlayerTitle[];
	}>('https://valorant-api.com/v1/playertitles');

	return data.data;
}

async function getAgents() {
	const { data } = await httpClient.get<{
		status: number;
		data: Agent[];
	}>('https://valorant-api.com/v1/agents');

	return data.data.filter((agent) => agent.isPlayableCharacter);
}

export async function initSkinData() {
	const [weapons, buddies, sprays, playerCards, playerTitles, agents] =
		await Promise.all([
			getWeapons(),
			getBuddies(),
			getSprays(),
			getPlayerCards(),
			getPlayerTitles(),
			getAgents(),
		]);

	global.valorantData = {
		weapons,
		buddies,
		sprays,
		playerCards,
		playerTitles,
		agents,
	};
}

declare global {
	var valorantData: {
		weapons: Weapon[];
		buddies: Buddy[];
		sprays: Spray[];
		playerCards: PlayerCard[];
		playerTitles: PlayerTitle[];
		agents: Agent[];
	};
}
