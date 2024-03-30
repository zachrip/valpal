import axios from 'axios';
import type {
	Buddy,
	PlayerCard,
	Weapon,
	Spray,
	Agent,
	PlayerTitle,
} from 'types';

const httpClient = axios.create();

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

async function getVersion() {
	const { data } = await httpClient.get<{
		status: number;
		data: { riotClientVersion: string };
	}>('https://valorant-api.com/v1/version');

	return data.data;
}

export async function initSkinData() {
	const [weapons, buddies, sprays, playerCards, playerTitles, agents, version] =
		await Promise.all([
			getWeapons(),
			getBuddies(),
			getSprays(),
			getPlayerCards(),
			getPlayerTitles(),
			getAgents(),
			getVersion(),
		]);

	global.valorantData = {
		weapons,
		buddies,
		sprays,
		playerCards,
		playerTitles,
		agents,
		version,
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
		version: {
			riotClientVersion: string;
		};
	};
}
