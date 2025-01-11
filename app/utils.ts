import type { EntitlementsByCategory, Weapon, WeaponCategory } from 'types';

export type LoadoutV1 = {
	id: string;
	name: string;
	enabled: boolean;
	agentIds: Array<string>;
	weapons: Record<
		string,
		{
			templates: Array<{
				id: string;
				skinId: string;
				levelIds: Array<string>;
				chromaIds: Array<string>;
				buddies: Array<{
					id: string;
					levelIds: Array<string>;
				}>;
			}>;
		}
	>;
	playerCardIds: Array<string>;
	playerTitleIds: Array<string>;
	sprayIds: {
		preRound: Array<string>;
		midRound: Array<string>;
		postRound: Array<string>;
	};
};

export type LoadoutV2 = {
	id: string;
	name: string;
	enabled: boolean;
	agentIds: Array<string>;
	weapons: Record<
		string,
		{
			templates: Array<{
				id: string;
				skinId: string;
				levelIds: Array<string>;
				chromaIds: Array<string>;
				buddies: Array<{
					id: string;
					levelIds: Array<string>;
				}>;
			}>;
		}
	>;
	playerCardIds: Array<string>;
	playerTitleIds: Array<string>;
	sprayIds: {
		top: Array<string>;
		right: Array<string>;
		bottom: Array<string>;
		left: Array<string>;
	};
};

export type Loadout = {
	id: string;
	name: string;
	enabled: boolean;
	agentIds: Array<string>;
	weapons: Record<
		string,
		{
			templates: Array<{
				id: string;
				skinId: string;
				levelIds: Array<string>;
				chromaIds: Array<string>;
				buddies: Array<{
					id: string;
					levelIds: Array<string>;
				}>;
			}>;
		}
	>;
	playerCardIds: Array<string>;
	playerTitleIds: Array<string>;
	expressionIds: {
		top: {
			sprayIds: Array<string>;
			flexIds: Array<string>;
		};
		right: {
			sprayIds: Array<string>;
			flexIds: Array<string>;
		};
		bottom: {
			sprayIds: Array<string>;
			flexIds: Array<string>;
		};
		left: {
			sprayIds: Array<string>;
			flexIds: Array<string>;
		};
	};
};

export type UserConfigV1 = {
	loadouts: Array<LoadoutV1>;
};

export type UserConfigV2 = {
	version: 2;
	loadouts: Array<LoadoutV2>;
};

export type UserConfigV3 = {
	version: 3;
	loadouts: Array<Loadout>;
};

export { type UserConfigV3 as UserConfig };

export const categoryNameMap: Record<WeaponCategory, string> = {
	'EEquippableCategory::Sidearm': 'sidearms',
	'EEquippableCategory::SMG': 'smgs',
	'EEquippableCategory::Rifle': 'rifles',
	'EEquippableCategory::Sniper': 'sniper rifles',
	'EEquippableCategory::Shotgun': 'shotguns',
	'EEquippableCategory::Heavy': 'machine guns',
	'EEquippableCategory::Melee': 'melee',
};

export const categoryCanonicalNameMap: Record<WeaponCategory, string> = {
	'EEquippableCategory::Sidearm': 'sidearm',
	'EEquippableCategory::SMG': 'smg',
	'EEquippableCategory::Rifle': 'rifle',
	'EEquippableCategory::Sniper': 'sniper',
	'EEquippableCategory::Shotgun': 'shotgun',
	'EEquippableCategory::Heavy': 'heavy',
	'EEquippableCategory::Melee': 'melee',
};

export const sortedWeapons: Record<WeaponCategory, string[]> = {
	'EEquippableCategory::Sidearm': [
		'classic',
		'shorty',
		'frenzy',
		'ghost',
		'sheriff',
	],
	'EEquippableCategory::SMG': ['stinger', 'spectre'],
	'EEquippableCategory::Rifle': ['bulldog', 'guardian', 'phantom', 'vandal'],
	'EEquippableCategory::Sniper': ['marshal', 'outlaw', 'operator'],
	'EEquippableCategory::Shotgun': ['bucky', 'judge'],
	'EEquippableCategory::Heavy': ['ares', 'odin'],
	'EEquippableCategory::Melee': ['melee'],
};

export const weaponUUIDCanonicalNameMap: Record<string, string> = {
	'63e6c2b6-4a8e-869c-3d4c-e38355226584': 'odin',
	'55d8a0f4-4274-ca67-fe2c-06ab45efdf58': 'ares',
	'9c82e19d-4575-0200-1a81-3eacf00cf872': 'vandal',
	'ae3de142-4d85-2547-dd26-4e90bed35cf7': 'bulldog',
	'ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a': 'phantom',
	'ec845bf4-4f79-ddda-a3da-0db3774b2794': 'judge',
	'910be174-449b-c412-ab22-d0873436b21b': 'bucky',
	'44d4e95c-4157-0037-81b2-17841bf2e8e3': 'frenzy',
	'29a0cfab-485b-f5d5-779a-b59f85e204a8': 'classic',
	'1baa85b4-4c70-1284-64bb-6481dfc3bb4e': 'ghost',
	'e336c6b8-418d-9340-d77f-7a9e4cfe0702': 'sheriff',
	'42da8ccc-40d5-affc-beec-15aa47b42eda': 'shorty',
	'a03b24d3-4319-996d-0f8c-94bbfba1dfc7': 'operator',
	'4ade7faa-4cf1-8376-95ef-39884480959b': 'guardian',
	'c4883e50-4494-202c-3ec3-6b8a9284f00b': 'marshal',
	'5f0aaf7a-4289-3998-d5ff-eb9a5cf7ef5c': 'outlaw',
	'462080d1-4035-2937-7c09-27aa2a5c27a7': 'spectre',
	'f7e1b454-4ad4-1063-ec0a-159e56b58941': 'stinger',
	'2f59173c-4bed-b6c3-2191-dea9b58be9c7': 'melee',
};

export const weaponCanonicalNameUUIDMap: Record<string, string> =
	Object.entries(weaponUUIDCanonicalNameMap).reduce(
		(acc, [key, value]) => {
			acc[value] = key;
			return acc;
		},
		{} as Record<string, string>,
	);

export const nameToIndex = Object.entries(sortedWeapons).reduce(
	(acc, [_category, weapons]) => {
		const totalAcc = Object.keys(acc).length;
		weapons.forEach((weapon, index) => {
			acc[weapon] = index + totalAcc;
		});
		return acc;
	},
	{} as Record<string, number>,
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

export type ResolvedWeapon = {
	uuid: string;
	displayName: string;
	category: WeaponCategory;
	defaultSkinIcon: string;
	resolvedSkins: Array<{
		id: string;
		name: string;
		skinIcon: string;
		buddyIcon: string;
	}>;
	ownedSkins: Array<{
		id: string;
		name: string;
		displayIcon: string;
		chromas: Array<{
			uuid: string;
			displayName: string;
			displayIcon: string;
			fullRender: string;
			swatch: string;
			streamedVideo: string;
			assetPath: string;
		}>;
		levels: Array<{
			uuid: string;
			displayName: string;
			levelItem: string | null;
			displayIcon: string | null;
			streamedVideo: string;
			assetPath: string;
		}>;
	}>;
};

export function getOwnedChromas(
	skin: Weapon['skins'][number],
	entitlements: EntitlementsByCategory,
) {
	return skin.chromas.filter(
		(chroma, index) =>
			index === 0 ||
			entitlements.skin_chroma.some(
				(entitlement) => entitlement.ItemID === chroma.uuid,
			),
	);
}

export function getOwnedLevels(
	skin: Weapon['skins'][number],
	entitlements: EntitlementsByCategory,
) {
	return skin.levels.filter((level) =>
		entitlements.skin_level.some(
			(entitlement) => entitlement.ItemID === level.uuid,
		),
	);
}
