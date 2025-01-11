import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { Form, Link, useLoaderData } from 'react-router';
import { entitlementTypeToIdMap } from 'types';
import { Gallery } from '~/components/Gallery';

import { SwitchImage } from '~/components/SwitchImage';
import { Loadout, weaponUuidToIndex } from '~/utils';
import {
	getDefaultLoadout,
	getUser,
	getUserConfig,
	randomUUID,
	saveUserConfig,
} from '~/utils.server';

export const action = async ({ request }: ActionFunctionArgs) => {
	const user = await getUser();

	if (!user) {
		throw redirect('/login');
	}

	const formData = await request.formData();
	const action = formData.get('action') as string;

	switch (action) {
		case 'create': {
			const newLoadout = {
				...getDefaultLoadout(),
				name: 'New Loadout',
			};
			const config = await getUserConfig(user.userId);

			if (config.loadouts.find((loadout) => loadout.id === newLoadout.id)) {
				throw new Error('Loadout already exists');
			}

			config.loadouts.push(newLoadout);

			await saveUserConfig(user.userId, config);
			throw redirect(`/loadouts/${newLoadout.id}`);
		}
		case 'equip': {
			const loadoutId = formData.get('loadoutId') as string;
			const config = await getUserConfig(user.userId);
			const loadout = config.loadouts.find(
				(loadout) => loadout.id === loadoutId,
			);

			if (!loadout) {
				throw redirect('/loadouts');
			}

			await appManager.equipLoadout(user, loadout);

			return { success: true };
		}
		case 'enable':
		case 'disable': {
			const loadoutId = formData.get('loadoutId') as string;
			const config = await getUserConfig(user.userId);
			const loadout = config.loadouts.find(
				(loadout) => loadout.id === loadoutId,
			);

			if (!loadout) {
				throw redirect('/loadouts');
			}

			loadout.enabled = action === 'enable';

			await saveUserConfig(user.userId, config);

			return { success: true };
		}
		case 'duplicate': {
			const loadoutId = formData.get('loadoutId') as string;
			const config = await getUserConfig(user.userId);
			const loadout = config.loadouts.find(
				(loadout) => loadout.id === loadoutId,
			);

			if (!loadout) {
				throw redirect('/loadouts');
			}

			const newLoadout = {
				...loadout,
				id: randomUUID(),
				name: `${loadout.name} (Copy)`,
			};

			config.loadouts.push(newLoadout);

			await saveUserConfig(user.userId, config);

			throw redirect(`/loadouts/${newLoadout.id}`);
		}
		case 'delete': {
			const loadoutId = formData.get('loadoutId') as string;

			const config = await getUserConfig(user.userId);
			const loadoutIndex = config.loadouts.findIndex(
				(loadout) => loadout.id === loadoutId,
			);

			if (loadoutIndex === -1) {
				throw redirect('/loadouts');
			}

			config.loadouts.splice(loadoutIndex, 1);

			await saveUserConfig(user.userId, config);

			return { success: true };
		}
		case 'save-in-game': {
			const currentInGameLoadout = await user.getLoadout();
			const config = await getUserConfig(user.userId);

			const [top, right, bottom, left] = currentInGameLoadout.ActiveExpressions;

			const newLoadout: Loadout = {
				...getDefaultLoadout(),
				name: 'In-Game Loadout',
				enabled: true,
				id: randomUUID(),
				weapons: Object.fromEntries(
					currentInGameLoadout.Guns.map((gun) => [
						gun.ID,
						{
							templates: [
								{
									id: gun.ID,
									skinId: gun.SkinID,
									buddies: gun.CharmID
										? [
												{
													id: gun.CharmID,
													levelIds: gun.CharmLevelID ? [gun.CharmLevelID] : [],
												},
											]
										: [],
									chromaIds: [gun.ChromaID],
									levelIds: [gun.SkinLevelID],
								},
							],
						},
					]),
				),
				expressionIds: {
					top: {
						sprayIds:
							top.TypeID === entitlementTypeToIdMap.spray ? [top.AssetID] : [],
						flexIds:
							top.TypeID === entitlementTypeToIdMap.flex ? [top.AssetID] : [],
					},
					right: {
						sprayIds:
							right.TypeID === entitlementTypeToIdMap.spray
								? [right.AssetID]
								: [],
						flexIds:
							right.TypeID === entitlementTypeToIdMap.flex
								? [right.AssetID]
								: [],
					},
					bottom: {
						sprayIds:
							bottom.TypeID === entitlementTypeToIdMap.spray
								? [bottom.AssetID]
								: [],
						flexIds:
							bottom.TypeID === entitlementTypeToIdMap.flex
								? [bottom.AssetID]
								: [],
					},
					left: {
						sprayIds:
							left.TypeID === entitlementTypeToIdMap.spray
								? [left.AssetID]
								: [],
						flexIds:
							left.TypeID === entitlementTypeToIdMap.flex ? [left.AssetID] : [],
					},
				},
				playerCardIds: [currentInGameLoadout.Identity.PlayerCardID],
				playerTitleIds: [currentInGameLoadout.Identity.PlayerTitleID],
			};

			config.loadouts.push(newLoadout);

			await saveUserConfig(user.userId, config);

			throw redirect(`/loadouts/${newLoadout.id}`);
		}
		default: {
			throw new Error('Invalid action');
		}
	}
};

export const loader = async () => {
	const user = await getUser();

	if (!user) {
		throw redirect('/login');
	}

	const userConfig = await getUserConfig(user.userId);

	const weapons = valorantData.weapons;

	const loadouts = userConfig.loadouts
		.sort((a, b) => {
			if (a.enabled === b.enabled) {
				return a.name.localeCompare(b.name);
			}

			return a.enabled ? -1 : 1;
		})
		.map((loadout) => {
			return {
				id: loadout.id,
				name: loadout.name,
				enabled: loadout.enabled,
				agents: loadout.agentIds.map(
					(id) => valorantData.agents.find((a) => a.uuid === id)!,
				),
				playerCards: (loadout.playerCardIds.length
					? loadout.playerCardIds
					: ['9fb348bc-41a0-91ad-8a3e-818035c4e561']
				).map((id) => valorantData.playerCards.find((c) => c.uuid === id)!),
				playerTitles: (loadout.playerTitleIds.length
					? loadout.playerTitleIds
					: ['d13e579c-435e-44d4-cec2-6eae5a3c5ed4']
				).map(
					(id) => valorantData.playerTitles.find((title) => title.uuid === id)!,
				),
				expressions: {
					top: {
						sprayIds: (loadout.expressionIds.top.sprayIds.length ||
						loadout.expressionIds.top.flexIds.length
							? loadout.expressionIds.top.sprayIds
							: ['0a6db78c-48b9-a32d-c47a-82be597584c1']
						).map(
							(sprayId) =>
								valorantData.sprays.find((spray) => spray.uuid === sprayId)!,
						),
						flexIds: loadout.expressionIds.top.flexIds.map(
							(flexId) =>
								valorantData.flex.find((flex) => flex.uuid === flexId)!,
						),
					},
					right: {
						sprayIds: (loadout.expressionIds.right.sprayIds.length ||
						loadout.expressionIds.right.flexIds.length
							? loadout.expressionIds.right.sprayIds
							: ['0a6db78c-48b9-a32d-c47a-82be597584c1']
						).map(
							(sprayId) =>
								valorantData.sprays.find((spray) => spray.uuid === sprayId)!,
						),
						flexIds: loadout.expressionIds.right.flexIds.map(
							(flexId) =>
								valorantData.flex.find((flex) => flex.uuid === flexId)!,
						),
					},
					bottom: {
						sprayIds: (loadout.expressionIds.bottom.sprayIds.length ||
						loadout.expressionIds.bottom.flexIds.length
							? loadout.expressionIds.bottom.sprayIds
							: ['0a6db78c-48b9-a32d-c47a-82be597584c1']
						).map(
							(sprayId) =>
								valorantData.sprays.find((spray) => spray.uuid === sprayId)!,
						),
						flexIds: loadout.expressionIds.bottom.flexIds.map(
							(flexId) =>
								valorantData.flex.find((flex) => flex.uuid === flexId)!,
						),
					},
					left: {
						sprayIds: loadout.expressionIds.left.sprayIds.map(
							(sprayId) =>
								valorantData.sprays.find((spray) => spray.uuid === sprayId)!,
						),
						flexIds: (loadout.expressionIds.left.flexIds.length ||
						loadout.expressionIds.left.sprayIds.length
							? loadout.expressionIds.left.flexIds
							: ['af52b5a0-4a4c-03b2-c9d7-8187a08a2675']
						).map(
							(flexId) =>
								valorantData.flex.find((flex) => flex.uuid === flexId)!,
						),
					},
				},
				weapons: Object.entries(loadout.weapons)
					.sort((a, b) => {
						const indexA = weaponUuidToIndex[a[0]];
						const indexB = weaponUuidToIndex[b[0]];

						return indexA - indexB;
					})
					.map(([weaponId, { templates }]) => {
						const weapon = weapons.find((w) => w.uuid === weaponId)!;

						return {
							id: weaponId,
							displayName: weapon.displayName,
							displayIcon: weapon.displayIcon,
							category: weapon.category,
							uuid: weapon.uuid,
							templates: templates.map((template) => {
								const skin = weapon.skins.find(
									(skin) => skin.uuid === template.skinId,
								)!;
								const chromas = skin.chromas.filter((chroma) =>
									template.chromaIds.includes(chroma.uuid),
								);
								const buddies = template.buddies.flatMap((buddy) => {
									const buddyData = valorantData.buddies.find(
										(b) => b.uuid === buddy.id,
									)!;

									return buddy.levelIds.flatMap((levelId) => {
										return {
											id: buddy.id,
											levelId,
											displayName: buddyData.displayName,
											displayIcon: buddyData.displayIcon,
										};
									});
								});

								return {
									id: template.id,
									skin,
									chromas,
									buddies,
								};
							}),
						};
					}),
			};
		});

	return {
		loadouts,
	};
};

const buttonStyles =
	'cursor-pointer text-white px-2 py-1 border-2 border-white rounded-md hover:bg-white hover:text-slate-800';

export default function Index() {
	const { loadouts } = useLoaderData<typeof loader>();

	return (
		<div className="p-6">
			<div className="flex flex-row justify-between items-center">
				<h1 className="text-white text-3xl font-bold uppercase">Loadouts</h1>
				<Form
					action="/loadouts?index"
					method="POST"
					className="flex flex-row gap-4"
				>
					<button
						className={buttonStyles + ' flex flex-row items-center gap-1'}
						name="action"
						value="save-in-game"
					>
						Save In-Game Loadout
						<span className="text-2xl">+</span>
					</button>
					<button
						className={buttonStyles + ' flex flex-row items-center gap-1'}
						name="action"
						value="create"
					>
						New Loadout
						<span className="text-2xl">+</span>
					</button>
				</Form>
			</div>
			<div className="grid grid-cols-1 mt-4 gap-4">
				{loadouts.map((loadout) => {
					return (
						<div key={loadout.id} className="p-4 bg-black/30 rounded-md">
							<h2 className="flex flex-row items-center gap-1 text-white text-xl font-bold uppercase bg-transparent ">
								{loadout.name}
								{!loadout.enabled && (
									<>
										{' '}
										<span className="text-slate-400 text-sm">(Disabled)</span>
									</>
								)}
								<div className="flex flex-row flex-wrap">
									{loadout.agents.map((agent) => (
										<div key={agent.uuid} className="w-5 h-5">
											<img
												className="w-full h-full object-contain"
												src={agent.displayIcon}
												alt={agent.displayName}
											/>
										</div>
									))}
								</div>
							</h2>
							<div className="flex flex-row mt-2 items-stretch">
								<div className="flex-col">
									<div
										className="w-48"
										style={{
											aspectRatio: '268 / 640',
										}}
									>
										<SwitchImage
											className="object-contain w-full h-full"
											images={loadout.playerCards.map((c) => ({
												src: c.largeArt,
												alt: c.displayName,
											}))}
										/>
									</div>
									<Gallery
										items={loadout.playerTitles.map((t) => ({
											...t,
											duration: 1000,
										}))}
										render={(title) => (
											<h2 className="text-sm text-white font-bold text-center p-2 w-full whitespace-nowrap overflow-hidden text-ellipsis">
												{title.titleText || 'Default'}
											</h2>
										)}
									/>
									<div className="grid grid-cols-1 place-items-center gap-2 p-2">
										{Object.entries(loadout.expressions).map(
											([key, sprays]) => {
												return (
													<div
														key={key}
														className="flex flex-row bg-slate-700 p-2 hover:bg-slate-500 rounded-md"
													>
														<SwitchImage
															className="object-contain h-24"
															images={[
																...sprays.sprayIds.map((spray) => ({
																	src:
																		spray.animationGif ||
																		spray.fullTransparentIcon ||
																		spray.displayIcon,
																	alt: spray.displayName,
																})),
																...sprays.flexIds.map((flex) => ({
																	src: flex.displayIcon,
																	alt: flex.displayName,
																})),
															]}
														/>
													</div>
												);
											},
										)}
									</div>
								</div>
								<div className="grid gap-4 grid-cols-2 lg:grid-cols-4 px-4">
									{loadout.weapons.map((weapon) => {
										return (
											<div
												key={weapon.uuid}
												className="flex flex-col justify-center p-4 relative bg-slate-700 hover:bg-slate-500 rounded-md"
											>
												<Gallery
													items={
														weapon.templates.length
															? weapon.templates.flatMap((template) => {
																	return template.chromas.flatMap<{
																		chroma: {
																			icon: string;
																			name: string;
																		};
																		buddy: {
																			icon: string;
																			name: string;
																		} | null;
																		duration: number;
																	}>((chroma) => {
																		if (template.buddies.length === 0) {
																			return [
																				{
																					chroma: {
																						icon:
																							chroma.fullRender ||
																							chroma.displayIcon,
																						name: chroma.displayName,
																					},
																					buddy: null,
																					duration: 1000,
																				},
																			];
																		}

																		return template.buddies.map((buddy) => {
																			return {
																				chroma: {
																					icon:
																						chroma.fullRender ||
																						chroma.displayIcon,
																					name: chroma.displayName,
																				},
																				buddy: {
																					icon: buddy.displayIcon,
																					name: buddy.displayName,
																				},
																				duration: 1000,
																			};
																		});
																	});
																})
															: [
																	{
																		buddy: null,
																		chroma: {
																			icon: weapon.displayIcon,
																			name: weapon.displayName,
																		},
																		duration: 1000,
																	},
																]
													}
													render={(item) => (
														<>
															<img
																src={item.chroma.icon}
																alt={item.chroma.name}
																className="object-contain h-24"
															/>
															{item.buddy && (
																<img
																	src={item.buddy.icon}
																	alt={item.buddy.name}
																	className="absolute bottom-2 left-0 h-16 object-contain"
																/>
															)}
														</>
													)}
												/>
											</div>
										);
									})}
								</div>
							</div>
							<div className="mt-2 px-4 flex flex-row gap-2 items-start justify-end">
								<Form action="/loadouts?index" method="POST">
									<input
										type="hidden"
										name="action"
										value={loadout.enabled ? 'disable' : 'enable'}
									/>
									<input type="hidden" name="loadoutId" value={loadout.id} />
									<button className={buttonStyles}>
										{loadout.enabled ? 'Disable' : 'Enable'}
									</button>
								</Form>
								<Form action="/loadouts?index" method="POST">
									<input type="hidden" name="action" value="duplicate" />
									<input type="hidden" name="loadoutId" value={loadout.id} />
									<button className={buttonStyles}>Duplicate</button>
								</Form>
								<Form action="/loadouts?index" method="POST">
									<input type="hidden" name="action" value="equip" />
									<input type="hidden" name="loadoutId" value={loadout.id} />
									<button className={buttonStyles}>Equip Loadout</button>
								</Form>
								<Link to={`/loadouts/${loadout.id}`} className={buttonStyles}>
									Edit
								</Link>
								<Form action="/loadouts?index" method="POST">
									<input type="hidden" name="action" value="delete" />
									<input type="hidden" name="loadoutId" value={loadout.id} />
									<button className={buttonStyles}>Delete</button>
								</Form>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
