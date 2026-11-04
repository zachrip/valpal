import { exec } from 'node:child_process';
import { createRequire } from 'node:module';

/**
 * Wrapper autour de "not-the-systray" (module natif Windows uniquement).
 * Si le module n'est pas disponible (Linux, macOS, Node trop récent sans
 * binaire précompilé...), l'appli continue de tourner sans icône : les
 * notifications sont simplement écrites dans la console.
 */

export type TrayHandlers = {
	onToggleShuffle: (enabled: boolean) => void;
	onToggleAgentDetection: (enabled: boolean) => void;
};

export type Tray = {
	notify: (title: string, text: string) => void;
};

export function openUrl(url: string) {
	const command =
		process.platform === 'win32'
			? `start "" "${url}"`
			: process.platform === 'darwin'
				? `open "${url}"`
				: `xdg-open "${url}"`;

	exec(command, (error) => {
		if (error) {
			console.log(`Ouvrez ${url} dans votre navigateur`);
		}
	});
}

const openItemId = 3;
const loadoutShufflingItemId = 1;
const agentDetectionItemId = 2;
const quitItemId = 4;

// biome-ignore lint/suspicious/noExplicitAny: module natif optionnel, sans types
function loadSystray(): any {
	if (process.platform !== 'win32') {
		return null;
	}

	try {
		const require = createRequire(import.meta.url ?? __filename);
		return require('not-the-systray');
	} catch (e) {
		console.warn(
			'Icone systray indisponible (not-the-systray non chargé), on continue sans :',
			(e as Error).message,
		);
		return null;
	}
}

export function createTray(url: string, handlers: TrayHandlers): Tray {
	const systray = loadSystray();

	if (!systray) {
		return {
			notify(title, text) {
				console.log(`[${title}] ${text}`);
			},
		};
	}

	const { NotifyIcon, Icon, Menu } = systray;
	const notificationIcon = Icon.load(Icon.ids.info, Icon.large);

	const menu = new Menu([
		{ id: openItemId, text: 'Open ValPal' },
		{ id: loadoutShufflingItemId, text: 'Loadout shuffling', checked: true },
		{ id: agentDetectionItemId, text: 'Agent specific loadouts', checked: true },
		{ id: quitItemId, text: 'Quit' },
	]);

	const appIcon = new NotifyIcon({
		icon: Icon.load(Icon.ids.app, Icon.small),
		tooltip: 'ValPal',
		onSelect: ({ mouseX, mouseY }: { mouseX: number; mouseY: number }) => {
			const id = menu.showSync(mouseX, mouseY);
			switch (id) {
				case openItemId: {
					openUrl(url);
					break;
				}
				case loadoutShufflingItemId: {
					const checked = !menu.get(loadoutShufflingItemId).checked;
					menu.update(loadoutShufflingItemId, { checked });
					handlers.onToggleShuffle(checked);
					break;
				}
				case agentDetectionItemId: {
					const checked = !menu.get(agentDetectionItemId).checked;
					menu.update(agentDetectionItemId, { checked });
					handlers.onToggleAgentDetection(checked);
					break;
				}
				case quitItemId: {
					appIcon.remove();
					process.exit(0);
				}
			}
		},
	});

	return {
		notify(title, text) {
			appIcon.update({
				notification: { icon: notificationIcon, title, text },
			});
		},
	};
}
