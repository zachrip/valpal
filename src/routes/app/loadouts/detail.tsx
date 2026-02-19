import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router";
import type { Loadout } from "~/apiClient";
import * as api from "~/apiClient";
import { Gallery } from "~/components/Gallery";
import { weaponUuidToIndex } from "~/types";
import { getValorantData } from "~/valorant-data";
import type { Route } from "./+types/detail";

type WeaponGalleryItem = {
	chroma: { icon: string; name: string };
	buddy: { icon: string; name: string } | null;
	duration: number;
};

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const [valorantData, userConfig] = await Promise.all([
		getValorantData(),
		api.getUserConfig(),
	]);

	const loadout = userConfig.loadouts.find((l) => l.id === params.loadoutId);
	if (!loadout) {
		throw new Error("Loadout not found");
	}

	return { valorantData, loadout };
}

export default function LoadoutDetailComponent({
	loaderData,
}: Route.ComponentProps) {
	const { valorantData, loadout: initialLoadout } = loaderData;
	const [loadout, setLoadout] = useState<Loadout>(initialLoadout);

	useEffect(() => {
		setLoadout(initialLoadout);
	}, [initialLoadout]);

	const toggleAgent = (agentId: string) => {
		const newLoadout = {
			...loadout,
			agentIds: loadout.agentIds.includes(agentId)
				? loadout.agentIds.filter((id) => id !== agentId)
				: [...loadout.agentIds, agentId],
		};
		setLoadout(newLoadout);
		api.updateLoadout(newLoadout);
	};

	const findCards = (ids: string[]) =>
		ids.flatMap((id) => {
			const c = valorantData.playerCards.find((card) => card.uuid === id);
			return c ? [c] : [];
		});
	const findTitles = (ids: string[]) =>
		ids.flatMap((id) => {
			const t = valorantData.playerTitles.find((title) => title.uuid === id);
			return t ? [t] : [];
		});
	const findSprays = (ids: string[]) =>
		ids.flatMap((id) => {
			const s = valorantData.sprays.find((spray) => spray.uuid === id);
			return s ? [s] : [];
		});
	const findFlex = (ids: string[]) =>
		ids.flatMap((id) => {
			const f = valorantData.flex.find((flex) => flex.uuid === id);
			return f ? [f] : [];
		});

	const playerCards = findCards(
		loadout.playerCardIds.length
			? loadout.playerCardIds
			: ["9fb348bc-41a0-91ad-8a3e-818035c4e561"],
	);

	const playerTitles = findTitles(
		loadout.playerTitleIds.length
			? loadout.playerTitleIds
			: ["d13e579c-435e-44d4-cec2-6eae5a3c5ed4"],
	);

	const resolveSlotSprays = (
		slot: api.ExpressionSlot,
		defaultSprayId: string,
	) =>
		findSprays(
			slot.sprayIds.length || slot.flexIds.length
				? slot.sprayIds
				: [defaultSprayId],
		);
	const resolveSlotFlex = (slot: api.ExpressionSlot, defaultFlexId: string) =>
		findFlex(
			slot.flexIds.length || slot.sprayIds.length
				? slot.flexIds
				: [defaultFlexId],
		);

	const defaultSpray = "0a6db78c-48b9-a32d-c47a-82be597584c1";
	const defaultFlex = "af52b5a0-4a4c-03b2-c9d7-8187a08a2675";

	const expressions = {
		top: {
			sprays: resolveSlotSprays(loadout.expressionIds.top, defaultSpray),
			flexes: findFlex(loadout.expressionIds.top.flexIds),
		},
		right: {
			sprays: resolveSlotSprays(loadout.expressionIds.right, defaultSpray),
			flexes: findFlex(loadout.expressionIds.right.flexIds),
		},
		bottom: {
			sprays: resolveSlotSprays(loadout.expressionIds.bottom, defaultSpray),
			flexes: findFlex(loadout.expressionIds.bottom.flexIds),
		},
		left: {
			sprays: findSprays(loadout.expressionIds.left.sprayIds),
			flexes: resolveSlotFlex(loadout.expressionIds.left, defaultFlex),
		},
	};

	return (
		<>
			<div className="p-6 min-w-[944px]">
				<Link
					to="/"
					className="flex flex-row items-center text-white text-xl font-bold uppercase"
				>
					<svg
						className="w-6 h-6 text-white"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
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

				<div className="flex flex-row flex-wrap mt-4 gap-6">
					<div className="flex flex-col">
						<h1 className="uppercase text-xl text-white font-bold">
							Loadout Name
						</h1>
						<div className="mt-4">
							<input
								type="text"
								className="bg-transparent text-white text-xl font-bold uppercase w-96 border-b-2"
								value={loadout.name}
								onChange={(e) => {
									setLoadout({ ...loadout, name: e.target.value });
								}}
								onBlur={() => api.updateLoadout(loadout)}
							/>
						</div>
					</div>
					<div className="flex flex-col">
						<h1 className="uppercase text-xl text-white font-bold">Agents</h1>
						<div className="mt-4 flex flex-row flex-wrap gap-2">
							{valorantData.agents.slice().sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? "")).map((agent) => (
								<button
									type="button"
									key={agent.uuid}
									onClick={() => toggleAgent(agent.uuid)}
									className={`w-16 h-16 p-2 rounded-md transition-colors ${
										loadout.agentIds.includes(agent.uuid)
											? "bg-slate-500"
											: "hover:bg-slate-500"
									}`}
								>
									<img
										className="w-full h-full object-contain"
										src={agent.displayIcon ?? ""}
										alt={agent.displayName ?? ""}
									/>
								</button>
							))}
						</div>
					</div>
				</div>

				<div className="flex flex-row mt-6 items-stretch gap-4">
					<div className="flex flex-col gap-2 items-center" style={{ width: "clamp(10rem, 15vw, 15rem)" }}>
						<div className="flex flex-col flex-none items-center">
							<h1 className="uppercase text-xl text-white font-bold whitespace-nowrap">
								Player Cards
							</h1>
							<div className="mt-4">
								<Link
									to={`/loadouts/${loadout.id}/playercards`}
									className="relative grid place-items-center rounded-md text-3xl overflow-hidden group p-2"
								>
									<Gallery
										items={playerCards.map((card) => ({
											...card,
											duration: 1000,
										}))}
										render={(card) => (
											<div className="flex flex-col">
											<div
												className="w-full"
												style={{ aspectRatio: "268 / 640" }}
											>
													<img
														className="object-contain w-full h-full"
														src={card.largeArt ?? ""}
														alt={card.displayName ?? ""}
													/>
												</div>
												<h2 className="text-sm text-white font-bold text-center whitespace-nowrap overflow-hidden text-ellipsis mt-2">
													{(card.displayName ?? "").slice(0, -5)}
												</h2>
											</div>
										)}
									/>
									<div className="grid place-items-center absolute left-0 top-0 w-full h-full bg-black/60 opacity-0 group-hover:opacity-100">
										Edit
									</div>
								</Link>
							</div>
						</div>

						<div className="flex flex-col flex-none items-center">
							<h1 className="uppercase text-xl text-white font-bold whitespace-nowrap">
								Player Titles
							</h1>
							<div className="mt-4 w-full">
								<Link
									to={`/loadouts/${loadout.id}/playertitles`}
									className="relative grid place-items-center rounded-md text-3xl overflow-hidden group w-full aspect-video"
								>
									<Gallery
										items={playerTitles.map((t) => ({ ...t, duration: 1000 }))}
										render={(title) => (
											<h2 className="text-sm text-white font-bold">
												{title.titleText || "Default"}
											</h2>
										)}
									/>
									<div className="grid place-items-center absolute left-0 top-0 w-full h-full bg-black/60 opacity-0 group-hover:opacity-100">
										Edit
									</div>
								</Link>
							</div>
						</div>

						<div className="flex flex-col flex-none items-center">
							<h1 className="uppercase text-xl text-white font-bold whitespace-nowrap">
								Expressions
							</h1>
							<div
								className="mt-4 grid place-items-center w-full aspect-square"
								style={{
									gridTemplateAreas: `
										". top ."
										"left . right"
										". bottom ."
									`,
									gridTemplateColumns: "1fr 1fr 1fr",
									gridTemplateRows: "1fr 1fr 1fr",
									gap: "4px",
								}}
							>
								{(
									Object.entries(expressions) as [
										string,
										{
											sprays: typeof valorantData.sprays;
											flexes: typeof valorantData.flex;
										},
									][]
								).map(([key, exps]) => (
									<Link
										to={`/loadouts/${loadout.id}/expressions/${key.toLowerCase()}`}
										key={key}
										className="relative overflow-hidden rounded-md group w-full h-full grid place-items-center bg-slate-700 hover:bg-slate-500"
										style={{ gridArea: key.toLowerCase() }}
									>
										<Gallery
											items={[
												...exps.sprays.map((spray) => ({
													icon:
														spray.animationGif ??
														spray.fullTransparentIcon ??
														spray.displayIcon ??
														"",
													displayName: spray.displayName ?? "",
													duration: 1000,
												})),
												...exps.flexes.map((flex) => ({
													icon: flex.displayIcon ?? "",
													displayName: flex.displayName ?? "",
													duration: 1000,
												})),
											]}
											render={(expression) => (
												<img
													className="object-contain w-2/3 h-2/3"
													src={expression.icon ?? ""}
													alt={expression.displayName ?? ""}
												/>
											)}
										/>
										<div className="grid place-items-center absolute left-0 top-0 w-full h-full bg-black/60 opacity-0 group-hover:opacity-100 text-xs text-white font-bold uppercase rounded-md">
											{key}
										</div>
									</Link>
								))}
							</div>
						</div>
					</div>

					<div className="grid gap-2 grid-cols-4 flex-1 content-start">
						{valorantData.weapons
							.slice()
							.sort((a, b) => {
								const indexA = weaponUuidToIndex[a.uuid] ?? 999;
								const indexB = weaponUuidToIndex[b.uuid] ?? 999;
								return indexA - indexB;
							})
							.map((weapon) => {
								const config = loadout.weapons[weapon.uuid];
								const templates = config?.templates || [];

								const galleryItems: WeaponGalleryItem[] =
									templates.length > 0
										? templates.flatMap((template) => {
												const skin = weapon.skins.find(
													(s) => s.uuid === template.skinId,
												);
												if (!skin) return [];

												const chromas = skin.chromas.filter((c) =>
													template.chromaIds.includes(c.uuid),
												);
												const buddies = template.buddies.flatMap((buddy) => {
													const buddyData = valorantData.buddies.find(
														(b) => b.uuid === buddy.id,
													);
													if (!buddyData) return [];
													return buddy.levelIds.map((levelId) => ({
														id: buddy.id,
														levelId,
														displayName: buddyData.displayName,
														displayIcon: buddyData.displayIcon,
													}));
												});

												if (chromas.length === 0) return [];

												return chromas.flatMap(
													(chroma): WeaponGalleryItem[] => {
														if (buddies.length === 0) {
															return [
																{
																	chroma: {
																		icon:
																			chroma.fullRender ??
																			chroma.displayIcon ??
																			"",
																		name: chroma.displayName ?? "",
																	},
																	buddy: null,
																	duration: 1000,
																},
															];
														}
														return buddies.map((buddy) => ({
															chroma: {
																icon:
																	chroma.fullRender ??
																	chroma.displayIcon ??
																	"",
																name: chroma.displayName ?? "",
															},
															buddy: {
																icon: buddy.displayIcon ?? "",
																name: buddy.displayName ?? "",
															},
															duration: 1000,
														}));
													},
												);
											})
										: [
												{
													chroma: {
														icon: weapon.displayIcon ?? "",
														name: weapon.displayName ?? "",
													},
													buddy: null,
													duration: 1000,
												},
											];

								return (
									<Link
										key={weapon.uuid}
										to={`/loadouts/${loadout.id}/weapons/${weapon.uuid}`}
										className="flex flex-col justify-center p-2 relative bg-slate-700 rounded-md hover:bg-slate-500 group"
									>
										<Gallery
											items={galleryItems}
											render={(item) => (
												<>
													<img
														src={item.chroma.icon}
														alt={item.chroma.name}
														className="object-contain h-16"
													/>
													{item.buddy && (
														<img
															src={item.buddy.icon}
															alt={item.buddy.name}
															className="absolute bottom-2 right-0 h-10 object-contain"
														/>
													)}
												</>
											)}
										/>
										<span className="text-xs text-white font-light uppercase text-center mt-1">
											{weapon.displayName}
										</span>
										<div className="grid place-items-center absolute left-0 top-0 w-full h-full bg-black/60 opacity-0 group-hover:opacity-100 rounded-md">
											Edit
										</div>
									</Link>
								);
							})}
					</div>
				</div>
			</div>
			<Outlet />
		</>
	);
}
