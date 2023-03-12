import {
	Form,
	useLoaderData,
	useNavigate,
	useParams,
	useSubmit,
} from '@remix-run/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { Loadout } from '~/utils';
import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { getUser, getUserConfig, saveUserConfig } from '~/utils.server';
import { zfd } from 'zod-form-data';
import { z } from 'zod';

const schema = zfd.formData({
	playerTitles: z.record(z.string(), zfd.checkbox()).optional(),
});

export async function action({ request, params }: ActionArgs) {
	const user = await getUser();
	if (!user) {
		return redirect('/login');
	}

	const { loadoutId } = params;

	const userConfig = await getUserConfig(user.userId);
	const loadout = userConfig.loadouts.find(
		(loadout) => loadout.id === loadoutId
	);

	if (!loadout) {
		return redirect('/loadouts');
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
		currentLoadout: userConfig.currentLoadout,
		loadouts: [
			...userConfig.loadouts.filter((l) => l.id !== loadoutId),
			newLoadout,
		],
	});

	return json({
		success: true,
	});
}

export async function loader({ params }: LoaderArgs) {
	const user = await getUser();

	if (!user) {
		return redirect('/login');
	}

	const { loadoutId } = params;

	const userConfig = await getUserConfig(user.userId);
	const loadout = userConfig.loadouts.find(
		(loadout) => loadout.id === loadoutId
	);

	if (!loadout) {
		return redirect('/loadouts');
	}

	const entitlements = await user.getEntitlements();

	const selectedPlayerTitles = loadout.playerTitleIds;
	const ownedPlayerTitles = valorantData.playerTitles
		.filter(
			(playerTitle) =>
				entitlements.player_title.some(
					(entitlement) => entitlement.ItemID === playerTitle.uuid
				) || !playerTitle.isHiddenIfNotOwned
		)
		.sort((a, b) =>
			(a.titleText || 'default').localeCompare(b.titleText || 'Default')
		);

	return json({
		selectedPlayerTitles,
		ownedPlayerTitles,
	});
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
				<DialogPrimitive.Overlay className="bg-black/60 fixed top-0 left-0 right-0 bottom-0 grid place-items-center">
					<DialogPrimitive.Content className="w-full max-w-3xl h-3/5 overflow-auto p-4 bg-slate-700 rounded-md">
						<DialogPrimitive.Title className="text-2xl">
							Select Player Titles
						</DialogPrimitive.Title>
						<Form
							method="post"
							onChange={(e) => {
								submit(e.currentTarget, {
									replace: true,
								});
							}}
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
												playerTitle.uuid
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
