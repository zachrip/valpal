import { redirect, MetaFunction } from '@remix-run/node';

import { getUser } from '~/utils.server';

export async function loader() {
	const user = await getUser();

	if (user) {
		return redirect('/');
	}

	return null;
}

export const meta: MetaFunction = () => ({
	refresh: {
		httpEquiv: 'refresh',
		content: '5',
	},
});

export default function Index() {
	return (
		<div className="grid place-items-center h-[100vh]">
			Please open Valorant to continue
		</div>
	);
}
