import { useState } from "react";
import {
	Dialog,
	DialogTrigger,
	Heading,
	Modal,
	ModalOverlay,
} from "react-aria-components";
import { useNavigate, useRevalidator } from "react-router";
import type { ExpressionSlot, Loadout } from "~/apiClient";
import * as api from "~/apiClient";
import {
	type Entitlement,
	entitlementTypeToIdMap,
	type Flex,
	type Spray,
} from "~/types";
import { getValorantData } from "~/valorant-data";
import type { Route } from "./+types/expressions";

type SlotName = "top" | "right" | "bottom" | "left";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const slot = params.slot as SlotName;
	if (!["top", "right", "bottom", "left"].includes(slot)) {
		throw new Error("Invalid slot");
	}

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

	const sprayType = entitlementsData.EntitlementsByTypes.find(
		(e: { ItemTypeID: string }) =>
			e.ItemTypeID === entitlementTypeToIdMap.spray,
	);
	const flexType = entitlementsData.EntitlementsByTypes.find(
		(e: { ItemTypeID: string }) => e.ItemTypeID === entitlementTypeToIdMap.flex,
	);

	const sprayEntitlements: Entitlement[] = sprayType?.Entitlements || [];
	const flexEntitlements: Entitlement[] = flexType?.Entitlements || [];

	const ownedSprays = valorantData.sprays
		.filter((spray: Spray) =>
			sprayEntitlements.some((e: Entitlement) => e.ItemID === spray.uuid),
		)
		.sort((a: Spray, b: Spray) =>
			(a.displayName ?? "").localeCompare(b.displayName ?? ""),
		);

	const ownedFlex = valorantData.flex
		.filter((flex: Flex) =>
			flexEntitlements.some((e: Entitlement) => e.ItemID === flex.uuid),
		)
		.sort((a: Flex, b: Flex) =>
			(a.displayName ?? "").localeCompare(b.displayName ?? ""),
		);

	return {
		slot,
		loadout,
		selectedSprays: loadout.expressionIds[slot].sprayIds,
		selectedFlex: loadout.expressionIds[slot].flexIds,
		ownedSprays,
		ownedFlex,
	};
}

export default function ExpressionPickerModal({
	loaderData,
	params,
}: Route.ComponentProps) {
	const {
		slot,
		loadout,
		selectedSprays: initialSprays,
		selectedFlex: initialFlex,
		ownedSprays,
		ownedFlex,
	} = loaderData;
	const navigate = useNavigate();
	const revalidator = useRevalidator();
	const [selectedSprays, setSelectedSprays] = useState<string[]>(initialSprays);
	const [selectedFlex, setSelectedFlex] = useState<string[]>(initialFlex);
	const [currentTab, setCurrentTab] = useState<"sprays" | "flex">("sprays");

	const toggleSpray = async (sprayId: string) => {
		const newSelected = selectedSprays.includes(sprayId)
			? selectedSprays.filter((id) => id !== sprayId)
			: [...selectedSprays, sprayId];

		setSelectedSprays(newSelected);

		const newExpressionSlot: ExpressionSlot = {
			sprayIds: newSelected,
			flexIds: selectedFlex,
		};

		const newLoadout: Loadout = {
			...loadout,
			expressionIds: {
				...loadout.expressionIds,
				[slot]: newExpressionSlot,
			},
		};

		await api.updateLoadout(newLoadout);
		revalidator.revalidate();
	};

	const toggleFlex = async (flexId: string) => {
		const newSelected = selectedFlex.includes(flexId)
			? selectedFlex.filter((id) => id !== flexId)
			: [...selectedFlex, flexId];

		setSelectedFlex(newSelected);

		const newExpressionSlot: ExpressionSlot = {
			sprayIds: selectedSprays,
			flexIds: newSelected,
		};

		const newLoadout: Loadout = {
			...loadout,
			expressionIds: {
				...loadout.expressionIds,
				[slot]: newExpressionSlot,
			},
		};

		await api.updateLoadout(newLoadout);
		revalidator.revalidate();
	};

	const slotTitle = slot.charAt(0).toUpperCase() + slot.slice(1);

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
								Select {slotTitle} Slot Expressions
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
						<div className="flex-none px-8 mt-4 flex flex-row gap-4 text-lg">
							<button
								type="button"
								onClick={() => setCurrentTab("sprays")}
								className={`text-white ${currentTab === "sprays" ? "font-bold underline underline-offset-8 decoration-teal-400 decoration-2" : ""}`}
							>
								Sprays
							</button>
							<button
								type="button"
								onClick={() => setCurrentTab("flex")}
								className={`text-white ${currentTab === "flex" ? "font-bold underline underline-offset-8 decoration-teal-400 decoration-2" : ""}`}
							>
								Flex
							</button>
						</div>
						<div className="flex-auto overflow-y-auto px-4 mr-4 mb-4 mt-4">
							{currentTab === "sprays" && (
								<div className="grid grid-cols-4 gap-2">
									{ownedSprays.map((spray: Spray) => (
										<button
											key={spray.uuid}
											type="button"
											onClick={() => toggleSpray(spray.uuid)}
											className={`block w-full h-full p-2 rounded-md transition-colors ${
												selectedSprays.includes(spray.uuid)
													? "bg-slate-500"
													: "hover:bg-slate-500"
											}`}
										>
											<div className="w-full aspect-square">
												<img
													className="w-full h-full object-contain"
													src={
														spray.animationGif ??
														spray.fullTransparentIcon ??
														spray.displayIcon ??
														""
													}
													alt={spray.displayName ?? ""}
												/>
											</div>
											<h2 className="text-sm text-white font-bold text-center whitespace-nowrap overflow-hidden text-ellipsis mt-2">
												{(spray.displayName ?? "").slice(0, -6)}
											</h2>
										</button>
									))}
								</div>
							)}
							{currentTab === "flex" && (
								<div className="grid grid-cols-4 gap-2">
									{ownedFlex.map((flex: Flex) => (
										<button
											key={flex.uuid}
											type="button"
											onClick={() => toggleFlex(flex.uuid)}
											className={`block w-full h-full p-2 rounded-md transition-colors ${
												selectedFlex.includes(flex.uuid)
													? "bg-slate-500"
													: "hover:bg-slate-500"
											}`}
										>
											<div className="w-full aspect-square">
												<img
													className="w-full h-full object-contain"
													src={flex.displayIcon ?? ""}
													alt={flex.displayName ?? ""}
												/>
											</div>
											<h2 className="text-sm text-white font-bold text-center whitespace-nowrap overflow-hidden text-ellipsis mt-2">
												{flex.displayName}
											</h2>
										</button>
									))}
								</div>
							)}
						</div>
					</Dialog>
				</Modal>
			</ModalOverlay>
		</DialogTrigger>
	);
}
