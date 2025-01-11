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
	playerCards: z.record(z.string(), zfd.checkbox()).optional(),
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
		playerCardIds: Object.entries(out.playerCards || {}).reduce<Array<string>>(
			(acc, next) => {
				if (next[1]) {
					acc.push(next[0]);
				}
				return acc;
			},
			[],
		),
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

	const selectedPlayerCards = loadout.playerCardIds;
	const ownedPlayerCards = valorantData.playerCards
		.filter((playerCard) =>
			entitlements.player_card.some(
				(entitlement) => entitlement.ItemID === playerCard.uuid,
			),
		)
		.sort((a, b) => a.displayName.localeCompare(b.displayName));

	return {
		selectedPlayerCards,
		ownedPlayerCards,
	};
}

export default function AddPlayerCard() {
	const { ownedPlayerCards, selectedPlayerCards } =
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
								Select Player Cards
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
								{ownedPlayerCards.map((playerCard) => (
									<div key={playerCard.uuid}>
										<input
											id={playerCard.uuid}
											name={`playerCards[${playerCard.uuid}]`}
											type="checkbox"
											className="hidden peer"
											defaultChecked={selectedPlayerCards.includes(
												playerCard.uuid,
											)}
										/>
										<label
											htmlFor={playerCard.uuid}
											className="block p-2 peer-checked:bg-slate-500 hover:bg-slate-500 rounded-md"
										>
											<img
												className="w-full h-full object-contain"
												style={{
													aspectRatio: '280 / 640',
												}}
												src={playerCard.largeArt}
												alt={playerCard.displayName}
											/>
											<h2 className="text-center text-sm mt-2">
												{playerCard.displayName.slice(0, -5)}
											</h2>
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
