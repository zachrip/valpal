export type WeaponCategory =
	| "EEquippableCategory::Sidearm"
	| "EEquippableCategory::SMG"
	| "EEquippableCategory::Rifle"
	| "EEquippableCategory::Sniper"
	| "EEquippableCategory::Shotgun"
	| "EEquippableCategory::Heavy"
	| "EEquippableCategory::Melee";

export interface SkinChroma {
	uuid: string;
	displayName: string;
	displayIcon: string | null;
	fullRender: string;
	swatch: string | null;
	streamedVideo: string | null;
	assetPath: string;
}

export interface SkinLevel {
	uuid: string;
	displayName: string;
	levelItem: string | null;
	displayIcon: string | null;
	streamedVideo: string | null;
	assetPath: string;
}

export interface Skin {
	uuid: string;
	displayName: string;
	themeUuid: string | null;
	contentTierUuid: string | null;
	displayIcon: string | null;
	wallpaper: string | null;
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
	skins: Skin[];
}

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
	themeUuid: string | null;
	displayIcon: string;
	assetPath: string;
	levels: BuddyLevel[];
}

export interface PlayerCard {
	uuid: string;
	displayName: string;
	isHiddenIfNotOwned: boolean;
	themeUuid: string | null;
	displayIcon: string;
	smallArt: string;
	wideArt: string;
	largeArt: string | null;
	assetPath: string;
}

export interface SprayLevel {
	uuid: string;
	sprayLevel: number;
	displayName: string;
	displayIcon: string | null;
	assetPath: string;
}

export interface Spray {
	uuid: string;
	displayName: string;
	category: string | null;
	themeUuid: string | null;
	displayIcon: string;
	fullIcon: string | null;
	fullTransparentIcon: string | null;
	animationPng: string | null;
	animationGif: string | null;
	assetPath: string;
	levels: SprayLevel[];
}

export interface Flex {
	uuid: string;
	displayName: string;
	displayIcon: string;
	assetPath: string;
}

export interface PlayerTitle {
	uuid: string;
	displayName: string | null;
	titleText: string | null;
	isHiddenIfNotOwned: boolean;
	assetPath: string;
}

export interface Role {
	uuid: string;
	displayName: string;
	description: string;
	displayIcon: string;
	assetPath: string;
}

export interface Ability {
	slot: string;
	displayName: string;
	description: string;
	displayIcon: string | null;
}

export interface Agent {
	uuid: string;
	displayName: string;
	description: string;
	developerName: string;
	characterTags: string[] | null;
	displayIcon: string;
	displayIconSmall: string;
	bustPortrait: string;
	fullPortrait: string;
	fullPortraitV2: string;
	killfeedPortrait: string;
	background: string;
	backgroundGradientColors: string[] | null;
	assetPath: string;
	isFullPortraitRightFacing: boolean;
	isPlayableCharacter: boolean;
	isAvailableForTest: boolean;
	isBaseContent: boolean;
	role: Role | null;
	abilities: Ability[];
}

export type EntitlementTypes =
	| "skin_level"
	| "skin_chroma"
	| "agent"
	| "contract_definition"
	| "buddy"
	| "spray"
	| "flex"
	| "player_card"
	| "player_title";

export interface Entitlement {
	TypeID: string;
	ItemID: string;
	InstanceID?: string;
}

export const entitlementIdToTypeMap: Record<string, EntitlementTypes> = {
	"e7c63390-eda7-46e0-bb7a-a6abdacd2433": "skin_level",
	"3ad1b2b2-acdb-4524-852f-954a76ddae0a": "skin_chroma",
	"01bb38e1-da47-4e6a-9b3d-945fe4655707": "agent",
	"f85cb6f7-33e5-4dc8-b609-ec7212301948": "contract_definition",
	"dd3bf334-87f3-40bd-b043-682a57a8dc3a": "buddy",
	"d5f120f8-ff8c-4aac-92ea-f2b5acbe9475": "spray",
	"03a572de-4234-31ed-d344-ababa488f981": "flex",
	"3f296c07-64c3-494c-923b-fe692a4fa1bd": "player_card",
	"de7caa6b-adf7-4588-bbd1-143831e786c6": "player_title",
};

export const entitlementTypeToIdMap: Record<EntitlementTypes, string> = {
	skin_level: "e7c63390-eda7-46e0-bb7a-a6abdacd2433",
	skin_chroma: "3ad1b2b2-acdb-4524-852f-954a76ddae0a",
	agent: "01bb38e1-da47-4e6a-9b3d-945fe4655707",
	contract_definition: "f85cb6f7-33e5-4dc8-b609-ec7212301948",
	buddy: "dd3bf334-87f3-40bd-b043-682a57a8dc3a",
	spray: "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475",
	flex: "03a572de-4234-31ed-d344-ababa488f981",
	player_card: "3f296c07-64c3-494c-923b-fe692a4fa1bd",
	player_title: "de7caa6b-adf7-4588-bbd1-143831e786c6",
};

export const categoryNameMap: Record<WeaponCategory, string> = {
	"EEquippableCategory::Sidearm": "sidearms",
	"EEquippableCategory::SMG": "smgs",
	"EEquippableCategory::Rifle": "rifles",
	"EEquippableCategory::Sniper": "sniper rifles",
	"EEquippableCategory::Shotgun": "shotguns",
	"EEquippableCategory::Heavy": "machine guns",
	"EEquippableCategory::Melee": "melee",
};

export const categoryCanonicalNameMap: Record<WeaponCategory, string> = {
	"EEquippableCategory::Sidearm": "sidearm",
	"EEquippableCategory::SMG": "smg",
	"EEquippableCategory::Rifle": "rifle",
	"EEquippableCategory::Sniper": "sniper",
	"EEquippableCategory::Shotgun": "shotgun",
	"EEquippableCategory::Heavy": "heavy",
	"EEquippableCategory::Melee": "melee",
};

export const sortedWeapons: Record<WeaponCategory, string[]> = {
	"EEquippableCategory::Sidearm": [
		"classic",
		"shorty",
		"frenzy",
		"ghost",
		"bandit",
		"sheriff",
	],
	"EEquippableCategory::SMG": ["stinger", "spectre"],
	"EEquippableCategory::Rifle": ["bulldog", "guardian", "phantom", "vandal"],
	"EEquippableCategory::Sniper": ["marshal", "outlaw", "operator"],
	"EEquippableCategory::Shotgun": ["bucky", "judge"],
	"EEquippableCategory::Heavy": ["ares", "odin"],
	"EEquippableCategory::Melee": ["melee"],
};

export const weaponUUIDCanonicalNameMap: Record<string, string> = {
	"63e6c2b6-4a8e-869c-3d4c-e38355226584": "odin",
	"55d8a0f4-4274-ca67-fe2c-06ab45efdf58": "ares",
	"9c82e19d-4575-0200-1a81-3eacf00cf872": "vandal",
	"ae3de142-4d85-2547-dd26-4e90bed35cf7": "bulldog",
	"ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a": "phantom",
	"ec845bf4-4f79-ddda-a3da-0db3774b2794": "judge",
	"910be174-449b-c412-ab22-d0873436b21b": "bucky",
	"44d4e95c-4157-0037-81b2-17841bf2e8e3": "frenzy",
	"29a0cfab-485b-f5d5-779a-b59f85e204a8": "classic",
	"1baa85b4-4c70-1284-64bb-6481dfc3bb4e": "ghost",
	"410b2e0b-4ceb-1321-1727-20858f7f3477": "bandit",
	"e336c6b8-418d-9340-d77f-7a9e4cfe0702": "sheriff",
	"42da8ccc-40d5-affc-beec-15aa47b42eda": "shorty",
	"a03b24d3-4319-996d-0f8c-94bbfba1dfc7": "operator",
	"4ade7faa-4cf1-8376-95ef-39884480959b": "guardian",
	"c4883e50-4494-202c-3ec3-6b8a9284f00b": "marshal",
	"5f0aaf7a-4289-3998-d5ff-eb9a5cf7ef5c": "outlaw",
	"462080d1-4035-2937-7c09-27aa2a5c27a7": "spectre",
	"f7e1b454-4ad4-1063-ec0a-159e56b58941": "stinger",
	"2f59173c-4bed-b6c3-2191-dea9b58be9c7": "melee",
};

export const weaponCanonicalNameUUIDMap: Record<string, string> =
	Object.entries(weaponUUIDCanonicalNameMap).reduce(
		(acc, [key, value]) => {
			acc[value] = key;
			return acc;
		},
		{} as Record<string, string>,
	);

export const weaponUuidToIndex = Object.entries(sortedWeapons).reduce(
	(acc, [_category, weapons]) => {
		const totalAcc = Object.keys(acc).length;
		weapons.forEach((weapon, index) => {
			acc[weaponCanonicalNameUUIDMap[weapon]] = index + totalAcc;
		});
		return acc;
	},
	{} as Record<string, number>,
);
