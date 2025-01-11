import type { MetaFunction } from 'react-router';
import { redirect } from 'react-router';

import { getUser } from '~/utils.server';

export async function loader() {
	const user = await getUser();

	if (user) {
		throw redirect('/');
	}

	return null;
}

export const meta: MetaFunction = () => [
	{
		httpEquiv: 'refresh',
		content: '5',
	},
];

export default function Index() {
	return (
		<div className="grid place-items-center h-[100vh]">
			Please open Valorant to continue
		</div>
	);
}
