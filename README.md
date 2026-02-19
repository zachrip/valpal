# ValPal

A desktop app for Valorant players to create and randomize loadouts when joining a game. Supports agent-specific loadouts, player cards, player titles, sprays, buddies, skin levels, and skin chromas.

## Features

- **Auto Shuffle** — automatically equips a random loadout when you lock in an agent
- **Agent Detection** — filters loadouts to ones matching your selected agent
- **Non-Pregame Shuffle** — randomizes loadouts for modes without agent select (Deathmatch, Escalation, Team Deathmatch, etc.)
- **Manual Equip** — equip any saved loadout on demand from the app

## Installation

1. Download the latest `.msi` installer from [Releases](https://github.com/zachrip/valpal/releases/latest)
2. Run the installer — Windows may complain, click "More info" then "Run anyway"
3. Launch ValPal — it will appear in your system tray
4. Open Valorant
5. Create a loadout and configure it with your skins
6. When you join a match, the app will detect your agent lock-in and equip a random matching loadout

## Architecture

ValPal is a [Tauri](https://tauri.app) app with a [React Router](https://reactrouter.com) frontend and a Rust backend. The backend connects to Valorant's local WebSocket/HTTP APIs to authenticate, detect game events, and manage loadouts.

- `src/` — React frontend (UI, loadout editor)
- `src-tauri/` — Rust backend (game detection, Valorant API integration, system tray)

## Development

Prerequisites: [Node.js](https://nodejs.org), [pnpm](https://pnpm.io), [Rust](https://rustup.rs)

```
pnpm install
pnpm tauri dev
```
