import {
	Dialog,
	DialogTrigger,
	Heading,
	Modal,
	ModalOverlay,
} from "react-aria-components";
import { Link, Outlet, useNavigate, useRevalidator } from "react-router";
import type { Loadout } from "~/apiClient";
import * as api from "~/apiClient";
import { SwitchImage } from "~/components/SwitchImage";
import type { Skin, SkinChroma } from "~/types";
import { getValorantData } from "~/valorant-data";
import type { Route } from "./+types/weapon";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const { loadoutId, weaponId } = params;
	if (!loadoutId || !weaponId) throw new Error("Missing params");

	const [valorantData, userConfig] = await Promise.all([
		getValorantData(),
		api.getUserConfig(),
	]);

	const loadout = userConfig.loadouts.find((l) => l.id === loadoutId);
	if (!loadout) {
		throw new Error("Loadout not found");
	}

	const weapon = valorantData.weapons.find((w) => w.uuid === weaponId);
	if (!weapon) {
		throw new Error("Weapon not found");
	}

	const templates = loadout.weapons[weaponId]?.templates || [];

	return {
		weaponId,
		weapon,
		loadout,
		templates: templates.map(
			(template: { id: string; skinId: string; chromaIds: string[] }) => {
				const skin = weapon.skins.find((s: Skin) => s.uuid === template.skinId);
				const chromas =
					skin?.chromas.filter((c: SkinChroma) =>
						template.chromaIds.includes(c.uuid),
					) || [];

				return { id: template.id, skin, chromas };
			},
		),
	};
}

export default function WeaponTemplatesModal({
	loaderData,
	params,
}: Route.ComponentProps) {
	const { weaponId, weapon, templates, loadout } = loaderData;
	const loadoutId = params.loadoutId;
	const navigate = useNavigate();
	const revalidator = useRevalidator();

	const handleDeleteTemplate = async (templateId: string) => {
		const existingWeapon = loadout.weapons[weaponId];
		if (!existingWeapon) return;

		const newTemplates = existingWeapon.templates.filter(
			(t: { id: string }) => t.id !== templateId,
		);

		const newLoadout: Loadout = {
			...loadout,
			weapons: {
				...loadout.weapons,
				[weaponId]: {
					...existingWeapon,
					templates: newTemplates,
				},
			},
		};

		await api.updateLoadout(newLoadout);
		revalidator.revalidate();
	};

	return (
		<>
			<DialogTrigger
				isOpen
				onOpenChange={(open) => {
					if (!open) navigate(`/loadouts/${loadoutId}`);
				}}
			>
				<ModalOverlay className="bg-black/60 fixed inset-0 grid place-items-center z-50">
					<Modal className="w-full max-w-3xl h-3/5 bg-slate-700 rounded-md flex flex-col overflow-hidden">
						<Dialog className="flex flex-col h-full outline-none">
							<div className="flex flex-row items-center justify-between flex-none p-4 bg-slate-600">
								<Heading slot="title" className="text-2xl text-white">
									{weapon.displayName ?? ""}
								</Heading>
								<button
									type="button"
									className="text-white cursor-pointer"
									onClick={() => navigate(`/loadouts/${loadoutId}`)}
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
							<div className="grid grid-cols-3 gap-2 overflow-y-auto px-4 mr-4 mb-4 mt-4">
								{templates.map(
									(template: {
										id: string;
										skin: Skin | undefined;
										chromas: SkinChroma[];
									}) => (
										<div
											key={template.id}
											className="relative group rounded-md overflow-hidden"
										>
											<div className="aspect-video flex flex-col items-center justify-center gap-4 p-2 group-hover:bg-slate-500">
												<div className="w-full flex-1 relative">
													<SwitchImage
														className="absolute top-0 right-0 bottom-0 left-0 w-full h-full object-contain"
														images={template.chromas.map(
															(chroma: SkinChroma) => ({
																src:
																	(chroma.fullRender ?? "") ||
																	(chroma.displayIcon ?? ""),
																alt: chroma.displayName ?? "",
															}),
														)}
													/>
												</div>
												<h2 className="w-full text-lg leading-4 text-center text-white whitespace-nowrap overflow-hidden text-ellipsis">
													{(template.skin?.displayName ?? "")
														.split(" ")
														.slice(0, -1)
														.join(" ")}
												</h2>
											</div>
											<div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/40 flex flex-row justify-center items-center gap-2">
												<button
													type="button"
													className="rounded-full hover:bg-black/40 p-2 text-white"
													onClick={() => handleDeleteTemplate(template.id)}
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														fill="none"
														viewBox="0 0 24 24"
														strokeWidth={1.5}
														stroke="currentColor"
														className="w-6 h-6"
														aria-label="Delete template"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
														/>
													</svg>
												</button>
											</div>
										</div>
									),
								)}
								<Link
									to={`/loadouts/${loadoutId}/weapons/${weaponId}/new`}
									className="grid place-items-center aspect-video bg-slate-400 hover:bg-slate-300 rounded-md text-3xl text-white transition-colors"
								>
									+
								</Link>
							</div>
						</Dialog>
					</Modal>
				</ModalOverlay>
			</DialogTrigger>
			<Outlet />
		</>
	);
}
