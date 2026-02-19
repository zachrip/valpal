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
	type PlayerCard,
} from "~/types";
import { getValorantData } from "~/valorant-data";
import type { Route } from "./+types/playercards";

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

	const playerCardType = entitlementsData.EntitlementsByTypes.find(
		(e: { ItemTypeID: string }) =>
			e.ItemTypeID === entitlementTypeToIdMap.player_card,
	);
	const playerCardEntitlements: Entitlement[] =
		playerCardType?.Entitlements || [];

	const ownedPlayerCards = valorantData.playerCards
		.filter((card: PlayerCard) =>
			playerCardEntitlements.some((e: Entitlement) => e.ItemID === card.uuid),
		)
		.sort((a: PlayerCard, b: PlayerCard) =>
			(a.displayName ?? "").localeCompare(b.displayName ?? ""),
		);

	return {
		loadout,
		selectedPlayerCards: loadout.playerCardIds,
		ownedPlayerCards,
	};
}

export default function PlayerCardsModal({
	loaderData,
	params,
}: Route.ComponentProps) {
	const {
		loadout,
		selectedPlayerCards: initialSelected,
		ownedPlayerCards,
	} = loaderData;
	const navigate = useNavigate();
	const revalidator = useRevalidator();
	const [selectedCards, setSelectedCards] = useState<string[]>(initialSelected);

	const toggleCard = async (cardId: string) => {
		const newSelected = selectedCards.includes(cardId)
			? selectedCards.filter((id) => id !== cardId)
			: [...selectedCards, cardId];

		setSelectedCards(newSelected);

		const newLoadout: Loadout = {
			...loadout,
			playerCardIds: newSelected,
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
								Select Player Cards
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
							<div className="grid grid-cols-4 gap-2 mt-2">
								{ownedPlayerCards.map((playerCard: PlayerCard) => (
									<button
										key={playerCard.uuid}
										type="button"
										onClick={() => toggleCard(playerCard.uuid)}
										className={`block p-2 rounded-md transition-colors ${
											selectedCards.includes(playerCard.uuid)
												? "bg-slate-500"
												: "hover:bg-slate-500"
										}`}
									>
										<img
											className="w-full h-full object-contain"
											style={{ aspectRatio: "280 / 640" }}
											src={playerCard.largeArt ?? ""}
											alt={playerCard.displayName ?? ""}
										/>
										<h2 className="text-center text-sm text-white mt-2">
											{(playerCard.displayName ?? "").slice(0, -5)}
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
