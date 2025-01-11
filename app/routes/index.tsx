import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';
import { getUser } from '~/utils.server';

export async function loader() {
	const user = await getUser();

	if (!user) {
		throw redirect('/login');
	}

	throw redirect('/loadouts');
}

export default function Index() {
	const { userId } = useLoaderData<typeof loader>();

	return <div>{userId}</div>;
}
