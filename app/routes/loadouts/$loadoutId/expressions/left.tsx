import {
	Form,
	useLoaderData,
	useNavigate,
	useParams,
	useSubmit,
} from 'react-router';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { Loadout } from '~/utils';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { getUser, getUserConfig, saveUserConfig } from '~/utils.server';
import { zfd } from 'zod-form-data';
import { z } from 'zod';

const schema = zfd.formData({
	tab: z.enum(['sprays', 'flex']),
	sprays: z.record(z.string(), zfd.checkbox()).optional(),
	flex: z.record(z.string(), zfd.checkbox()).optional(),
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
		expressionIds: {
			...loadout.expressionIds,
			left: {
				...loadout.expressionIds.left,
				...(out.tab === 'sprays'
					? {
							sprayIds: Object.entries(out.sprays || {}).reduce<Array<string>>(
								(acc, next) => {
									if (next[1]) {
										acc.push(next[0]);
									}
									return acc;
								},
								[],
							),
							flexIds: loadout.expressionIds.left.flexIds,
						}
					: {
							flexIds: Object.entries(out.flex || {}).reduce<Array<string>>(
								(acc, next) => {
									if (next[1]) {
										acc.push(next[0]);
									}
									return acc;
								},
								[],
							),
							sprayIds: loadout.expressionIds.left.sprayIds,
						}),
			},
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

	const selectedSprays = loadout.expressionIds.left.sprayIds;
	const ownedSprays = valorantData.sprays
		.filter((spray) =>
			entitlements.spray.some(
				(entitlement) => entitlement.ItemID === spray.uuid,
			),
		)
		.sort((a, b) => a.displayName.localeCompare(b.displayName));

	const selectedFlex = loadout.expressionIds.left.flexIds;
	const ownedFlex = valorantData.flex
		.filter((flex) =>
			entitlements.flex.some((entitlement) => entitlement.ItemID === flex.uuid),
		)
		.sort((a, b) => a.displayName.localeCompare(b.displayName));

	return {
		selectedSprays,
		ownedSprays,
		selectedFlex,
		ownedFlex,
	};
}

export default function AddLeftSpray() {
	const { ownedSprays, selectedSprays, ownedFlex, selectedFlex } =
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
								Select Left Slot Expressions
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
						<TabsPrimitive.Root
							className="flex-auto flex flex-col overflow-hidden"
							defaultValue="sprays"
						>
							<TabsPrimitive.List className="flex-none px-8 mt-4 flex flex-row gap-4 text-lg">
								<TabsPrimitive.Trigger
									value="sprays"
									className="aria-selected:font-bold aria-selected:underline underline-offset-8 decoration-teal-400 decoration-2"
								>
									Sprays
								</TabsPrimitive.Trigger>
								<TabsPrimitive.Trigger
									value="flex"
									className="aria-selected:font-bold aria-selected:underline underline-offset-8 decoration-teal-400 decoration-2"
								>
									Flex
								</TabsPrimitive.Trigger>
							</TabsPrimitive.List>
							<Form
								method="POST"
								onChange={(e) => {
									submit(e.currentTarget, {
										replace: true,
									});
								}}
								className="flex-auto overflow-y-auto scrollbar-thin scrollbar-thumb-white scrollbar-track-transparent scrollbar-thumb-rounded-full px-4 mr-4 mb-4 mt-4"
							>
								<TabsPrimitive.Content value="sprays">
									<input type="hidden" name="tab" value="sprays" />
									<div className="grid grid-cols-4 gap-2">
										{ownedSprays.map((spray) => (
											<div key={spray.uuid}>
												<input
													id={spray.uuid}
													name={`sprays[${spray.uuid}]`}
													type="checkbox"
													className="hidden peer"
													defaultChecked={selectedSprays.includes(spray.uuid)}
												/>
												<label
													htmlFor={spray.uuid}
													className="block w-full h-full p-2 peer-checked:bg-slate-500 hover:bg-slate-500 rounded-md"
												>
													<div className="w-full aspect-square">
														<img
															className="w-full h-full object-contain"
															src={
																spray.animationGif ||
																spray.fullTransparentIcon ||
																spray.displayIcon
															}
															alt={spray.displayName}
														/>
													</div>
													<h2 className="text-sm text-white font-bold text-center whitespace-nowrap overflow-hidden text-ellipsis mt-2">
														{spray.displayName.slice(0, -6)}
													</h2>
												</label>
											</div>
										))}
									</div>
								</TabsPrimitive.Content>
								<TabsPrimitive.Content value="flex">
									<input type="hidden" name="tab" value="flex" />
									<div className="grid grid-cols-4 gap-2">
										{ownedFlex.map((flex) => (
											<div key={flex.uuid}>
												<input
													id={flex.uuid}
													name={`flex[${flex.uuid}]`}
													type="checkbox"
													className="hidden peer"
													defaultChecked={selectedFlex.includes(flex.uuid)}
												/>
												<label
													htmlFor={flex.uuid}
													className="block w-full h-full p-2 peer-checked:bg-slate-500 hover:bg-slate-500 rounded-md"
												>
													<div className="w-full aspect-square">
														<img
															className="w-full h-full object-contain"
															src={flex.displayIcon}
															alt={flex.displayName}
														/>
													</div>
													<h2 className="text-sm text-white font-bold text-center whitespace-nowrap overflow-hidden text-ellipsis mt-2">
														{flex.displayName}
													</h2>
												</label>
											</div>
										))}
									</div>
								</TabsPrimitive.Content>
							</Form>
						</TabsPrimitive.Root>
					</DialogPrimitive.Content>
				</DialogPrimitive.Overlay>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}
