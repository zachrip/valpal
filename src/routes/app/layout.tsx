import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { Outlet, useRevalidator } from "react-router";
import * as api from "~/apiClient";
import valpalLogo from "~/valpal.png";

export default function Layout() {
	const [connected, setConnected] = useState<boolean | null>(null);
	const revalidator = useRevalidator();

	useEffect(() => {
		api.getValorantStatus().then(setConnected);

		const unlisten = listen<boolean>("valorant-status", (event) => {
			setConnected(event.payload);
			if (event.payload) {
				revalidator.revalidate();
			}
		});

		return () => {
			unlisten.then((fn) => fn());
		};
	}, [revalidator]);

	if (!connected) {
		return (
			<div className="flex flex-col items-center justify-center h-screen">
				<div className="flex flex-col items-center justify-center bg-[rgb(242,196,73)] p-4 rounded-lg">
					<img className="w-80" src={valpalLogo} alt="ValPal Logo" />
				</div>
				<h1 className="text-white text-2xl font-medium mt-2 animate-pulse">
					Waiting for Valorant...
				</h1>
			</div>
		);
	}

	return <Outlet />;
}
