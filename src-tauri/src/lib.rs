mod commands;
mod config;
mod game_detection;
mod valorant;
mod valorant_data;

use game_detection::ShuffleSettings;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};
use tokio::sync::RwLock;
use valorant::{RegionShardCache, UserDataCache};
use valorant_data::ValorantDataCache;

pub struct AppState {
    pub region_cache: RegionShardCache,
    pub user_cache: UserDataCache,
    pub config_dir: PathBuf,
    pub valorant_data_cache: ValorantDataCache,
    pub valorant_connected: Arc<AtomicBool>,
    pub shuffle_settings: ShuffleSettings,
}

pub struct TrayMenuState {
    pub auto_shuffle_item: CheckMenuItem<tauri::Wry>,
    pub agent_detection_item: CheckMenuItem<tauri::Wry>,
    pub non_pregame_shuffle_item: CheckMenuItem<tauri::Wry>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let config_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            let region_cache: RegionShardCache =
                Arc::new(RwLock::new(std::collections::HashMap::new()));

            let valorant_data_cache: ValorantDataCache = Arc::new(RwLock::new(None));
            let user_cache: UserDataCache = Arc::new(RwLock::new(None));
            let valorant_connected = Arc::new(AtomicBool::new(false));
            let shuffle_settings = ShuffleSettings::new();

            let state = AppState {
                region_cache: Arc::clone(&region_cache),
                user_cache: Arc::clone(&user_cache),
                config_dir: config_dir.clone(),
                valorant_data_cache,
                valorant_connected: Arc::clone(&valorant_connected),
                shuffle_settings: shuffle_settings.clone(),
            };

            app.manage(state);

            let auto_shuffle_item = CheckMenuItem::with_id(
                app,
                "auto_shuffle",
                "Auto Shuffle",
                true,
                true,
                None::<&str>,
            )?;
            let agent_detection_item = CheckMenuItem::with_id(
                app,
                "agent_detection",
                "Agent Detection",
                true,
                true,
                None::<&str>,
            )?;
            let non_pregame_shuffle_item = CheckMenuItem::with_id(
                app,
                "non_pregame_shuffle",
                "Shuffle in Non-Pregame Modes",
                true,
                true,
                None::<&str>,
            )?;
            let separator = PredefinedMenuItem::separator(app)?;
            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &auto_shuffle_item,
                    &agent_detection_item,
                    &non_pregame_shuffle_item,
                    &separator,
                    &show_item,
                    &quit_item,
                ],
            )?;

            let settings_for_tray = shuffle_settings.clone();
            let auto_shuffle_clone = auto_shuffle_item.clone();
            let agent_detection_clone = agent_detection_item.clone();
            let non_pregame_shuffle_clone = non_pregame_shuffle_item.clone();

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("valpal")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "auto_shuffle" => {
                            if let Ok(checked) = auto_shuffle_clone.is_checked() {
                                settings_for_tray.set_auto_shuffle_enabled(checked);
                                let _ = agent_detection_clone.set_enabled(checked);
                                let _ = non_pregame_shuffle_clone.set_enabled(checked);
                                let _ = app.emit(
                                    "shuffle-settings-changed",
                                    ShuffleSettingsPayload {
                                        auto_shuffle_enabled: checked,
                                        agent_detection_enabled: settings_for_tray
                                            .is_agent_detection_enabled(),
                                        non_pregame_shuffle_enabled: settings_for_tray
                                            .is_non_pregame_shuffle_enabled(),
                                    },
                                );
                            }
                        }
                        "agent_detection" => {
                            if let Ok(checked) = agent_detection_clone.is_checked() {
                                settings_for_tray.set_agent_detection_enabled(checked);
                                let _ = app.emit(
                                    "shuffle-settings-changed",
                                    ShuffleSettingsPayload {
                                        auto_shuffle_enabled: settings_for_tray
                                            .is_auto_shuffle_enabled(),
                                        agent_detection_enabled: checked,
                                        non_pregame_shuffle_enabled: settings_for_tray
                                            .is_non_pregame_shuffle_enabled(),
                                    },
                                );
                            }
                        }
                        "non_pregame_shuffle" => {
                            if let Ok(checked) = non_pregame_shuffle_clone.is_checked() {
                                settings_for_tray.set_non_pregame_shuffle_enabled(checked);
                                let _ = app.emit(
                                    "shuffle-settings-changed",
                                    ShuffleSettingsPayload {
                                        auto_shuffle_enabled: settings_for_tray
                                            .is_auto_shuffle_enabled(),
                                        agent_detection_enabled: settings_for_tray
                                            .is_agent_detection_enabled(),
                                        non_pregame_shuffle_enabled: checked,
                                    },
                                );
                            }
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            app.manage(TrayMenuState {
                auto_shuffle_item,
                agent_detection_item,
                non_pregame_shuffle_item,
            });

            let app_handle = app.handle().clone();
            let detector = game_detection::GameDetector::new(
                region_cache,
                user_cache,
                shuffle_settings,
                config_dir,
                app_handle,
                valorant_connected,
            );

            tauri::async_runtime::spawn(async move {
                detector.run().await;
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_user,
            commands::get_loadout,
            commands::get_entitlements,
            commands::equip_loadout,
            commands::get_user_config,
            commands::save_user_config,
            commands::create_loadout,
            commands::update_loadout,
            commands::delete_loadout,
            commands::save_in_game_loadout,
            commands::get_valorant_data,
            commands::get_valorant_status,
            commands::get_shuffle_settings,
            commands::set_auto_shuffle_enabled,
            commands::set_agent_detection_enabled,
            commands::set_non_pregame_shuffle_enabled,
            commands::equip_loadout_by_id,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShuffleSettingsPayload {
    pub auto_shuffle_enabled: bool,
    pub agent_detection_enabled: bool,
    pub non_pregame_shuffle_enabled: bool,
}
