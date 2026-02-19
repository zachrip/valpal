import { invoke } from "@tauri-apps/api/core";
import type {
	Agent,
	Buddy,
	Flex,
	PlayerCard,
	PlayerTitle,
	Spray,
	Weapon,
} from "./types";

export interface ValorantData {
	weapons: Weapon[];
	buddies: Buddy[];
	playerCards: PlayerCard[];
	sprays: Spray[];
	playerTitles: PlayerTitle[];
	agents: Agent[];
	flex: Flex[];
}

export async function getValorantData(): Promise<ValorantData> {
	return invoke("get_valorant_data");
}
