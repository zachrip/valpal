import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { Form, Link, redirect, useFetcher, useRevalidator } from "react-router";
import type { ShuffleSettings } from "~/apiClient";
import * as api from "~/apiClient";
import { Gallery } from "~/components/Gallery";
import { SwitchImage } from "~/components/SwitchImage";
import { weaponUuidToIndex } from "~/types";
import { getValorantData } from "~/valorant-data";
import valpalLogo from "~/valpal.png";
import type { Route } from "./+types/index";

export async function clientLoader() {
	const [valorantData, user, shuffleSettings] = await Promise.all([
		getValorantData(),
		api.getUser(),
		api.getShuffleSettings(),
	]);

	if (!user) {
		return { user: null, currentLoadout: null, loadouts: [], shuffleSettings };
	}

	let userConfig: api.UserConfig;
	let inGameLoadout: api.ValorantLoadout;
	try {
		[userConfig, inGameLoadout] = await Promise.all([
			api.getUserConfig(),
			api.getLoadout(),
		]);
	} catch {
		return { user: null, currentLoadout: null, loadouts: [], shuffleSettings };
	}

	const currentLoadout = {
		playerCard: valorantData.playerCards.find(
			(c) => c.uuid === inGameLoadout.Identity.PlayerCardID,
		),
		playerTitle: valorantData.playerTitles.find(
			(t) => t.uuid === inGameLoadout.Identity.PlayerTitleID,
		),
		weapons: inGameLoadout.Guns.map((gun) => {
			const weapon = valorantData.weapons.find((w) => w.uuid === gun.ID);
			const skin = weapon?.skins.find((s) => s.uuid === gun.SkinID);
			const chroma = skin?.chromas.find((c) => c.uuid === gun.ChromaID);
			return {
				weapon,
				templates: chroma ? [{ skin, chromas: [chroma] }] : [],
			};
		}).sort((a, b) => {
			const indexA = weaponUuidToIndex[a.weapon?.uuid ?? ""] ?? 999;
			const indexB = weaponUuidToIndex[b.weapon?.uuid ?? ""] ?? 999;
			return indexA - indexB;
		}),
	};

	const loadouts = userConfig.loadouts
		.sort((a, b) => {
			if (a.enabled === b.enabled) {
				return a.name.localeCompare(b.name);
			}
			return a.enabled ? -1 : 1;
		})
		.map((loadout) => {
			const defaultSpray = "0a6db78c-48b9-a32d-c47a-82be597584c1";
			const defaultFlex = "af52b5a0-4a4c-03b2-c9d7-8187a08a2675";

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
			const resolveSlotSprays = (slot: api.ExpressionSlot) =>
				findSprays(
					slot.sprayIds.length || slot.flexIds.length
						? slot.sprayIds
						: [defaultSpray],
				);
			const resolveSlotFlex = (slot: api.ExpressionSlot) =>
				findFlex(
					slot.flexIds.length || slot.sprayIds.length
						? slot.flexIds
						: [defaultFlex],
				);

			return {
				...loadout,
				agents: loadout.agentIds
					.map((id) => valorantData.agents.find((a) => a.uuid === id))
					.filter((a) => a !== undefined)
					.sort((a, b) =>
						(a.displayName ?? "").localeCompare(b.displayName ?? ""),
					),
				playerCards: (loadout.playerCardIds.length
					? loadout.playerCardIds
					: ["9fb348bc-41a0-91ad-8a3e-818035c4e561"]
				)
					.map((id) => valorantData.playerCards.find((c) => c.uuid === id))
					.filter(Boolean),
				playerTitles: (loadout.playerTitleIds.length
					? loadout.playerTitleIds
					: ["d13e579c-435e-44d4-cec2-6eae5a3c5ed4"]
				)
					.map((id) => valorantData.playerTitles.find((t) => t.uuid === id))
					.filter(Boolean),
				expressions: {
					top: {
						sprays: resolveSlotSprays(loadout.expressionIds.top),
						flexes: findFlex(loadout.expressionIds.top.flexIds),
					},
					right: {
						sprays: resolveSlotSprays(loadout.expressionIds.right),
						flexes: findFlex(loadout.expressionIds.right.flexIds),
					},
					bottom: {
						sprays: resolveSlotSprays(loadout.expressionIds.bottom),
						flexes: findFlex(loadout.expressionIds.bottom.flexIds),
					},
					left: {
						sprays: findSprays(loadout.expressionIds.left.sprayIds),
						flexes: resolveSlotFlex(loadout.expressionIds.left),
					},
				},
				weapons: valorantData.weapons
					.slice()
					.sort((a, b) => {
						const indexA = weaponUuidToIndex[a.uuid] ?? 999;
						const indexB = weaponUuidToIndex[b.uuid] ?? 999;
						return indexA - indexB;
					})
					.map((weapon) => {
						const config = loadout.weapons[weapon.uuid];
						const templates = (config?.templates || []).map((template) => {
							const skin = weapon.skins.find((s) => s.uuid === template.skinId);
							const chromas =
								skin?.chromas.filter((c) =>
									template.chromaIds.includes(c.uuid),
								) || [];
							return { skin, chromas };
						});

						return { weapon, templates };
					}),
			};
		});

	return { user, currentLoadout, loadouts, shuffleSettings };
}

export async function clientAction({ request }: Route.ClientActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "delete") {
		const loadoutId = formData.get("loadoutId") as string;
		await api.deleteLoadout(loadoutId);
		return redirect("/");
	}

	if (intent === "saveInGame") {
		await api.saveInGameLoadout("In-Game Loadout");
		return redirect("/");
	}

	if (intent === "setAutoShuffle") {
		await api.setAutoShuffleEnabled(formData.get("enabled") === "true");
		return { ok: true };
	}

	if (intent === "setAgentDetection") {
		await api.setAgentDetectionEnabled(formData.get("enabled") === "true");
		return { ok: true };
	}

	if (intent === "setNonPregameShuffle") {
		await api.setNonPregameShuffleEnabled(formData.get("enabled") === "true");
		return { ok: true };
	}

	if (intent === "equip") {
		const loadoutId = formData.get("loadoutId") as string;
		await api.equipLoadoutById(loadoutId);
		return { ok: true };
	}

	throw new Error(`Unknown intent: ${intent}`);
}

const buttonStyles =
	"cursor-pointer text-white px-3 py-2 border-2 border-white rounded-md hover:bg-white hover:text-slate-800 transition-colors";

function Toggle({
	fetcher,
	checked,
	intent,
	label,
	disabled,
}: {
	fetcher: ReturnType<typeof useFetcher>;
	checked: boolean;
	intent: string;
	label: string;
	disabled?: boolean;
}) {
	const optimistic = fetcher.formData
		? fetcher.formData.get("enabled") === "true"
		: checked;

	return (
		<fetcher.Form method="post">
			<input type="hidden" name="intent" value={intent} />
			<input type="hidden" name="enabled" value={String(!optimistic)} />
			<button
				type="submit"
				role="switch"
				aria-checked={optimistic}
				disabled={disabled}
				className={`flex items-center gap-2 group ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
			>
				<div
					className={`relative w-9 h-5 rounded-full transition-colors ${
						optimistic ? "bg-teal-500" : "bg-slate-600"
					}`}
				>
					<div
						className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
							optimistic ? "translate-x-4" : "translate-x-0"
						}`}
					/>
				</div>
				<span className={`text-sm transition-colors ${disabled ? "text-slate-500" : "text-slate-300 group-hover:text-white"}`}>
					{label}
				</span>
			</button>
		</fetcher.Form>
	);
}

export default function Index({ loaderData }: Route.ComponentProps) {
	const { user, currentLoadout, loadouts, shuffleSettings } = loaderData;

	const autoShuffleFetcher = useFetcher();
	const agentDetectionFetcher = useFetcher();
	const nonPregameShuffleFetcher = useFetcher();
	const revalidator = useRevalidator();

	const autoShuffleOn = autoShuffleFetcher.formData
		? autoShuffleFetcher.formData.get("enabled") === "true"
		: shuffleSettings.autoShuffleEnabled;

	useEffect(() => {
		const unlistenShuffle = listen<ShuffleSettings>("shuffle-settings-changed", () => {
			revalidator.revalidate();
		});
		const unlistenStatus = listen<boolean>("valorant-status", () => {
			revalidator.revalidate();
		});

		return () => {
			unlistenShuffle.then((fn) => fn());
			unlistenStatus.then((fn) => fn());
		};
	}, [revalidator]);

	if (!user) {
		return (
			<div className="flex flex-col items-center justify-center h-screen">
				<div className="flex flex-col items-center justify-center bg-[rgb(242,196,73)] p-4 rounded-lg">
					<img className="w-80" src={valpalLogo} alt="ValPal Logo" />
				</div>
				<h1 className="text-white text-2xl font-medium mt-2 animate-pulse">
					Waiting for Valorant...
				</h1>
			</div>
		);
	}

	return (
		<div className="p-6 min-w-[944px]">
			<div className="flex flex-row justify-between items-center">
				<h1 className="text-white text-3xl font-bold">
					{user?.player_info.game_name}
					<span className="text-gray-400 font-normal">
						#{user?.player_info.tag_line}
					</span>
				</h1>
				<div className="flex flex-row gap-4">
					<Link
						to="/loadouts/new"
						className={`${buttonStyles} flex flex-row items-center gap-1`}
					>
						New Loadout
						<span className="text-xl">+</span>
					</Link>
				</div>
			</div>
			<div className="mt-4 flex items-center gap-6">
				<Toggle
					fetcher={autoShuffleFetcher}
					checked={shuffleSettings.autoShuffleEnabled}
					intent="setAutoShuffle"
					label="Auto Shuffle"
				/>
				<Toggle
					fetcher={agentDetectionFetcher}
					checked={shuffleSettings.agentDetectionEnabled}
					intent="setAgentDetection"
					label="Agent Detection"
					disabled={!autoShuffleOn}
				/>
				<Toggle
					fetcher={nonPregameShuffleFetcher}
					checked={shuffleSettings.nonPregameShuffleEnabled}
					intent="setNonPregameShuffle"
					label="Non-Pregame Shuffle"
					disabled={!autoShuffleOn}
				/>
			</div>
			<div className="mt-6 p-4 bg-black/30 rounded-md border border-teal-500/40">
				<h2 className="flex flex-row items-center gap-2 text-white text-xl font-bold uppercase">
					Currently Equipped
					<span className="text-teal-400 text-sm font-normal tracking-wider">
						(In-Game)
					</span>
				</h2>

				<div className="flex flex-row mt-4 items-stretch gap-4">
					<div className="flex flex-col gap-2">
						<div className="w-32" style={{ aspectRatio: "268 / 640" }}>
							{currentLoadout.playerCard && (
								<img
									className="object-contain w-full h-full"
									src={currentLoadout.playerCard.largeArt ?? ""}
									alt={currentLoadout.playerCard.displayName ?? ""}
								/>
							)}
						</div>
						<h3 className="text-sm text-white font-bold text-center p-2 w-full whitespace-nowrap overflow-hidden text-ellipsis">
							{currentLoadout.playerTitle?.titleText || "Default"}
						</h3>
					</div>
					<div className="grid gap-2 grid-cols-4 flex-1">
						{currentLoadout.weapons.map((weapon) => (
							<div
								key={weapon?.weapon?.uuid}
								className="flex flex-col justify-center p-2 relative bg-slate-700 rounded-md"
							>
								{weapon?.templates?.[0]?.chromas?.[0] ? (
									<img
										src={
											(weapon.templates[0].chromas[0].fullRender ||
												weapon.templates[0].chromas[0].displayIcon) ??
											""
										}
										alt={weapon.templates[0].skin?.displayName ?? ""}
										className="object-contain h-16"
									/>
								) : (
									<img
										src={weapon?.weapon?.displayIcon ?? ""}
										alt={weapon?.weapon?.displayName ?? ""}
										className="object-contain h-16"
									/>
								)}
								<span className="text-xs text-white font-light uppercase text-center mt-1">
									{weapon?.weapon?.displayName}
								</span>
							</div>
						))}
					</div>
				</div>
				<Form
					method="post"
					className="mt-4 flex flex-row gap-2 items-start justify-end"
				>
					<input type="hidden" name="intent" value="saveInGame" />
					<button type="submit" className={buttonStyles}>
						Save as Loadout
					</button>
				</Form>
			</div>
			<div className="flex items-center gap-4 mt-8 mb-4">
				<h2 className="text-white text-xl font-bold uppercase flex-none">
					Saved Loadouts
				</h2>
				<div className="h-px bg-slate-600 flex-1" />
			</div>
			<div className="grid grid-cols-1 gap-4">
				{loadouts.map((loadout) => (
					<div key={loadout.id} className="p-4 bg-black/30 rounded-md">
						<h2 className="flex flex-row items-center gap-2 text-white text-xl font-bold uppercase">
							{loadout.name}
							{!loadout.enabled && (
								<span className="text-slate-400 text-sm">(Disabled)</span>
							)}
							<div className="flex flex-row flex-wrap gap-1">
								{loadout.agents.map((agent) => (
									<div key={agent?.uuid} className="w-5 h-5">
										<img
											className="w-full h-full object-contain"
											src={agent?.displayIcon ?? ""}
											alt={agent?.displayName ?? ""}
										/>
									</div>
								))}
							</div>
						</h2>
						<div className="flex flex-row mt-4 items-stretch gap-4">
							<div className="flex flex-col gap-2">
								<div className="w-32" style={{ aspectRatio: "268 / 640" }}>
									<SwitchImage
										className="object-contain w-full h-full"
										images={loadout.playerCards.map((c) => ({
											src: c?.largeArt ?? "",
											alt: c?.displayName ?? "",
										}))}
									/>
								</div>
								<Gallery
									items={loadout.playerTitles.map((t) => ({
										...t,
										duration: 1000,
									}))}
									render={(title) => (
										<h3 className="text-sm text-white font-bold text-center p-2 w-full whitespace-nowrap overflow-hidden text-ellipsis">
											{title?.titleText || "Default"}
										</h3>
									)}
								/>
								<div
									className="grid place-items-center mx-auto"
									style={{
										gridTemplateAreas: `
											". top ."
											"left . right"
											". bottom ."
										`,
										gridTemplateColumns: "1fr 1fr 1fr",
										gridTemplateRows: "1fr 1fr 1fr",
										width: "6rem",
										height: "6rem",
										gap: "3px",
									}}
								>
									{Object.entries(loadout.expressions).map(([key, exps]) => (
										<div
											key={key}
											className="w-full h-full grid place-items-center bg-slate-700 rounded"
											style={{ gridArea: key }}
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
														className="object-contain w-5 h-5"
														src={expression.icon ?? ""}
														alt={expression.displayName ?? ""}
													/>
												)}
											/>
										</div>
									))}
								</div>
							</div>
							<div className="grid gap-2 grid-cols-4 flex-1">
								{loadout.weapons.map((weapon) => (
									<div
										key={weapon?.weapon?.uuid}
										className="flex flex-col justify-center p-2 relative bg-slate-700 rounded-md"
									>
										{weapon?.templates?.[0]?.chromas?.[0] ? (
											<img
												src={
													(weapon.templates[0].chromas[0].fullRender ||
														weapon.templates[0].chromas[0].displayIcon) ??
													""
												}
												alt={weapon.templates[0].skin?.displayName ?? ""}
												className="object-contain h-16"
											/>
										) : (
											<img
												src={weapon?.weapon?.displayIcon ?? ""}
												alt={weapon?.weapon?.displayName ?? ""}
												className="object-contain h-16"
											/>
										)}
										<span className="text-xs text-white font-light uppercase text-center mt-1">
											{weapon?.weapon?.displayName}
										</span>
									</div>
								))}
							</div>
						</div>
						<div className="mt-4 flex flex-row gap-2 items-start justify-end">
							<Form method="post">
								<input type="hidden" name="intent" value="equip" />
								<input type="hidden" name="loadoutId" value={loadout.id} />
								<button
									type="submit"
									className="cursor-pointer text-teal-400 px-3 py-2 border-2 border-teal-400 rounded-md hover:bg-teal-400 hover:text-slate-900 transition-colors"
								>
									Equip
								</button>
							</Form>
							<Link to={`/loadouts/${loadout.id}`} className={buttonStyles}>
								Edit
							</Link>
							<Form
								method="post"
								onSubmit={(e) => {
									if (
										!confirm("Are you sure you want to delete this loadout?")
									) {
										e.preventDefault();
									}
								}}
							>
								<input type="hidden" name="intent" value="delete" />
								<input type="hidden" name="loadoutId" value={loadout.id} />
								<button type="submit" className={buttonStyles}>
									Delete
								</button>
							</Form>
						</div>
					</div>
				))}
				{loadouts.length === 0 && (
					<div className="text-center text-slate-400 py-12">
						<p className="text-xl">No loadouts yet.</p>
						<p className="mt-2">
							Create a new loadout or save your current in-game loadout to get
							started.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
