import { redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { getUser } from '~/utils.server';

export async function loader() {
	const user = await getUser();

	if (!user) {
		return redirect('/login');
	}

	return redirect('/loadouts');
}

export default function Index() {
	const { userId } = useLoaderData<typeof loader>();

	return <div>{userId}</div>;
}
