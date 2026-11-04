# ValPal

I've created this project to allow Valorant players to create loadouts which can be randomized when joining a game. It supports agent specific loadouts, player cards, player titles, sprays, buddies, skin levels, and skin chromas.

# Screenshots

Configurator main screen showing a loadout
<img src="images/main-loadout.png" />
Configurator main screen showing an agent specific loadout
<img src="images/agent-loadout.png" />

# Installation

1. You can find the latest release [here](https://github.com/zachrip/valpal/releases/latest) - download valpal.exe
2. Create a folder somewhere (desktop or your user directory, or wherever else, you do you)
3. Run the .exe - windows will probably complain, click "more info" then "run anyway"
4. You should see an item added to your system tray - right click on it and click "Open ValPal" - this will open your browser to the configurator
5. Open Valorant (you must run the game for this to work)
6. Add a loadout and configure it with your skins
7. When you join a match, the app will detect when you've locked in as an agent. If you have `Agent specific loadouts` enabled it will configure loadouts for that agent if there are any (otherwise it will fall back to all enabled loadouts). You can disable the loadout shuffling all together if you prefer to equip loadouts by hand in the configurator

# Architecture

This app is based around [Remix](https://remix.run) and packaged using [pkg](https://github.com/vercel/pkg). It uses the local websocket/http server that Valorant runs to authenticate and detect when matches start.

# Run locally (from source)

Requirements: Windows (the game and Riot Client are needed for loadouts to be applied) and Node.js 22.18+ (LTS recommended; `server.ts` runs with Node's built-in TypeScript support).

Rollup and esbuild are overridden with their WebAssembly builds (`@rollup/wasm-node`, `esbuild-wasm`) so no unsigned native binaries are needed: this lets the app run on Windows with Smart App Control / application control policies enabled.

Quick start on Windows: double-click `start-valpal.bat` (installs dependencies on first run, starts the server and opens the browser).

Manually:

1. `npm install`
2. `npm run dev`
3. Run Valorant
4. Open [http://localhost:3000](http://localhost:3000)

Production-like run: `npm run build:web` then `npm start`. `npm run build` additionally packages `dist/valpal.exe` (Windows only, needs `editbin.exe` from Visual Studio).

The system tray icon (`not-the-systray`) is an optional Windows-only dependency: if it can't be loaded, the app still runs and notifications are printed to the console.

# Contribute

1. Clone this repo
2. Follow "Run locally" above
6. The configurator code mostly lives in app/ - the rest of the stuff is in server/ (such as the game detection, system tray stuff, etc)

# Credits

- Original project by [zachrip](https://github.com/zachrip/valpal), all the core features (loadout configurator, agent detection, randomization) are his work.
- October 2026 update (runs on current Node/npm, Windows Smart App Control compatibility, reliable region detection) by Soel, with fixes written by Claude (Anthropic's AI assistant).
