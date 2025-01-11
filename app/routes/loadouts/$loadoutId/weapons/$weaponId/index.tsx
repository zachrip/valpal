import {
	Form,
	Link,
	useLoaderData,
	useNavigate,
	useParams,
} from 'react-router';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { getUser, getUserConfig, saveUserConfig } from '~/utils.server';
import { SwitchImage } from '~/components/SwitchImage';
import type { Loadout } from '~/utils';

export async function action({ request, params }: ActionFunctionArgs) {
	const user = await getUser();

	if (!user) {
		throw redirect('/login');
	}

	const { loadoutId, weaponId } = params;
	const formData = await request.formData();
	const action = formData.get('action');

	const userConfig = await getUserConfig(user.userId);
	const loadout = userConfig.loadouts.find(
		(loadout) => loadout.id === loadoutId,
	);

	if (!loadout) {
		throw redirect('/loadouts');
	}

	switch (action) {
		case 'deleteTemplate': {
			const templateId = formData.get('templateId');
			const existingWeapon = loadout.weapons[weaponId!];

			if (!existingWeapon) {
				throw new Error('Weapon not found in loadout');
			}

			const newTemplates = existingWeapon.templates.filter(
				(template) => template.id !== templateId,
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

			return {
				success: true,
			};
		}
		default: {
			return new Response(null, {
				headers: {
					'Content-Type': 'application/json',
				},
				status: 400,
			});
		}
	}
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
	const templates = loadout.weapons[weaponId!].templates;

	return {
		weapon,
		templates: templates.map((template) => {
			const skin = weapon.skins.find((skin) => skin.uuid === template.skinId)!;
			const chromas = skin.chromas.filter((chroma) =>
				template.chromaIds.includes(chroma.uuid),
			);

			return {
				id: template.id,
				skin,
				chromas,
			};
		}),
	};
}

export default function EditWeapon() {
	const params = useParams();
	const { weapon, templates } = useLoaderData<typeof loader>();
	const navigate = useNavigate();

	return (
		<DialogPrimitive.Root
			open
			onOpenChange={() => navigate(`/loadouts/${params.loadoutId}`)}
		>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className="bg-black/60 fixed inset-0 grid place-items-center">
					<DialogPrimitive.Content className="w-full max-w-3xl h-3/5 bg-slate-700 rounded-md flex flex-col overflow-hidden">
						<div className="flex flex-row items-center justify-between flex-none p-4 bg-slate-600">
							<DialogPrimitive.Title className="text-2xl">
								{weapon.displayName}
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
						<div className="grid grid-cols-3 gap-2 overflow-y-auto scrollbar-thin scrollbar-thumb-white scrollbar-track-transparent scrollbar-thumb-rounded-full px-4 mr-4 mb-4 mt-4">
							{templates.map((template) => {
								return (
									<div
										key={template.id}
										className="relative group rounded-md overflow-hidden"
									>
										<div className="aspect-video flex flex-col items-center justify-center gap-4 p-2 group-hover:bg-slate-500">
											<div className="w-full flex-1 relative">
												<SwitchImage
													className="absolute top-0 right-0 bottom-0 left-0 w-full h-full object-contain"
													images={template.chromas.map((chroma) => ({
														src: chroma.fullRender,
														alt: chroma.displayName,
													}))}
												/>
											</div>
											<h2 className="w-full text-lg leading-4 text-center whitespace-nowrap overflow-hidden text-ellipsis">
												{template.skin.displayName
													.split(' ')
													.slice(0, -1)
													.join(' ')}
											</h2>
										</div>
										<div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/40 flex flex-row justify-center items-center gap-2">
											<Form method="POST">
												<input
													type="hidden"
													name="action"
													value="deleteTemplate"
												/>
												<input
													type="hidden"
													name="templateId"
													value={template.id}
												/>
												<button
													className="rounded-full hover:bg-black/40 p-2"
													type="submit"
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														fill="none"
														viewBox="0 0 24 24"
														strokeWidth={1.5}
														stroke="currentColor"
														className="w-6 h-6"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
														/>
													</svg>
												</button>
											</Form>
											<Link
												to={`templates/${template.id}/edit`}
												className="rounded-full hover:bg-black/40 p-2"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
													strokeWidth={1.5}
													stroke="currentColor"
													className="w-6 h-6"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
													/>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
													/>
												</svg>
											</Link>
										</div>
									</div>
								);
							})}
							<Link
								to="templates/new"
								className="grid place-items-center aspect-video bg-slate-400 rounded-md text-3xl"
							>
								+
							</Link>
						</div>
					</DialogPrimitive.Content>
				</DialogPrimitive.Overlay>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}
