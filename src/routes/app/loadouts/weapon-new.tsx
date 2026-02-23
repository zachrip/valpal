import { useReducer } from "react";
import {
	Dialog,
	DialogTrigger,
	Heading,
	Modal,
	ModalOverlay,
} from "react-aria-components";
import { redirect, useNavigate } from "react-router";
import invariant from "tiny-invariant";
import type { Loadout } from "~/apiClient";
import * as api from "~/apiClient";
import {
	type Buddy,
	type BuddyLevel,
	type Entitlement,
	entitlementTypeToIdMap,
	type Skin,
	type SkinChroma,
	type SkinLevel,
} from "~/types";
import { getValorantData } from "~/valorant-data";
import type { Route } from "./+types/weapon-new";

interface OwnedSkin {
	id: string;
	name: string;
	displayIcon: string;
	chromas: Array<{
		uuid: string;
		displayName: string;
		displayIcon: string;
		fullRender: string;
	}>;
	levels: Array<{
		uuid: string;
		displayName: string;
		displayIcon: string;
	}>;
}

type OwnedBuddy = {
	buddyId: string;
	levelId: string;
	displayName: string;
	displayIcon: string;
};

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const { loadoutId, weaponId } = params;
	if (!loadoutId || !weaponId) throw new Error("Missing params");

	const [valorantData, userConfig, entitlementsData] = await Promise.all([
		getValorantData(),
		api.getUserConfig(),
		api.getEntitlements(),
	]);

	const loadout = userConfig.loadouts.find((l: Loadout) => l.id === loadoutId);
	if (!loadout) {
		throw new Error("Loadout not found");
	}

	const weapon = valorantData.weapons.find(
		(w: { uuid: string }) => w.uuid === weaponId,
	);
	if (!weapon) {
		throw new Error("Weapon not found");
	}

	const skinChromaType = entitlementsData.EntitlementsByTypes.find(
		(e: { ItemTypeID: string }) =>
			e.ItemTypeID === entitlementTypeToIdMap.skin_chroma,
	);
	const skinLevelType = entitlementsData.EntitlementsByTypes.find(
		(e: { ItemTypeID: string }) =>
			e.ItemTypeID === entitlementTypeToIdMap.skin_level,
	);
	const buddyType = entitlementsData.EntitlementsByTypes.find(
		(e: { ItemTypeID: string }) =>
			e.ItemTypeID === entitlementTypeToIdMap.buddy,
	);

	const skinChromaEntitlements: Entitlement[] =
		skinChromaType?.Entitlements || [];
	const skinLevelEntitlements: Entitlement[] =
		skinLevelType?.Entitlements || [];
	const buddyEntitlements: Entitlement[] = buddyType?.Entitlements || [];

	const ownedSkins = weapon.skins.reduce<OwnedSkin[]>(
		(acc: OwnedSkin[], skin: Skin) => {
			const chromas = skin.chromas.filter((chroma: SkinChroma) =>
				skinChromaEntitlements.some(
					(e: Entitlement) => e.ItemID === chroma.uuid,
				),
			);

			const levels = skin.levels.filter((level: SkinLevel) =>
				skinLevelEntitlements.some((e: Entitlement) => e.ItemID === level.uuid),
			);

			if (chromas.length === 0 && levels.length === 0) {
				return acc;
			}

			acc.push({
				id: skin.uuid,
				name: skin.displayName ?? "",
				displayIcon: skin.displayIcon ?? "",
				chromas: [skin.chromas[0], ...chromas].map((c) => ({
					uuid: c.uuid,
					displayName: c.displayName ?? "",
					displayIcon: c.displayIcon ?? "",
					fullRender: c.fullRender ?? "",
				})),
				levels: levels.map((l) => ({
					uuid: l.uuid,
					displayName: l.displayName ?? "",
					displayIcon: l.displayIcon ?? "",
				})),
			});

			return acc;
		},
		[],
	);

	const ownedBuddies: OwnedBuddy[] = valorantData.buddies
		.flatMap((buddy: Buddy) =>
			buddy.levels
				.map((level: BuddyLevel) => ({
					buddyId: buddy.uuid,
					levelId: level.uuid,
					displayName: buddy.displayName ?? "",
					displayIcon: level.displayIcon ?? "",
				}))
				.filter((b: OwnedBuddy) =>
					buddyEntitlements.some((e: Entitlement) => e.ItemID === b.levelId),
				),
		)
		.sort((a: OwnedBuddy, b: OwnedBuddy) =>
			(a.displayName ?? "").localeCompare(b.displayName ?? ""),
		);

	return { weapon, loadout, ownedSkins, ownedBuddies };
}

export async function clientAction({
	request,
	params,
}: Route.ClientActionArgs) {
	const { loadoutId, weaponId } = params;
	if (!loadoutId || !weaponId) throw new Error("Missing params");

	const formData = await request.formData();
	const skinId = formData.get("skinId") as string;
	const loadoutJson = formData.get("loadout") as string;
	const loadout: Loadout = JSON.parse(loadoutJson);

	const chromaIds: string[] = [];
	const levelIds: string[] = [];
	const buddies: Record<string, string[]> = {};

	formData.forEach((value, key) => {
		if (key.startsWith("chromas[") && value === "on") {
			chromaIds.push(key.slice(8, -1));
		}
		if (key.startsWith("levels[") && value === "on") {
			levelIds.push(key.slice(7, -1));
		}
		if (key.startsWith("buddies[") && value === "on") {
			const match = key.match(/buddies\[(.+?)\]\[(.+?)\]/);
			if (match) {
				const [, buddyId, levelId] = match;
				if (!buddies[buddyId]) buddies[buddyId] = [];
				buddies[buddyId].push(levelId);
			}
		}
	});

	const ownedSkins: OwnedSkin[] = JSON.parse(
		formData.get("ownedSkins") as string,
	);
	const skin = ownedSkins.find((s) => s.id === skinId);
	invariant(skin, "Skin not found");
	const defaultChroma = skin.chromas[skin.chromas.length - 1].uuid;
	const defaultLevel = skin.levels[skin.levels.length - 1]?.uuid;

	const existingWeapon = loadout.weapons[weaponId];

	const newLoadout: Loadout = {
		...loadout,
		weapons: {
			...loadout.weapons,
			[weaponId]: {
				...existingWeapon,
				templates: [
					...(existingWeapon?.templates || []),
					{
						id: crypto.randomUUID(),
						skinId,
						chromaIds: chromaIds.length ? chromaIds : [defaultChroma],
						levelIds: levelIds.length
							? levelIds
							: defaultLevel
								? [defaultLevel]
								: [],
						buddies: Object.entries(buddies).map(([id, lvlIds]) => ({
							id,
							levelIds: lvlIds,
						})),
					},
				],
			},
		},
	};

	await api.updateLoadout(newLoadout);
	return redirect(`/loadouts/${loadoutId}/weapons/${weaponId}`);
}

type NewSkinAction = {
	type: "SET_SELECTED_SKIN";
	payload: OwnedSkin;
};

type NewSkinState =
	| { mode: "select_skin"; title: string }
	| { mode: "select_chroma"; title: string; selectedSkin: OwnedSkin };

export default function NewSkinTemplateModal({
	loaderData,
	params,
}: Route.ComponentProps) {
	const { weapon, loadout, ownedSkins, ownedBuddies } = loaderData;
	const loadoutId = params.loadoutId;
	const weaponId = params.weaponId;
	const navigate = useNavigate();

	const [state, dispatch] = useReducer<NewSkinState, [NewSkinAction]>(
		(_state, action) => {
			switch (action.type) {
				case "SET_SELECTED_SKIN":
					return {
						mode: "select_chroma",
						title: action.payload.name,
						selectedSkin: action.payload,
					};
			}
		},
		{ mode: "select_skin", title: "Select a skin" },
	);

	const closeUrl = `/loadouts/${loadoutId}/weapons/${weaponId}`;

	return (
		<DialogTrigger
			isOpen
			onOpenChange={(open) => {
				if (!open) navigate(closeUrl);
			}}
		>
			<ModalOverlay className="bg-black/60 fixed inset-0 grid place-items-center z-60">
				<Modal className="w-full max-w-3xl h-3/5 bg-slate-700 rounded-md flex flex-col overflow-hidden">
					<Dialog className="flex flex-col h-full outline-none">
						<div className="flex flex-row items-center justify-between flex-none p-4 bg-slate-600">
							<Heading slot="title" className="text-2xl text-white">
								{state.title}
							</Heading>
							<button
								type="button"
								className="text-white cursor-pointer"
								onClick={() => navigate(closeUrl)}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									className="w-6 h-6"
									aria-label="Close"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>
						{state.mode === "select_skin" && (
							<div className="grid grid-cols-3 gap-2 flex-auto overflow-y-auto px-4 mr-4 mb-4 mt-4">
								{[...ownedSkins]
									.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
									.map((skin) => (
										<button
											key={skin.id}
											type="button"
											className="aspect-video flex flex-col items-center justify-center gap-4 p-2 hover:bg-slate-500 rounded-md"
											onClick={() =>
												dispatch({
													type: "SET_SELECTED_SKIN",
													payload: skin,
												})
											}
										>
											<div className="w-full flex-1 relative">
												<img
													className="absolute top-0 right-0 bottom-0 left-0 w-full h-full object-contain"
													src={
														(skin.displayIcon ?? "") ||
														(skin.chromas[0]?.fullRender ?? "")
													}
													alt={skin.name ?? ""}
												/>
											</div>
											<h2 className="text-lg leading-4 text-white">
												{skin.name.split(" ").slice(0, -1).join(" ")}
											</h2>
										</button>
									))}
							</div>
						)}
						{state.mode === "select_chroma" && (
							<form method="post" className="contents">
								<input
									type="hidden"
									name="skinId"
									value={state.selectedSkin.id}
								/>
								<input
									type="hidden"
									name="loadout"
									value={JSON.stringify(loadout)}
								/>
								<input
									type="hidden"
									name="ownedSkins"
									value={JSON.stringify(ownedSkins)}
								/>
								<div className="flex-auto overflow-y-auto px-4 mr-4 mb-4 mt-4">
									<div className="flex justify-center my-6">
										<img
											className="max-h-64"
											src={state.selectedSkin.displayIcon ?? ""}
											alt={state.title ?? ""}
										/>
									</div>
									<h1 className="text-xl text-white">Chromas</h1>
									<div className="grid grid-cols-4 gap-2 mt-2">
										{state.selectedSkin.chromas.map((chroma) => (
											<div key={chroma.uuid} className="aspect-video">
												<input
													id={chroma.uuid}
													name={`chromas[${chroma.uuid}]`}
													type="checkbox"
													className="hidden peer"
													defaultChecked={
														state.selectedSkin.chromas.length === 1
													}
												/>
												<label
													htmlFor={chroma.uuid}
													className="block w-full h-full p-2 peer-checked:bg-slate-500 hover:bg-slate-500 rounded-md cursor-pointer"
												>
													<img
														className="w-full h-full object-contain"
														src={
															(chroma.fullRender ?? "") ||
															(chroma.displayIcon ?? "")
														}
														alt={chroma.displayName ?? ""}
													/>
												</label>
											</div>
										))}
									</div>
									<h1 className="text-xl mt-4 text-white">Levels</h1>
									<div className="grid grid-cols-4 gap-2 mt-2">
										{state.selectedSkin.levels.map((level, index, arr) => (
											<div key={level.uuid} className="aspect-video">
												<input
													id={level.uuid}
													name={`levels[${level.uuid}]`}
													type="checkbox"
													className="hidden peer"
													defaultChecked={index === arr.length - 1}
												/>
												<label
													htmlFor={level.uuid}
													className="flex w-full h-full justify-center items-center p-2 peer-checked:bg-slate-500 hover:bg-slate-500 rounded-md text-white cursor-pointer"
												>
													{index + 1}
												</label>
											</div>
										))}
									</div>
									{weapon.uuid !== "2f59173c-4bed-b6c3-2191-dea9b58be9c7" && (
										<>
											<h1 className="text-xl mt-4 text-white">Buddies</h1>
											<div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto px-4 mr-4 mb-4 mt-4">
												{ownedBuddies.map((buddy: OwnedBuddy) => (
													<div key={buddy.buddyId + buddy.levelId}>
														<input
															id={buddy.buddyId + buddy.levelId}
															name={`buddies[${buddy.buddyId}][${buddy.levelId}]`}
															type="checkbox"
															className="hidden peer"
														/>
														<label
															htmlFor={buddy.buddyId + buddy.levelId}
															className="block w-full h-full p-2 peer-checked:bg-slate-500 hover:bg-slate-500 rounded-md cursor-pointer"
														>
															<div className="w-full aspect-square">
																<img
																	className="w-full h-full object-contain"
																	src={buddy.displayIcon ?? ""}
																	alt={buddy.displayName ?? ""}
																/>
															</div>
															<h2 className="text-sm text-white font-bold text-center whitespace-nowrap overflow-hidden text-ellipsis mt-2">
																{buddy.displayName.slice(0, -6)}
															</h2>
														</label>
													</div>
												))}
											</div>
										</>
									)}
								</div>
								<div className="p-4 flex flex-col gap-2">
									<button
										type="submit"
										className="w-full p-2 bg-green-600 hover:bg-green-500 text-white rounded-md transition-colors"
									>
										Add
									</button>
									<button
										type="button"
										className="w-full p-2 bg-slate-500 hover:bg-slate-400 text-white rounded-md transition-colors"
										onClick={() => navigate(closeUrl)}
									>
										Cancel
									</button>
								</div>
							</form>
						)}
					</Dialog>
				</Modal>
			</ModalOverlay>
		</DialogTrigger>
	);
}
