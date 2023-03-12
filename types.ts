export enum Regions {
	AsiaPacific = 'AP',
	Europe = 'EU',
	Korea = 'KO',
	NorthAmerica = 'NA',
	LatinAmerica = 'LATAM',
	Brazil = 'BR',
}

export enum Shards {
	NorthAmerica = 'NA',
	Europe = 'EU',
	AsiaPacific = 'AP',
	Korea = 'KR',
	PBE = 'PBE',
}

export const regionToShard: Record<Regions, Shards> = {
	[Regions.AsiaPacific]: Shards.AsiaPacific,
	[Regions.Europe]: Shards.Europe,
	[Regions.Korea]: Shards.Korea,
	[Regions.NorthAmerica]: Shards.NorthAmerica,
	[Regions.LatinAmerica]: Shards.NorthAmerica,
	[Regions.Brazil]: Shards.NorthAmerica,
};

export interface EquippedSpray {
	EquipSlotID: string;
	SprayID: string;
	SprayLevelID: string | null;
}

export interface AdsStats {
	zoomMultiplier: number;
	fireRate: number;
	runSpeedMultiplier: number;
	burstCount: number;
	firstBulletAccuracy: number;
}

export interface DamageRange {
	rangeStartMeters: number;
	rangeEndMeters: number;
	headDamage: number;
	bodyDamage: number;
	legDamage: number;
}

export interface WeaponStats {
	fireRate: number;
	magazineSize: number;
	runSpeedMultiplier: number;
	equipTimeSeconds: number;
	reloadTimeSeconds: number;
	firstBulletAccuracy: number;
	shotgunPelletCount: number;
	wallPenetration: string;
	feature: string;
	fireMode?: any;
	altFireType: string;
	adsStats: AdsStats;
	altShotgunStats?: any;
	airBurstStats?: any;
	damageRanges: DamageRange[];
}

export interface GridPosition {
	row: number;
	column: number;
}

export interface ShopData {
	cost: number;
	category: string;
	categoryText: string;
	gridPosition: GridPosition;
	canBeTrashed: boolean;
	image?: any;
	newImage: string;
	newImage2?: any;
	assetPath: string;
}

export interface SkinChroma {
	uuid: string;
	displayName: string;
	displayIcon: string;
	fullRender: string;
	swatch: string;
	streamedVideo: string;
	assetPath: string;
}

export interface SkinLevel {
	uuid: string;
	displayName: string;
	levelItem: string;
	displayIcon: string;
	streamedVideo: string;
	assetPath: string;
}

export interface Skin {
	uuid: string;
	displayName: string;
	themeUuid: string;
	contentTierUuid: string;
	displayIcon: string;
	wallpaper: string;
	assetPath: string;
	chromas: SkinChroma[];
	levels: SkinLevel[];
}

export interface Weapon {
	uuid: string;
	displayName: string;
	category: WeaponCategory;
	defaultSkinUuid: string;
	displayIcon: string;
	killStreamIcon: string;
	assetPath: string;
	weaponStats: WeaponStats;
	shopData: ShopData;
	skins: Skin[];
}

export interface Entitlement {
	TypeID: string;
	ItemID: string;
	InstanceID: string;
}

export type WeaponCategory =
	| 'EEquippableCategory::Sidearm'
	| 'EEquippableCategory::SMG'
	| 'EEquippableCategory::Rifle'
	| 'EEquippableCategory::Sniper'
	| 'EEquippableCategory::Shotgun'
	| 'EEquippableCategory::Heavy'
	| 'EEquippableCategory::Melee';

export interface BuddyLevel {
	uuid: string;
	charmLevel: number;
	displayName: string;
	displayIcon: string;
	assetPath: string;
}

export interface Buddy {
	uuid: string;
	displayName: string;
	isHiddenIfNotOwned: boolean;
	themeUuid: string;
	displayIcon: string;
	assetPath: string;
	levels: BuddyLevel[];
}

export interface Gun {
	ID: string;
	SkinID: string;
	SkinLevelID: string;
	ChromaID: string;
	CharmInstanceID?: string;
	CharmID?: string;
	CharmLevelID?: string;
	Attachments: any[];
}

export interface EquippedSpray {
	EquipSlotID: string;
	SprayID: string;
	SprayLevelID: string | null;
}

export interface Identity {
	PlayerCardID: string;
	PlayerTitleID: string;
	AccountLevel: number;
	PreferredLevelBorderID: string;
	HideAccountLevel: boolean;
}

export interface AdsStats {
	zoomMultiplier: number;
	fireRate: number;
	runSpeedMultiplier: number;
	burstCount: number;
	firstBulletAccuracy: number;
}

export interface DamageRange {
	rangeStartMeters: number;
	rangeEndMeters: number;
	headDamage: number;
	bodyDamage: number;
	legDamage: number;
}

export interface WeaponStats {
	fireRate: number;
	magazineSize: number;
	runSpeedMultiplier: number;
	equipTimeSeconds: number;
	reloadTimeSeconds: number;
	firstBulletAccuracy: number;
	shotgunPelletCount: number;
	wallPenetration: string;
	feature: string;
	fireMode?: any;
	altFireType: string;
	adsStats: AdsStats;
	altShotgunStats?: any;
	airBurstStats?: any;
	damageRanges: DamageRange[];
}

export interface GridPosition {
	row: number;
	column: number;
}

export interface Entitlement {
	TypeID: string;
	ItemID: string;
	InstanceID: string;
}

export interface EntitlementsByType {
	ItemTypeID: string;
	Entitlements: Entitlement[];
}

type EntitlementTypes =
	| 'skin_level'
	| 'skin_chroma'
	| 'agent'
	| 'contract_definition'
	| 'buddy'
	| 'spray'
	| 'player_card'
	| 'player_title';

export const entitlementIdToTypeMap: Record<string, EntitlementTypes> = {
	'e7c63390-eda7-46e0-bb7a-a6abdacd2433': 'skin_level',
	'3ad1b2b2-acdb-4524-852f-954a76ddae0a': 'skin_chroma',
	'01bb38e1-da47-4e6a-9b3d-945fe4655707': 'agent',
	'f85cb6f7-33e5-4dc8-b609-ec7212301948': 'contract_definition',
	'dd3bf334-87f3-40bd-b043-682a57a8dc3a': 'buddy',
	'd5f120f8-ff8c-4aac-92ea-f2b5acbe9475': 'spray',
	'3f296c07-64c3-494c-923b-fe692a4fa1bd': 'player_card',
	'de7caa6b-adf7-4588-bbd1-143831e786c6': 'player_title',
};

export interface ClientPlatformInfo {
	platformType: string;
	platformOS: string;
	platformOSVersion: string;
	platformChipset: string;
}

export interface Session {
	subject: string;
	cxnState: string;
	clientID: string;
	clientVersion: string;
	loopState: string;
	loopStateMetadata: string;
	version: number;
	lastHeartbeatTime: Date;
	expiredTime: Date;
	heartbeatIntervalMillis: number;
	playtimeNotification: string;
	playtimeMinutes: number;
	isRestricted: boolean;
	userinfoValidTime: Date;
	restrictionType: string;
	clientPlatformInfo: ClientPlatformInfo;
}

export interface PregamePlayer {
	Subject: string;
	MatchID: string;
	Version: number;
}

export interface PlayerIdentity {
	Subject: string;
	PlayerCardID: string;
	PlayerTitleID: string;
	AccountLevel: number;
	PreferredLevelBorderID: string;
	Incognito: boolean;
	HideAccountLevel: boolean;
}

export interface SeasonalBadgeInfo {
	SeasonID: string;
	NumberOfWins: number;
	WinsByTier?: any;
	Rank: number;
	LeaderboardRank: number;
}

export interface Player {
	Subject: string;
	CharacterID: string;
	CharacterSelectionState: string;
	PregamePlayerState: string;
	CompetitiveTier: number;
	PlayerIdentity: PlayerIdentity;
	SeasonalBadgeInfo: SeasonalBadgeInfo;
	IsCaptain: boolean;
}

export interface Team {
	TeamID: string;
	Players: Player[];
}

export interface PlayerIdentity2 {
	Subject: string;
	PlayerCardID: string;
	PlayerTitleID: string;
	AccountLevel: number;
	PreferredLevelBorderID: string;
	Incognito: boolean;
	HideAccountLevel: boolean;
}

export interface SeasonalBadgeInfo2 {
	SeasonID: string;
	NumberOfWins: number;
	WinsByTier?: any;
	Rank: number;
	LeaderboardRank: number;
}

export interface Player2 {
	Subject: string;
	CharacterID: string;
	CharacterSelectionState: string;
	PregamePlayerState: string;
	CompetitiveTier: number;
	PlayerIdentity: PlayerIdentity2;
	SeasonalBadgeInfo: SeasonalBadgeInfo2;
	IsCaptain: boolean;
}

export interface AllyTeam {
	TeamID: string;
	Players: Player2[];
}

export interface CastedVotes {}

export interface PregameMatch {
	ID: string;
	Version: number;
	Teams: Team[];
	AllyTeam: AllyTeam;
	EnemyTeam?: any;
	ObserverSubjects: any[];
	MatchCoaches: any[];
	EnemyTeamSize: number;
	EnemyTeamLockCount: number;
	PregameState: string;
	LastUpdated: Date;
	MapID: string;
	MapSelectPool: any[];
	BannedMapIDs: any[];
	CastedVotes: CastedVotes;
	MapSelectSteps: any[];
	MapSelectStep: number;
	Team1: string;
	GamePodID: string;
	Mode: string;
	VoiceSessionID: string;
	MUCName: string;
	QueueID: string;
	ProvisioningFlowID: string;
	IsRanked: boolean;
	PhaseTimeRemainingNS: number;
	StepTimeRemainingNS: number;
	altModesFlagADA: boolean;
	TournamentMetadata?: any;
	RosterMetadata?: any;
}

export type EntitlementsByCategory = Record<EntitlementTypes, Entitlement[]>;

export type ValorantLoadout = {
	Guns: Array<{
		ID: string;
		SkinID: string;
		SkinLevelID: string;
		ChromaID: string;
		Attachments: Array<any>;
	}>;
	Sprays: Array<{
		EquipSlotID: string;
		SprayID: string;
		SprayLevelID: string | null;
	}>;
	Identity: {
		PlayerCardID: string;
		PlayerTitleID: string;
		AccountLevel: number;
		PreferredLevelBorderID: string;
		HideAccountLevel: boolean;
	};
	Incognito: boolean;
};

export type PlayerCard = {
	uuid: string;
	displayName: string;
	isHiddenIfNotOwned: boolean;
	themeUuid: string;
	displayIcon: string;
	smallArt: string;
	wideArt: string;
	largeArt: string;
	assetPath: string;
};

export type SprayLevel = {
	uuid: string;
	sprayLevel: number;
	displayName: string;
	displayIcon: string;
	assetPath: string;
};

export type Spray = {
	uuid: string;
	displayName: string;
	category: string;
	themeUuid: string;
	displayIcon: string;
	fullIcon: string;
	fullTransparentIcon: string;
	animationPng: string;
	animationGif: string;
	assetPath: string;
	levels: SprayLevel[];
};

export type PlayerTitle = {
	uuid: string;
	displayName: string;
	titleText: string;
	isHiddenIfNotOwned: boolean;
	assetPath: string;
};

export type Role = {
	uuid: string;
	displayName: string;
	description: string;
	displayIcon: string;
	assetPath: string;
};

export type Ability = {
	slot: string;
	displayName: string;
	description: string;
	displayIcon: string;
};

export type MediaList = {
	id: number;
	wwise: string;
	wave: string;
};

export type VoiceLine = {
	minDuration: number;
	maxDuration: number;
	mediaList: MediaList[];
};

export type Agent = {
	uuid: string;
	displayName: string;
	description: string;
	developerName: string;
	characterTags: string[];
	displayIcon: string;
	displayIconSmall: string;
	bustPortrait: string;
	fullPortrait: string;
	fullPortraitV2: string;
	killfeedPortrait: string;
	background: string;
	backgroundGradientColors: string[];
	assetPath: string;
	isFullPortraitRightFacing: boolean;
	isPlayableCharacter: boolean;
	isAvailableForTest: boolean;
	isBaseContent: boolean;
	role: Role;
	abilities: Ability[];
	voiceLine: VoiceLine;
};
