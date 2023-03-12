import type { LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Form, Link, Outlet, useLoaderData, useSubmit } from '@remix-run/react';
import { zfd } from 'zod-form-data';
import { z } from 'zod';

import type { WeaponCategory } from 'types';
import { Gallery } from '~/components/Gallery';
import { SwitchImage } from '~/components/SwitchImage';

import {
	categoryCanonicalNameMap,
	categoryNameMap,
	sortedWeapons,
} from '~/utils';
import { getUser, getUserConfig, saveUserConfig } from '~/utils.server';

const updateSchema = zfd.formData({
	name: zfd.text(z.string().optional().default('Loadout')),
	agents: z.record(z.string(), zfd.checkbox()).optional(),
});

export const action = async ({ request, params }: LoaderArgs) => {
	const user = await getUser();

	if (!user) {
		return redirect('/login');
	}

	const formData = await request.formData();
	const action = formData.get('action') as string;

	switch (action) {
		case 'update': {
			const loadoutId = params.loadoutId;
			const config = await getUserConfig(user.userId);
			const loadout = config.loadouts.find(
				(loadout) => loadout.id === loadoutId
			);

			if (!loadout) {
				return redirect('/loadouts');
			}

			const { name, agents } = updateSchema.parse(formData);

			loadout.name = name;
			(loadout.agentIds = Object.entries(agents || {}).reduce<Array<string>>(
				(acc, next) => {
					if (next[1]) {
						acc.push(next[0]);
					}
					return acc;
				},
				[]
			)),
				await saveUserConfig(user.userId, config);
			return redirect(`/loadouts/${loadoutId}`);
		}
		default: {
			throw new Error('Invalid action');
		}
	}
};

export const loader = async ({ params }: LoaderArgs) => {
	const user = await getUser();

	if (!user) {
		return redirect('/login');
	}

	const { loadoutId } = params;

	const userConfig = await getUserConfig(user.userId);
	const loadout = userConfig.loadouts.find(
		(loadout) => loadout.id === loadoutId
	);

	if (!loadout) {
		return redirect('/loadouts');
	}

	const weapons = valorantData.weapons;

	return json({
		allAgents: valorantData.agents,
		loadout: {
			id: loadout.id,
			name: loadout.name,
			agents: loadout.agentIds.map((agentId) => {
				const agent = valorantData.agents.find(
					(agent) => agent.uuid === agentId
				)!;
				return agent;
			}),
			playerCards: (loadout.playerCardIds.length
				? loadout.playerCardIds
				: ['9fb348bc-41a0-91ad-8a3e-818035c4e561']
			).map((id) => valorantData.playerCards.find((card) => card.uuid === id)!),
			playerTitles: (loadout.playerTitleIds.length
				? loadout.playerTitleIds
				: ['d13e579c-435e-44d4-cec2-6eae5a3c5ed4']
			).map(
				(id) => valorantData.playerTitles.find((title) => title.uuid === id)!
			),
			sprays: {
				preRound: (loadout.sprayIds.preRound.length
					? loadout.sprayIds.preRound
					: ['0a6db78c-48b9-a32d-c47a-82be597584c1']
				).map(
					(sprayId) =>
						valorantData.sprays.find((spray) => spray.uuid === sprayId)!
				),
				midRound: (loadout.sprayIds.midRound.length
					? loadout.sprayIds.midRound
					: ['0a6db78c-48b9-a32d-c47a-82be597584c1']
				).map(
					(sprayId) =>
						valorantData.sprays.find((spray) => spray.uuid === sprayId)!
				),
				postRound: (loadout.sprayIds.postRound.length
					? loadout.sprayIds.postRound
					: ['0a6db78c-48b9-a32d-c47a-82be597584c1']
				).map(
					(sprayId) =>
						valorantData.sprays.find((spray) => spray.uuid === sprayId)!
				),
			},
			weapons: Object.entries(loadout.weapons).map(
				([weaponId, { templates }]) => {
					const weapon = weapons.find((w) => w.uuid === weaponId)!;

					return {
						id: weaponId,
						displayName: weapon.displayName,
						displayIcon: weapon.displayIcon,
						category: weapon.category,
						uuid: weapon.uuid,
						templates: templates.map((template) => {
							const skin = weapon.skins.find(
								(skin) => skin.uuid === template.skinId
							)!;
							const chromas = skin.chromas.filter((chroma) =>
								template.chromaIds.includes(chroma.uuid)
							);
							const buddies = template.buddies.flatMap((buddy) => {
								const buddyData = valorantData.buddies.find(
									(b) => b.uuid === buddy.id
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
				}
			),
		},
	});
};

export default function Index() {
	const { loadout, allAgents } = useLoaderData<typeof loader>();
	const categories = loadout.weapons.reduce<
		Record<WeaponCategory, typeof loadout.weapons>
	>(
		(acc, weapon) => {
			const index = sortedWeapons[weapon.category].indexOf(
				weapon.displayName.toLowerCase()
			);
			acc[weapon.category][index] = weapon;
			return acc;
		},
		{
			'EEquippableCategory::Sidearm': [],
			'EEquippableCategory::SMG': [],
			'EEquippableCategory::Rifle': [],
			'EEquippableCategory::Sniper': [],
			'EEquippableCategory::Shotgun': [],
			'EEquippableCategory::Heavy': [],
			'EEquippableCategory::Melee': [],
		}
	);

	const submit = useSubmit();

	return (
		<>
			<div className="p-6">
				<Link
					to="/loadouts"
					className="flex flex-row items-center text-white text-xl font-bold uppercase"
				>
					<svg
						className="w-6 h-6 text-white"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M15 19L9 12L15 5"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					Loadouts
				</Link>
				<Form
					method="post"
					className="flex flex-row flex-wrap mt-4 gap-6"
					onChange={(e) => {
						submit(e.currentTarget, {
							replace: true,
						});
					}}
				>
					<input type="hidden" name="action" value="update" />
					<div className="flex flex-col">
						<h1 className="uppercase text-2xl text-white font-bold">
							Loadout Name
						</h1>
						<div className="mt-4">
							<input
								type="text"
								name="name"
								className="bg-transparent text-white text-2xl font-bold uppercase w-96 border-b-2"
								defaultValue={loadout.name}
							/>
						</div>
					</div>
					<div className="flex flex-col">
						<h1 className="uppercase text-2xl text-white font-bold">Agents</h1>
						<div className="mt-4 flex flex-row flex-wrap gap-2">
							{allAgents.map((agent) => (
								<div key={agent.uuid} className="w-16 h-16">
									<input
										id={agent.uuid}
										name={`agents[${agent.uuid}]`}
										type="checkbox"
										className="hidden peer"
										defaultChecked={loadout.agents.some(
											(a) => a.uuid === agent.uuid
										)}
									/>
									<label
										htmlFor={agent.uuid}
										className="block w-full h-full p-2 peer-checked:bg-slate-500 hover:bg-slate-500 rounded-md"
									>
										<img
											className="w-full h-full object-contain"
											src={agent.displayIcon}
											alt={agent.displayName}
										/>
									</label>
								</div>
							))}
						</div>
					</div>
					<button type="submit" disabled hidden />
				</Form>
				<div className="flex flex-row items-start gap-8">
					<div className="flex flex-col mt-6 gap-10 flex-none px-4">
						<div className="flex flex-col flex-none items-center">
							<h1 className="uppercase text-2xl text-white font-bold">
								Player Cards
							</h1>
							<div className="mt-4">
								<Link
									to="playercards/add"
									className="relative grid place-items-center rounded-md text-3xl overflow-hidden group p-2"
								>
									<Gallery
										items={loadout.playerCards.map((card) => ({
											...card,
											duration: 1000,
										}))}
										render={(card) => (
											<div className="flex flex-col">
												<div
													className="h-80"
													style={{
														aspectRatio: '268 / 640',
													}}
												>
													<img
														className="object-contain w-full h-full"
														src={card.largeArt}
														alt={card.displayName}
													/>
												</div>
												<h2 className="text-sm text-white font-bold text-center whitespace-nowrap overflow-hidden text-ellipsis mt-2">
													{card.displayName.slice(0, -5)}
												</h2>
											</div>
										)}
									/>
									<div className="grid place-items-center absolute left-0 top-0 w-full h-full bg-black/60 opacity-0 group-hover:opacity-100 ">
										Edit
									</div>
								</Link>
							</div>
						</div>
						<div className="flex flex-col flex-none items-center">
							<h1 className="uppercase text-2xl text-white font-bold">
								Player Titles
							</h1>
							<div className="mt-4 w-full">
								<Link
									to="playertitles/add"
									className="relative grid place-items-center rounded-md text-3xl overflow-hidden group w-full aspect-video"
								>
									<Gallery
										items={loadout.playerTitles.map((t) => ({
											...t,
											duration: 1000,
										}))}
										render={(title) => (
											<h2 className="text-sm text-white font-bold">
												{title.titleText || 'Default'}
											</h2>
										)}
									/>
									<div className="grid place-items-center absolute left-0 top-0 w-full h-full bg-black/60 opacity-0 group-hover:opacity-100 ">
										Edit
									</div>
								</Link>
							</div>
						</div>
						<div className="flex flex-col flex-none items-center">
							<h1 className="uppercase text-2xl text-white font-bold">
								Sprays
							</h1>
							<div className="mt-4 w-full">
								<div
									className="w-full grid place-items-center text-3xl h-80"
									style={{
										aspectRatio: '268 / 640',
									}}
								>
									<div className="grid grid-cols-1 place-items-center gap-2 w-full">
										{Object.entries(loadout.sprays).map(([key, sprays]) => {
											return (
												<Link
													to={`sprays/${key.toLowerCase()}`}
													key={key}
													className="flex flex-col relative overflow-hidden rounded-md group p-2 w-full"
												>
													<h2 className="text-sm text-white text-center font-bold uppercase">
														{key}
													</h2>
													<Gallery
														items={sprays.map((spray) => ({
															...spray,
															duration: 1000,
														}))}
														render={(spray) => (
															<div>
																<div className="h-24 aspect-square mx-auto">
																	<img
																		className="object-contain w-full h-full"
																		src={
																			spray.animationGif ||
																			spray.fullTransparentIcon ||
																			spray.displayIcon
																		}
																		alt={spray.displayName}
																	/>
																</div>
																<h2 className="text-sm text-white font-bold text-center whitespace-nowrap overflow-hidden text-ellipsis mt-2">
																	{spray.displayName}
																</h2>
															</div>
														)}
													/>
													<div className="grid place-items-center absolute left-0 top-0 w-full h-full bg-black/60 opacity-0 group-hover:opacity-100">
														Edit
													</div>
												</Link>
											);
										})}
									</div>
								</div>
							</div>
						</div>
					</div>
					<div
						className="grid gap-12 mt-16"
						style={{
							display: 'grid',
							gridTemplateAreas: `
            "sidearm smg rifle sniper"
            "sidearm smg rifle sniper"
            "sidearm shotgun rifle heavy"
            "sidearm shotgun rifle heavy"
            "sidearm . . melee"
          `,
						}}
					>
						{categories &&
							Object.entries(categories).map(([category, weapons]) => {
								const categoryName =
									categoryNameMap[category as WeaponCategory];
								const canonicalCategoryName =
									categoryCanonicalNameMap[category as WeaponCategory];

								return (
									<div
										key={category}
										className="flex flex-col"
										style={{
											gridArea: canonicalCategoryName,
										}}
									>
										<div className="relative">
											<span className="absolute -top-10 w-full uppercase text-2xl text-white font-bold text-center">
												{categoryName}
											</span>
										</div>
										<div className="flex flex-col flex-grow gap-12">
											{weapons.map((weapon) => (
												<Link
													key={weapon.uuid}
													to={`weapons/${weapon.uuid}`}
													className="relative flex flex-col p-4 bg-slate-700 hover:bg-slate-500"
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
																	className="object-contain h-24 mx-auto px-8"
																/>
																{item.buddy && (
																	<img
																		src={item.buddy.icon}
																		alt={item.buddy.name}
																		className="absolute bottom-2 right-0 h-16 object-contain"
																	/>
																)}
															</>
														)}
													/>

													<span className="text-xl flex-none text-white font-light uppercase">
														{weapon.displayName}
													</span>
												</Link>
											))}
										</div>
									</div>
								);
							})}
					</div>
				</div>
			</div>
			<Outlet />
		</>
	);
}
