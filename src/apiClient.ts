import { invoke } from "@tauri-apps/api/core";

export type Region = "AP" | "EU" | "KO" | "NA" | "LATAM" | "BR";
export type Shard = "NA" | "EU" | "AP" | "KR" | "PBE";

export interface Gun {
	ID: string;
	SkinID: string;
	SkinLevelID: string;
	ChromaID: string;
	CharmInstanceID?: string;
	CharmID?: string;
	CharmLevelID?: string;
	Attachments: unknown[];
}

export interface ActiveExpression {
	TypeID: string;
	AssetID: string;
}

export interface Identity {
	PlayerCardID: string;
	PlayerTitleID: string;
	AccountLevel: number;
	PreferredLevelBorderID: string;
	HideAccountLevel: boolean;
}

export interface ValorantLoadout {
	Subject: string;
	Version: number;
	Guns: Gun[];
	ActiveExpressions: ActiveExpression[];
	Identity: Identity;
	Incognito: boolean;
}

export interface PlayerInfo {
	display_name: string;
	game_name: string;
	tag_line: string;
}

export interface UserData {
	access_token: string;
	entitlements_token: string;
	user_id: string;
	region: Region;
	shard: Shard;
	riot_client_version: string;
	player_info: PlayerInfo;
}

export interface Entitlement {
	TypeID: string;
	ItemID: string;
	InstanceID?: string;
}

export interface EntitlementsByType {
	ItemTypeID: string;
	Entitlements: Entitlement[];
}

export interface EntitlementsResponse {
	EntitlementsByTypes: EntitlementsByType[];
}

export interface BuddyTemplate {
	id: string;
	levelIds: string[];
}

export interface WeaponTemplate {
	id: string;
	skinId: string;
	levelIds: string[];
	chromaIds: string[];
	buddies: BuddyTemplate[];
}

export interface WeaponConfig {
	templates: WeaponTemplate[];
}

export interface ExpressionSlot {
	sprayIds: string[];
	flexIds: string[];
}

export interface ExpressionIds {
	top: ExpressionSlot;
	right: ExpressionSlot;
	bottom: ExpressionSlot;
	left: ExpressionSlot;
}

export interface Loadout {
	id: string;
	name: string;
	enabled: boolean;
	agentIds: string[];
	weapons: Record<string, WeaponConfig>;
	playerCardIds: string[];
	playerTitleIds: string[];
	expressionIds: ExpressionIds;
}

export interface UserConfig {
	version: number;
	loadouts: Loadout[];
}

export async function getUser(): Promise<UserData | null> {
	return invoke("get_user");
}

export async function getLoadout(): Promise<ValorantLoadout> {
	return invoke("get_loadout");
}

export async function getEntitlements(): Promise<EntitlementsResponse> {
	return invoke("get_entitlements");
}

export async function equipLoadout(loadout: ValorantLoadout): Promise<boolean> {
	return invoke("equip_loadout", { loadout });
}

export async function getUserConfig(): Promise<UserConfig> {
	return invoke("get_user_config");
}

export async function saveUserConfig(config: UserConfig): Promise<UserConfig> {
	return invoke("save_user_config", { config });
}

export async function createLoadout(loadout: Loadout): Promise<Loadout> {
	return invoke("create_loadout", { loadout });
}

export async function updateLoadout(loadout: Loadout): Promise<Loadout> {
	return invoke("update_loadout", { loadout });
}

export async function deleteLoadout(loadoutId: string): Promise<string> {
	return invoke("delete_loadout", { loadoutId });
}

export async function saveInGameLoadout(name: string): Promise<Loadout> {
	return invoke("save_in_game_loadout", { name });
}

export async function getValorantStatus(): Promise<boolean> {
	return invoke("get_valorant_status");
}

export interface ShuffleSettings {
	autoShuffleEnabled: boolean;
	agentDetectionEnabled: boolean;
	nonPregameShuffleEnabled: boolean;
}

export async function getShuffleSettings(): Promise<ShuffleSettings> {
	return invoke("get_shuffle_settings");
}

export async function setAutoShuffleEnabled(enabled: boolean): Promise<void> {
	return invoke("set_auto_shuffle_enabled", { enabled });
}

export async function setAgentDetectionEnabled(
	enabled: boolean,
): Promise<void> {
	return invoke("set_agent_detection_enabled", { enabled });
}

export async function setNonPregameShuffleEnabled(
	enabled: boolean,
): Promise<void> {
	return invoke("set_non_pregame_shuffle_enabled", { enabled });
}

export async function equipLoadoutById(loadoutId: string): Promise<boolean> {
	return invoke("equip_loadout_by_id", { loadoutId });
}
