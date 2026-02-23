import { useState } from "react";
import {
	Dialog,
	DialogTrigger,
	Heading,
	Modal,
	ModalOverlay,
} from "react-aria-components";
import { useNavigate, useRevalidator } from "react-router";
import type { Loadout } from "~/apiClient";
import * as api from "~/apiClient";
import {
	type Entitlement,
	entitlementTypeToIdMap,
	type PlayerTitle,
} from "~/types";
import { getValorantData } from "~/valorant-data";
import type { Route } from "./+types/playertitles";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const [valorantData, userConfig, entitlementsData] = await Promise.all([
		getValorantData(),
		api.getUserConfig(),
		api.getEntitlements(),
	]);

	const loadout = userConfig.loadouts.find(
		(l: Loadout) => l.id === params.loadoutId,
	);
	if (!loadout) {
		throw new Error("Loadout not found");
	}

	const playerTitleType = entitlementsData.EntitlementsByTypes.find(
		(e: { ItemTypeID: string }) =>
			e.ItemTypeID === entitlementTypeToIdMap.player_title,
	);
	const playerTitleEntitlements: Entitlement[] =
		playerTitleType?.Entitlements || [];

	const ownedPlayerTitles = valorantData.playerTitles
		.filter((title: PlayerTitle) =>
			playerTitleEntitlements.some((e: Entitlement) => e.ItemID === title.uuid),
		)
		.sort((a: PlayerTitle, b: PlayerTitle) =>
			(a.displayName ?? "").localeCompare(b.displayName ?? ""),
		);

	return {
		loadout,
		selectedPlayerTitles: loadout.playerTitleIds,
		ownedPlayerTitles,
	};
}

export default function PlayerTitlesModal({
	loaderData,
	params,
}: Route.ComponentProps) {
	const {
		loadout,
		selectedPlayerTitles: initialSelected,
		ownedPlayerTitles,
	} = loaderData;
	const navigate = useNavigate();
	const revalidator = useRevalidator();
	const [selectedTitles, setSelectedTitles] =
		useState<string[]>(initialSelected);

	const toggleTitle = async (titleId: string) => {
		const newSelected = selectedTitles.includes(titleId)
			? selectedTitles.filter((id) => id !== titleId)
			: [...selectedTitles, titleId];

		setSelectedTitles(newSelected);

		const newLoadout: Loadout = {
			...loadout,
			playerTitleIds: newSelected,
		};

		await api.updateLoadout(newLoadout);
		revalidator.revalidate();
	};

	return (
		<DialogTrigger
			isOpen
			onOpenChange={(open) => {
				if (!open) navigate(`/loadouts/${params.loadoutId}`);
			}}
		>
			<ModalOverlay className="bg-black/60 fixed inset-0 grid place-items-center z-50">
				<Modal className="w-full max-w-3xl h-3/5 bg-slate-700 rounded-md flex flex-col overflow-hidden">
					<Dialog className="flex flex-col h-full outline-none">
						<div className="flex flex-row items-center justify-between flex-none p-4 bg-slate-600">
							<Heading slot="title" className="text-2xl text-white">
								Select Player Titles
							</Heading>
							<button
								type="button"
								className="text-white cursor-pointer"
								onClick={() => navigate(`/loadouts/${params.loadoutId}`)}
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
						<div className="flex-auto overflow-y-auto px-4 mr-4 mb-4 mt-4">
							<div className="grid grid-cols-3 gap-2 mt-2">
								{ownedPlayerTitles.map((title: PlayerTitle) => (
									<button
										key={title.uuid}
										type="button"
										onClick={() => toggleTitle(title.uuid)}
										className={`block p-4 rounded-md transition-colors text-center ${
											selectedTitles.includes(title.uuid)
												? "bg-slate-500"
												: "hover:bg-slate-500"
										}`}
									>
										<h2 className="text-lg text-white font-medium">
											{title.titleText || "Default"}
										</h2>
									</button>
								))}
							</div>
						</div>
					</Dialog>
				</Modal>
			</ModalOverlay>
		</DialogTrigger>
	);
}
