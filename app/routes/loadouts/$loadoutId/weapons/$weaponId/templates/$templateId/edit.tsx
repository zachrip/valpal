import { Form, useLoaderData, useNavigate, useParams } from 'react-router';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { Loadout } from '~/utils';
import { getOwnedChromas, getOwnedLevels } from '~/utils';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { getUser, getUserConfig, saveUserConfig } from '~/utils.server';
import { zfd } from 'zod-form-data';
import { z } from 'zod';

const schema = zfd.formData({
	skinId: z.string(),
	chromas: z.record(z.string(), zfd.checkbox()).optional(),
	levels: z.record(z.string(), zfd.checkbox()).optional(),
	buddies: z
		.record(z.string(), z.record(z.string(), zfd.checkbox()))
		.optional(),
});

export async function action({ request, params }: ActionFunctionArgs) {
	const user = await getUser();
	if (!user) {
		throw redirect('/login');
	}

	const { loadoutId, weaponId } = params;

	const userConfig = await getUserConfig(user.userId);
	const loadout = userConfig.loadouts.find(
		(loadout) => loadout.id === loadoutId,
	);

	if (!loadout) {
		throw redirect('/loadouts');
	}

	const formData = await request.formData();

	const out = schema.parse(formData);

	const existingWeapon = loadout.weapons[weaponId!];

	if (!existingWeapon) {
		throw new Error('Weapon not found in loadout');
	}

	const existingTemplate = existingWeapon.templates.find(
		(template) => template.id === params.templateId,
	);

	if (!existingTemplate) {
		throw new Error('Template not found in weapon');
	}

	const skin = valorantData.weapons
		.find((weapon) => weapon.uuid === weaponId)
		?.skins.find((skin) => skin.uuid === existingTemplate.skinId)!;
	const defaultChroma = skin.chromas[skin.chromas.length - 1].uuid;
	const defaultLevel = skin.levels[skin.levels.length - 1].uuid;

	const newTemplate = {
		...existingTemplate,
		chromaIds: out.chromas
			? Object.keys(out.chromas).filter((key) => out.chromas![key])
			: [defaultChroma],
		levelIds: out.levels
			? Object.keys(out.levels).filter((key) => out.levels![key])
			: [defaultLevel],
		buddies: Object.keys(out.buddies || {}).map((buddyId) => ({
			id: buddyId,
			levelIds: Object.keys(out.buddies![buddyId]).filter(
				(key) => out.buddies![buddyId][key],
			),
		})),
	};

	const newTemplates = [...loadout.weapons[weaponId!].templates!];
	newTemplates.splice(
		newTemplates.findIndex((t) => t.id === params.templateId),
		1,
		newTemplate,
	);

	const newWeapon: Loadout['weapons'][number] = {
		...existingWeapon,
		templates: newTemplates,
	};

	const newLoadout: Loadout = {
		...loadout,
		weapons: {
			...loadout.weapons,
			[weaponId!]: newWeapon,
		},
	};

	await saveUserConfig(user.userId, {
		loadouts: [
			...userConfig.loadouts.filter((l) => l.id !== loadoutId),
			newLoadout,
		],
	});

	throw redirect(`/loadouts/${loadoutId}/weapons/${weaponId}`);
}

export async function loader({ params }: LoaderFunctionArgs) {
	const user = await getUser();

	if (!user) {
		throw redirect('/login');
	}

	const { loadoutId, weaponId } = params;

	const userConfig = await getUserConfig(user.userId);
	const loadout = userConfig.loadouts.find(
		(loadout) => loadout.id === loadoutId,
	);

	if (!loadout) {
		throw redirect('/loadouts');
	}

	const weapons = valorantData.weapons;

	const weapon = weapons.find((weapon) => weapon.uuid === weaponId)!;
	const entitlements = await user.getEntitlements();
	const templates = loadout.weapons[weaponId!].templates;

	const template = templates.find(
		(template) => template.id === params.templateId,
	)!;

	const skin = weapon.skins.find((skin) => skin.uuid === template.skinId)!;

	const ownedBuddies = valorantData.buddies
		.flatMap((buddy) =>
			buddy.levels
				.map((level) => ({
					buddyId: buddy.uuid,
					levelId: level.uuid,
					displayName: buddy.displayName,
					displayIcon: level.displayIcon,
				}))
				.filter((buddy) =>
					entitlements.buddy.some(
						(entitlement) => entitlement.ItemID === buddy.levelId,
					),
				),
		)
		.sort((a, b) => a.displayName.localeCompare(b.displayName));

	return {
		weapon,
		skin: {
			...skin,
			ownedChromas: getOwnedChromas(skin, entitlements),
			ownedLevels: getOwnedLevels(skin, entitlements),
		},
		ownedBuddies,
		template,
	};
}

export default function EditSkin() {
	const { skin, template, ownedBuddies, weapon } =
		useLoaderData<typeof loader>();
	const navigate = useNavigate();
	const params = useParams();

	return (
		<DialogPrimitive.Root
			open
			onOpenChange={() =>
				navigate(`/loadouts/${params.loadoutId}/weapons/${params.weaponId}`)
			}
		>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className="bg-black/60 fixed inset-0 grid place-items-center">
					<DialogPrimitive.Content className="w-full max-w-3xl h-3/5 bg-slate-700 rounded-md flex flex-col overflow-hidden">
						<div className="flex flex-row items-center justify-between flex-none p-4 bg-slate-600">
							<DialogPrimitive.Title className="text-2xl">
								{skin.displayName}
							</DialogPrimitive.Title>
							<DialogPrimitive.Close>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									className="w-6 h-6"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</DialogPrimitive.Close>
						</div>
						<Form method="PUT" className="contents">
							<div className="flex-auto overflow-y-auto scrollbar-thin scrollbar-thumb-white scrollbar-track-transparent scrollbar-thumb-rounded-full px-4 mr-4 mb-4 mt-4">
								<input type="hidden" name="skinId" value={skin.uuid} readOnly />
								<div className="flex justify-center my-6">
									<img
										className="max-h-64"
										src={skin.displayIcon}
										alt={skin.displayName}
									/>
								</div>
								<h1 className="text-xl">Chromas</h1>
								<div className="grid grid-cols-4 gap-2 mt-2">
									{skin.ownedChromas.map((chroma) => (
										<div key={chroma.uuid} className="aspect-video">
											<input
												id={chroma.uuid}
												name={`chromas[${chroma.uuid}]`}
												type="checkbox"
												className="hidden peer"
												defaultChecked={template.chromaIds.includes(
													chroma.uuid,
												)}
											/>
											<label
												htmlFor={chroma.uuid}
												className="block w-full h-full p-2 peer-checked:bg-slate-500 hover:bg-slate-500 rounded-md"
											>
												<img
													className="w-full h-full object-contain"
													src={chroma.fullRender}
													alt={chroma.displayName}
												/>
											</label>
										</div>
									))}
								</div>
								<h1 className="text-xl mt-4">Levels</h1>
								<div className="grid grid-cols-4 gap-2 mt-2">
									{skin.ownedLevels.map((level, index) => (
										<div key={level.uuid} className="aspect-video">
											<input
												id={level.uuid}
												name={`levels[${level.uuid}]`}
												type="checkbox"
												className="hidden peer"
												defaultChecked={template.levelIds.includes(level.uuid)}
											/>
											<label
												htmlFor={level.uuid}
												className="flex w-full h-full justify-center items-center p-2 peer-checked:bg-slate-500 hover:bg-slate-500 rounded-md"
											>
												{index + 1}
											</label>
										</div>
									))}
								</div>
								{weapon.uuid !== '2f59173c-4bed-b6c3-2191-dea9b58be9c7' && (
									<>
										<h1 className="text-xl mt-4">Buddies</h1>
										<div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-white scrollbar-track-transparent scrollbar-thumb-rounded-full px-4 mr-4 mb-4 mt-4">
											{ownedBuddies.map((buddy) => (
												<div key={buddy.buddyId + buddy.levelId}>
													<input
														id={buddy.buddyId + buddy.levelId}
														name={`buddies[${buddy.buddyId}][${buddy.levelId}]`}
														type="checkbox"
														className="hidden peer"
														defaultChecked={template.buddies.some(
															(b) =>
																b.id === buddy.buddyId &&
																b.levelIds.includes(buddy.levelId),
														)}
													/>
													<label
														htmlFor={buddy.buddyId + buddy.levelId}
														className="block w-full h-full p-2 peer-checked:bg-slate-500 hover:bg-slate-500 rounded-md"
													>
														<div className="w-full aspect-square">
															<img
																className="w-full h-full object-contain"
																src={buddy.displayIcon}
																alt={buddy.displayName}
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
							<div className="p-4">
								<button
									type="submit"
									className="w-full p-2 bg-slate-500 rounded-md"
								>
									Save
								</button>
								<DialogPrimitive.Close className="w-full mt-4 p-2 bg-slate-500 rounded-md">
									Cancel
								</DialogPrimitive.Close>
							</div>
						</Form>
					</DialogPrimitive.Content>
				</DialogPrimitive.Overlay>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}
