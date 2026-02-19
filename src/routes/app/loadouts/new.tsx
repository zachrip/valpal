import { redirect } from "react-router";
import type { Loadout } from "~/apiClient";
import * as api from "~/apiClient";

const weaponIds = [
	"63e6c2b6-4a8e-869c-3d4c-e38355226584",
	"55d8a0f4-4274-ca67-fe2c-06ab45efdf58",
	"9c82e19d-4575-0200-1a81-3eacf00cf872",
	"ae3de142-4d85-2547-dd26-4e90bed35cf7",
	"ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a",
	"ec845bf4-4f79-ddda-a3da-0db3774b2794",
	"910be174-449b-c412-ab22-d0873436b21b",
	"44d4e95c-4157-0037-81b2-17841bf2e8e3",
	"29a0cfab-485b-f5d5-779a-b59f85e204a8",
	"1baa85b4-4c70-1284-64bb-6481dfc3bb4e",
	"e336c6b8-418d-9340-d77f-7a9e4cfe0702",
	"42da8ccc-40d5-affc-beec-15aa47b42eda",
	"a03b24d3-4319-996d-0f8c-94bbfba1dfc7",
	"4ade7faa-4cf1-8376-95ef-39884480959b",
	"c4883e50-4494-202c-3ec3-6b8a9284f00b",
	"462080d1-4035-2937-7c09-27aa2a5c27a7",
	"f7e1b454-4ad4-1063-ec0a-159e56b58941",
	"2f59173c-4bed-b6c3-2191-dea9b58be9c7",
	"5f0aaf7a-4289-3998-d5ff-eb9a5cf7ef5c",
	"410b2e0b-4ceb-1321-1727-20858f7f3477",
];

export async function clientLoader() {
	const newLoadout: Loadout = {
		id: crypto.randomUUID(),
		name: "New Loadout",
		enabled: true,
		agentIds: [],
		weapons: Object.fromEntries(weaponIds.map((id) => [id, { templates: [] }])),
		playerCardIds: [],
		playerTitleIds: [],
		expressionIds: {
			top: { sprayIds: [], flexIds: [] },
			right: { sprayIds: [], flexIds: [] },
			bottom: { sprayIds: [], flexIds: [] },
			left: { sprayIds: [], flexIds: [] },
		},
	};

	await api.createLoadout(newLoadout);
	return redirect(`/loadouts/${newLoadout.id}`);
}

export default function NewLoadoutComponent() {
	return null;
}
