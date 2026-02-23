import {
	index,
	layout,
	type RouteConfig,
	route,
} from "@react-router/dev/routes";

export default [
	layout("routes/app/layout.tsx", [
		index("routes/app/index.tsx"),
		route("loadouts", "routes/app/loadouts/layout.tsx", [
			index("routes/app/loadouts/index.tsx"),
			route("new", "routes/app/loadouts/new.tsx"),
			route(":loadoutId", "routes/app/loadouts/detail.tsx", [
				route("weapons/:weaponId", "routes/app/loadouts/weapon.tsx", [
					route("new", "routes/app/loadouts/weapon-new.tsx"),
				]),
				route("playercards", "routes/app/loadouts/playercards.tsx"),
				route("playertitles", "routes/app/loadouts/playertitles.tsx"),
				route("expressions/:slot", "routes/app/loadouts/expressions.tsx"),
			]),
		]),
	]),
] satisfies RouteConfig;
