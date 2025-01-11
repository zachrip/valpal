import {
	Form,
	useLoaderData,
	useNavigate,
	useParams,
	useSubmit,
} from 'react-router';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { Loadout } from '~/utils';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { getUser, getUserConfig, saveUserConfig } from '~/utils.server';
import { zfd } from 'zod-form-data';
import { z } from 'zod';

const schema = zfd.formData({
	playerTitles: z.record(z.string(), zfd.checkbox()).optional(),
});

export async function action({ request, params }: ActionFunctionArgs) {
	const user = await getUser();
	if (!user) {
		throw redirect('/login');
	}

	const { loadoutId } = params;

	const userConfig = await getUserConfig(user.userId);
	const loadout = userConfig.loadouts.find(
		(loadout) => loadout.id === loadoutId,
	);

	if (!loadout) {
		throw redirect('/loadouts');
	}

	const formData = await request.formData();

	const out = schema.parse(formData);

	const newLoadout: Loadout = {
		...loadout,
		playerTitleIds: Object.entries(out.playerTitles || {}).reduce<
			Array<string>
		>((acc, next) => {
			if (next[1]) {
				acc.push(next[0]);
			}
			return acc;
		}, []),
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

export async function loader({ params }: LoaderFunctionArgs) {
	const user = await getUser();

	if (!user) {
		throw redirect('/login');
	}

	const { loadoutId } = params;

	const userConfig = await getUserConfig(user.userId);
	const loadout = userConfig.loadouts.find(
		(loadout) => loadout.id === loadoutId,
	);

	if (!loadout) {
		throw redirect('/loadouts');
	}

	const entitlements = await user.getEntitlements();

	const selectedPlayerTitles = loadout.playerTitleIds;
	const ownedPlayerTitles = valorantData.playerTitles
		.filter((playerTitle) =>
			entitlements.player_title.some(
				(entitlement) => entitlement.ItemID === playerTitle.uuid,
			),
		)
		.sort((a, b) =>
			(a.titleText || 'default').localeCompare(b.titleText || 'Default'),
		);

	return {
		selectedPlayerTitles,
		ownedPlayerTitles,
	};
}

export default function AddPlayerTitle() {
	const { ownedPlayerTitles, selectedPlayerTitles } =
		useLoaderData<typeof loader>();
	const navigate = useNavigate();
	const params = useParams();
	const submit = useSubmit();

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
								Select Player Titles
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
						<Form
							method="POST"
							onChange={(e) => {
								submit(e.currentTarget, {
									replace: true,
								});
							}}
							className="flex-auto overflow-y-auto scrollbar-thin scrollbar-thumb-white scrollbar-track-transparent scrollbar-thumb-rounded-full px-4 mr-4 mb-4 mt-4"
						>
							<div className="grid grid-cols-4 gap-2 mt-2">
								{ownedPlayerTitles.map((playerTitle) => (
									<div key={playerTitle.uuid} className="aspect-video">
										<input
											id={playerTitle.uuid}
											name={`playerTitles[${playerTitle.uuid}]`}
											type="checkbox"
											className="hidden peer"
											defaultChecked={selectedPlayerTitles.includes(
												playerTitle.uuid,
											)}
										/>
										<label
											htmlFor={playerTitle.uuid}
											className="w-full h-full p-2 peer-checked:bg-slate-500 hover:bg-slate-500 rounded-md grid place-items-center"
										>
											{playerTitle.titleText || 'default'}
										</label>
									</div>
								))}
							</div>
						</Form>
					</DialogPrimitive.Content>
				</DialogPrimitive.Overlay>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}
