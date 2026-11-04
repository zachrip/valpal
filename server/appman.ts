import {
	entitlementTypeToIdMap,
	type ValorantLoadout,
} from 'types';
import type { Loadout } from '~/utils';
import {
	getLockfile,
	getUser,
	getUserConfig,
	randomItem,
} from '~/utils.server';
import type { User } from './userman';
import { createTray, type Tray } from './tray';
import WebSocket from 'ws';
import { isAxiosError } from 'axios';

function describeError(e: unknown) {
	if (isAxiosError(e)) {
		return `${e.config?.method?.toUpperCase()} ${e.config?.url?.split('?')[0]} -> ${e.response ? `HTTP ${e.response.status}` : e.code}`;
	}
	return e instanceof Error ? e.message : String(e);
}

function sameId(a: string | undefined, b: string | undefined) {
	return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/** Nom de l'agent, ou son identifiant brut s'il est inconnu (nouvel agent...). */
function agentLabel(agentId: string | undefined) {
	if (!agentId) return 'agent inconnu';
	const agent = valorantData.agents.find((a) => sameId(a.uuid, agentId));
	return agent ? agent.displayName : `agent inconnu (${agentId})`;
}

function countSkinDifferences(
	sent: ValorantLoadout['Guns'],
	actual: ValorantLoadout['Guns'] | undefined,
): number | null {
	if (!Array.isArray(actual)) return null;
	const actualById = new Map(actual.map((g) => [g.ID, g]));
	return sent.filter((g) => {
		const a = actualById.get(g.ID);
		return !a || a.SkinID !== g.SkinID || a.ChromaID !== g.ChromaID;
	}).length;
}

function tryParseJson<T>(json: string): T | null {
	try {
		return JSON.parse(json);
	} catch (e) {
		return null;
	}
}

export class AppManager {
	private isAutoShuffleEnabled = true;
	private isAgentDetectionEnabled = true;

	private tray: Tray;
	private wsErrorLogged = false;

	constructor() {
		this.tray = createTray(
			`http://localhost:${process.env.PORT || '3000'}`,
			{
				onToggleShuffle: (enabled) => {
					this.isAutoShuffleEnabled = enabled;
				},
				onToggleAgentDetection: (enabled) => {
					this.isAgentDetectionEnabled = enabled;
				},
			},
		);
		this.connect();
	}

	notify(title: string, text: string) {
		this.tray.notify(title, text);
	}

	async connect() {
		try {
			const lockfile = await getLockfile();

			if (!lockfile) {
				setTimeout(() => {
					this.connect();
				}, 5000);
				return;
			}

			const { port, password } = lockfile;
			const ws = new WebSocket(`wss://riot:${password}@127.0.0.1:${port}`, {
				rejectUnauthorized: false,
			});

			const matchCharacterSelectionStates = new Map<string, string>();

			ws.addEventListener('open', async () => {
				try {
					console.log('Connecté au Riot Client, détection des parties active.');
					this.wsErrorLogged = false;
					ws.send(JSON.stringify([5, 'OnJsonApiEvent']));
				} catch (e) {
					console.warn('Erreur websocket (open) :', describeError(e));
				}
			});

			let abortController: AbortController = new AbortController();

			ws.addEventListener('message', async ({ data }) => {
				try {
					const parsed = tryParseJson<[number, string, object]>(
						data.toString(),
					);

					if (!parsed) {
						return;
					}

					const [type, event, payload] = parsed;

					if (type !== 8 || event !== 'OnJsonApiEvent') {
						return;
					}

					const { uri, eventType } = payload as {
						uri: string;
						eventType: string;
						data: object;
					};

					const uriMatch = uri.match(/\/pregame\/v1\/matches\/(.*)/);
					if (eventType === 'Create' && uriMatch && uriMatch[1]) {
						const matchId = uriMatch[1];

						const existingState = matchCharacterSelectionStates.get(matchId);

						if (existingState === 'locked') {
							return;
						}

						const user = await getUser();

						if (!user) {
							console.log('Partie détectée mais joueur introuvable.');
							return;
						}

						const match = await user.getPregame();

						const player = match.AllyTeam.Players.find(
							(player) => player.Subject === user.userId,
						);

						const newState = player?.CharacterSelectionState;

						if (
							newState &&
							newState !== matchCharacterSelectionStates.get(matchId)
						) {
							matchCharacterSelectionStates.set(matchId, newState);

							if (newState === 'locked') {
								console.log(`Agent verrouillé : ${agentLabel(player.CharacterID)}`);

								if (!this.isAutoShuffleEnabled) {
									console.log('Changement auto désactivé, rien à équiper.');
								} else {
									try {
										await this.equip(
											user,
											this.isAgentDetectionEnabled
												? player.CharacterID
												: undefined,
										);
									} catch (e) {
										console.warn('Échec de l\'équipement :', describeError(e));
									}
								}
							}
						}
					}
				} catch (e) {
					console.warn('Erreur pendant la sélection d\'agent / l\'équipement :', describeError(e));
				}
			});

			ws.addEventListener('close', () => {
				try {
					abortController?.abort();
					setTimeout(() => {
						this.connect();
					}, 5000);
				} catch (e) {
					console.warn('Erreur websocket (close) :', describeError(e));
				}
			});

			ws.addEventListener('error', (err) => {
				if (!this.wsErrorLogged) {
					console.warn('Connexion au Riot Client impossible :', err.message);
					this.wsErrorLogged = true;
				}
				// this.notify('Websocket Error', err.message);
			});
		} catch (e) {
			console.warn('Erreur de connexion :', describeError(e));
		}
	}

	equip = async (user: User, agentId?: string) => {
		const config = await getUserConfig(user.userId);
		const enabledLoadouts = config.loadouts.filter((loadout) => loadout.enabled);

		const loadoutsToConsider = (() => {
			if (!agentId) {
				return enabledLoadouts;
			}

			const agentSpecificLoadouts = enabledLoadouts.filter((l) =>
				l.agentIds.some((id) => sameId(id, agentId)),
			);

			if (agentSpecificLoadouts.length === 0) {
				console.log(
					`Aucun loadout spécifique à ${agentLabel(agentId)}, choix parmi tous les loadouts activés.`,
				);
				return enabledLoadouts;
			}

			console.log(`Loadouts spécifiques à ${agentLabel(agentId)} utilisés.`);
			return agentSpecificLoadouts;
		})();

		if (loadoutsToConsider.length === 0) {
			console.log('Aucun loadout activé, rien à équiper.');
			return;
		}

		const loadout = randomItem(loadoutsToConsider);
		await this.equipLoadout(user, loadout);
	};

	async equipLoadout(user: User, loadout: Loadout) {
		const weapons = valorantData.weapons;

		const [existingLoadout, entitlements] = await Promise.all([
			user.getLoadout(),
			user.getEntitlements(),
		]);

		const buddyEntitlements = entitlements.buddy.reduce((acc, buddy) => {
			const existing = acc.get(buddy.ItemID) || [];
			existing.push(buddy.InstanceID);

			acc.set(buddy.ItemID, existing);
			return acc;
		}, new Map<string, string[]>());

		const loadoutToEquip: ValorantLoadout = {
			...existingLoadout,
			Identity: {
				...existingLoadout.Identity,
				PlayerCardID:
					randomItem(loadout.playerCardIds) ||
					'9fb348bc-41a0-91ad-8a3e-818035c4e561',
				PlayerTitleID:
					randomItem(loadout.playerTitleIds) ||
					existingLoadout.Identity.PlayerTitleID,
			},
			ActiveExpressions: [
				randomItem([
					...loadout.expressionIds.top.sprayIds.map((id) => ({
						TypeID: entitlementTypeToIdMap.spray,
						AssetID: id,
					})),
					...loadout.expressionIds.top.flexIds.map((id) => ({
						TypeID: entitlementTypeToIdMap.flex,
						AssetID: id,
					})),
				]) || {
					TypeID: entitlementTypeToIdMap.spray,
					AssetID: '0a6db78c-48b9-a32d-c47a-82be597584c1',
				},
				randomItem([
					...loadout.expressionIds.right.sprayIds.map((id) => ({
						TypeID: entitlementTypeToIdMap.spray,
						AssetID: id,
					})),
					...loadout.expressionIds.right.flexIds.map((id) => ({
						TypeID: entitlementTypeToIdMap.flex,
						AssetID: id,
					})),
				]) || {
					TypeID: entitlementTypeToIdMap.spray,
					AssetID: '0a6db78c-48b9-a32d-c47a-82be597584c1',
				},
				randomItem([
					...loadout.expressionIds.bottom.sprayIds.map((id) => ({
						TypeID: entitlementTypeToIdMap.spray,
						AssetID: id,
					})),
					...loadout.expressionIds.bottom.flexIds.map((id) => ({
						TypeID: entitlementTypeToIdMap.flex,
						AssetID: id,
					})),
				]) || {
					TypeID: entitlementTypeToIdMap.spray,
					AssetID: '0a6db78c-48b9-a32d-c47a-82be597584c1',
				},
				randomItem([
					...loadout.expressionIds.left.sprayIds.map((id) => ({
						TypeID: entitlementTypeToIdMap.spray,
						AssetID: id,
					})),
					...loadout.expressionIds.left.flexIds.map((id) => ({
						TypeID: entitlementTypeToIdMap.flex,
						AssetID: id,
					})),
				]) || {
					TypeID: entitlementTypeToIdMap.flex,
					AssetID: 'af52b5a0-4a4c-03b2-c9d7-8187a08a2675',
				},
			],
			// On part de la liste complète renvoyée par Riot : une arme absente
			// de la config (ex. Bandit, ajouté en 2026) garde son skin actuel au
			// lieu de disparaître du loadout envoyé.
			Guns: existingLoadout.Guns.map((gun) => {
				const weaponId = gun.ID;
				const configured = loadout.weapons[weaponId];

				if (!configured) {
					return gun;
				}

				const { templates } = configured;

				if (!templates.length) {
					const weapon = weapons.find((w) => w.uuid === weaponId);
					const skin = weapon?.skins.find(
						(s) => s.uuid === weapon.defaultSkinUuid,
					);

					if (!skin) {
						return gun;
					}

					return {
						ID: weaponId,
						SkinID: skin.uuid,
						ChromaID: skin.chromas[0].uuid,
						SkinLevelID: skin.levels[0].uuid,
						Attachments: [],
					};
				}

				const template = randomItem(templates);

				const buddyData = (() => {
					const buddy = randomItem(template.buddies);
					if (!buddy) return null;

					const buddyLevelId = randomItem(buddy.levelIds);

					const consumedBuddy = (
						buddyEntitlements.get(buddyLevelId) || []
					).shift();

					if (!consumedBuddy) return null;

					return {
						CharmInstanceID: consumedBuddy,
						CharmID: buddy.id,
						CharmLevelID: buddyLevelId,
					};
				})();

				return {
					ID: weaponId,
					SkinID: template.skinId,
					ChromaID: randomItem(template.chromaIds),
					SkinLevelID: randomItem(template.levelIds),
					Attachments: [],
					...buddyData,
				};
			}),
		};

		console.log(`Équipement du loadout "${loadout.name}"...`);
		const saved = await user.equipLoadout(loadoutToEquip);

		const notApplied = countSkinDifferences(loadoutToEquip.Guns, saved?.Guns);
		if (notApplied === null) {
			console.log('Loadout envoyé à Riot.');
		} else if (notApplied === 0) {
			console.log('Loadout accepté par Riot.');
		} else {
			console.warn(
				`Riot a accepté la requête mais ${notApplied} arme(s) n'ont pas pris le skin demandé.`,
			);
		}

		// Vérification différée : si le jeu remet l'ancien loadout, on le saura.
		setTimeout(async () => {
			try {
				const current = await user.getLoadout();
				const reverted = countSkinDifferences(loadoutToEquip.Guns, current.Guns);
				if (reverted) {
					console.warn(
						`Attention : ${reverted} arme(s) sont revenues à un autre skin depuis l'équipement (remis par le jeu ?).`,
					);
				} else {
					console.log('Vérification : le loadout est toujours en place.');
				}
			} catch (e) {
				console.log('Vérification du loadout impossible :', describeError(e));
			}
		}, 45_000);
	}
}
