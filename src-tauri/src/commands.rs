use crate::config::{self, Loadout, UserConfig};
use crate::valorant::{self, EntitlementsResponse, UserData, ValorantLoadout};
use crate::valorant_data;
use crate::{AppState, ShuffleSettingsPayload, TrayMenuState};
use std::sync::atomic::Ordering;
use tauri::{Emitter, State};

fn is_token_expired_error(err: &str) -> bool {
    err.contains("BAD_CLAIMS")
}

async fn get_user_or_err(state: &AppState) -> Result<UserData, String> {
    valorant::get_user(&state.region_cache, &state.user_cache)
        .await?
        .ok_or_else(|| "No user logged in.".to_string())
}

async fn refresh_user(state: &AppState) -> Result<UserData, String> {
    valorant::invalidate_user_cache(&state.user_cache).await;
    get_user_or_err(state).await
}

#[tauri::command]
pub async fn get_user(
    state: State<'_, AppState>,
) -> Result<Option<valorant::UserData>, String> {
    let t = std::time::Instant::now();
    let result = valorant::get_user(&state.region_cache, &state.user_cache).await;
    println!("[CMD] get_user: {:?}", t.elapsed());
    result
}

#[tauri::command]
pub async fn get_loadout(
    state: State<'_, AppState>,
) -> Result<ValorantLoadout, String> {
    let t = std::time::Instant::now();
    let user = get_user_or_err(&state).await?;
    println!("[CMD] get_loadout: get_user took {:?}", t.elapsed());
    let t2 = std::time::Instant::now();
    match valorant::get_loadout(&user).await {
        Ok(v) => {
            println!("[CMD] get_loadout: get_loadout took {:?}, total {:?}", t2.elapsed(), t.elapsed());
            Ok(v)
        }
        Err(e) if is_token_expired_error(&e) => {
            println!("[CMD] get_loadout: token expired, refreshing...");
            let user = refresh_user(&state).await?;
            valorant::get_loadout(&user).await
        }
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub async fn get_entitlements(
    state: State<'_, AppState>,
) -> Result<EntitlementsResponse, String> {
    let t = std::time::Instant::now();
    let user = get_user_or_err(&state).await?;
    match valorant::get_entitlements(&user).await {
        Ok(v) => {
            println!("[CMD] get_entitlements: {:?}", t.elapsed());
            Ok(v)
        }
        Err(e) if is_token_expired_error(&e) => {
            println!("[CMD] get_entitlements: token expired, refreshing...");
            let user = refresh_user(&state).await?;
            valorant::get_entitlements(&user).await
        }
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub async fn equip_loadout(
    state: State<'_, AppState>,
    loadout: ValorantLoadout,
) -> Result<bool, String> {
    let t = std::time::Instant::now();
    let user = get_user_or_err(&state).await?;
    match valorant::equip_loadout(&user, loadout.clone()).await {
        Ok(()) => {
            println!("[CMD] equip_loadout: {:?}", t.elapsed());
            Ok(true)
        }
        Err(e) if is_token_expired_error(&e) => {
            println!("[CMD] equip_loadout: token expired, refreshing...");
            let user = refresh_user(&state).await?;
            valorant::equip_loadout(&user, loadout).await?;
            Ok(true)
        }
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub async fn get_user_config(
    state: State<'_, AppState>,
) -> Result<UserConfig, String> {
    let t = std::time::Instant::now();
    let user = get_user_or_err(&state).await?;
    let result = config::get_user_config(&state.config_dir, &user.user_id).await;
    println!("[CMD] get_user_config: {:?}", t.elapsed());
    result
}

#[tauri::command]
pub async fn save_user_config(
    state: State<'_, AppState>,
    config: UserConfig,
) -> Result<UserConfig, String> {
    let user = get_user_or_err(&state).await?;
    config::save_user_config(&state.config_dir, &user.user_id, &config).await?;
    Ok(config)
}

#[tauri::command]
pub async fn create_loadout(
    state: State<'_, AppState>,
    loadout: Loadout,
) -> Result<Loadout, String> {
    let user = get_user_or_err(&state).await?;
    let mut user_config = config::get_user_config(&state.config_dir, &user.user_id).await?;
    user_config.loadouts.push(loadout.clone());
    config::save_user_config(&state.config_dir, &user.user_id, &user_config).await?;
    Ok(loadout)
}

#[tauri::command]
pub async fn update_loadout(
    state: State<'_, AppState>,
    loadout: Loadout,
) -> Result<Loadout, String> {
    let user = get_user_or_err(&state).await?;
    let mut user_config = config::get_user_config(&state.config_dir, &user.user_id).await?;
    let existing = user_config
        .loadouts
        .iter_mut()
        .find(|l| l.id == loadout.id)
        .ok_or_else(|| "Loadout not found.".to_string())?;
    *existing = loadout.clone();
    config::save_user_config(&state.config_dir, &user.user_id, &user_config).await?;
    Ok(loadout)
}

#[tauri::command]
pub async fn delete_loadout(
    state: State<'_, AppState>,
    loadout_id: String,
) -> Result<String, String> {
    let t = std::time::Instant::now();
    let user = get_user_or_err(&state).await?;
    println!("[CMD] delete_loadout: get_user took {:?}", t.elapsed());
    let mut user_config = config::get_user_config(&state.config_dir, &user.user_id).await?;
    let original_len = user_config.loadouts.len();
    user_config.loadouts.retain(|l| l.id != loadout_id);
    if user_config.loadouts.len() < original_len {
        config::save_user_config(&state.config_dir, &user.user_id, &user_config).await?;
        println!("[CMD] delete_loadout: total {:?}", t.elapsed());
        Ok(loadout_id)
    } else {
        Err("Loadout not found.".to_string())
    }
}

#[tauri::command]
pub async fn save_in_game_loadout(
    state: State<'_, AppState>,
    name: String,
) -> Result<Loadout, String> {
    let t = std::time::Instant::now();
    let mut user = get_user_or_err(&state).await?;
    println!("[CMD] save_in_game_loadout: get_user took {:?}", t.elapsed());
    let t2 = std::time::Instant::now();
    let in_game_loadout = match valorant::get_loadout(&user).await {
        Ok(v) => v,
        Err(e) if is_token_expired_error(&e) => {
            println!("[CMD] save_in_game_loadout: token expired, refreshing...");
            user = refresh_user(&state).await?;
            valorant::get_loadout(&user).await?
        }
        Err(e) => return Err(e),
    };
    println!("[CMD] save_in_game_loadout: get_loadout took {:?}", t2.elapsed());
    let t3 = std::time::Instant::now();
    let val_data = valorant_data::get_valorant_data(&state.valorant_data_cache).await?;
    println!("[CMD] save_in_game_loadout: get_valorant_data took {:?}", t3.elapsed());
    let default_skin_ids: Vec<String> = val_data
        .weapons
        .iter()
        .map(|w| w.default_skin_uuid.clone())
        .collect();
    let mut user_config = config::get_user_config(&state.config_dir, &user.user_id).await?;
    let loadout = convert_valorant_loadout_to_config(&in_game_loadout, &name, &default_skin_ids);
    user_config.loadouts.push(loadout.clone());
    config::save_user_config(&state.config_dir, &user.user_id, &user_config).await?;
    println!("[CMD] save_in_game_loadout: total {:?}", t.elapsed());
    Ok(loadout)
}

#[tauri::command]
pub async fn get_valorant_data(
    state: State<'_, AppState>,
) -> Result<valorant_data::ValorantData, String> {
    valorant_data::get_valorant_data(&state.valorant_data_cache).await
}

#[tauri::command]
pub fn get_valorant_status(state: State<'_, AppState>) -> bool {
    state.valorant_connected.load(Ordering::SeqCst)
}

#[tauri::command]
pub fn get_shuffle_settings(state: State<'_, AppState>) -> ShuffleSettingsPayload {
    ShuffleSettingsPayload {
        auto_shuffle_enabled: state.shuffle_settings.is_auto_shuffle_enabled(),
        agent_detection_enabled: state.shuffle_settings.is_agent_detection_enabled(),
        non_pregame_shuffle_enabled: state.shuffle_settings.is_non_pregame_shuffle_enabled(),
    }
}

#[tauri::command]
pub fn set_auto_shuffle_enabled(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    tray_state: State<'_, TrayMenuState>,
    enabled: bool,
) -> Result<(), String> {
    state.shuffle_settings.set_auto_shuffle_enabled(enabled);
    tray_state
        .auto_shuffle_item
        .set_checked(enabled)
        .map_err(|e| e.to_string())?;
    let _ = tray_state.agent_detection_item.set_enabled(enabled);
    let _ = tray_state.non_pregame_shuffle_item.set_enabled(enabled);
    let _ = app_handle.emit(
        "shuffle-settings-changed",
        ShuffleSettingsPayload {
            auto_shuffle_enabled: enabled,
            agent_detection_enabled: state.shuffle_settings.is_agent_detection_enabled(),
            non_pregame_shuffle_enabled: state.shuffle_settings.is_non_pregame_shuffle_enabled(),
        },
    );
    Ok(())
}

#[tauri::command]
pub fn set_agent_detection_enabled(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    tray_state: State<'_, TrayMenuState>,
    enabled: bool,
) -> Result<(), String> {
    state.shuffle_settings.set_agent_detection_enabled(enabled);
    tray_state
        .agent_detection_item
        .set_checked(enabled)
        .map_err(|e| e.to_string())?;
    let _ = app_handle.emit(
        "shuffle-settings-changed",
        ShuffleSettingsPayload {
            auto_shuffle_enabled: state.shuffle_settings.is_auto_shuffle_enabled(),
            agent_detection_enabled: enabled,
            non_pregame_shuffle_enabled: state.shuffle_settings.is_non_pregame_shuffle_enabled(),
        },
    );
    Ok(())
}

#[tauri::command]
pub fn set_non_pregame_shuffle_enabled(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    tray_state: State<'_, TrayMenuState>,
    enabled: bool,
) -> Result<(), String> {
    state.shuffle_settings.set_non_pregame_shuffle_enabled(enabled);
    tray_state
        .non_pregame_shuffle_item
        .set_checked(enabled)
        .map_err(|e| e.to_string())?;
    let _ = app_handle.emit(
        "shuffle-settings-changed",
        ShuffleSettingsPayload {
            auto_shuffle_enabled: state.shuffle_settings.is_auto_shuffle_enabled(),
            agent_detection_enabled: state.shuffle_settings.is_agent_detection_enabled(),
            non_pregame_shuffle_enabled: enabled,
        },
    );
    Ok(())
}

#[tauri::command]
pub async fn equip_loadout_by_id(
    state: State<'_, AppState>,
    loadout_id: String,
) -> Result<bool, String> {
    let t = std::time::Instant::now();
    let user = get_user_or_err(&state).await?;
    let user_config = config::get_user_config(&state.config_dir, &user.user_id).await?;
    let loadout = user_config
        .loadouts
        .iter()
        .find(|l| l.id == loadout_id)
        .ok_or_else(|| "Loadout not found.".to_string())?
        .clone();

    let existing = match valorant::get_loadout(&user).await {
        Ok(v) => v,
        Err(e) if is_token_expired_error(&e) => {
            let user = refresh_user(&state).await?;
            valorant::get_loadout(&user).await?
        }
        Err(e) => return Err(e),
    };

    let entitlements = match valorant::get_entitlements(&user).await {
        Ok(v) => v,
        Err(e) if is_token_expired_error(&e) => {
            let user = refresh_user(&state).await?;
            valorant::get_entitlements(&user).await?
        }
        Err(e) => return Err(e),
    };

    let valorant_loadout =
        crate::game_detection::build_valorant_loadout(&loadout, &existing, &entitlements);

    let equip_user = get_user_or_err(&state).await?;
    match valorant::equip_loadout(&equip_user, valorant_loadout.clone()).await {
        Ok(()) => {
            println!("[CMD] equip_loadout_by_id: {:?}", t.elapsed());
            Ok(true)
        }
        Err(e) if is_token_expired_error(&e) => {
            let user = refresh_user(&state).await?;
            valorant::equip_loadout(&user, valorant_loadout).await?;
            Ok(true)
        }
        Err(e) => Err(e),
    }
}

fn convert_valorant_loadout_to_config(loadout: &ValorantLoadout, name: &str, default_skin_ids: &[String]) -> Loadout {
    use crate::config::{BuddyTemplate, ExpressionIds, ExpressionSlot, WeaponConfig, WeaponTemplate};
    use std::collections::HashMap;

    let spray_type_id = "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475";
    let flex_type_id = "03a572de-4234-31ed-d344-ababa488f981";

    let mut expression_ids = ExpressionIds {
        top: ExpressionSlot { spray_ids: vec![], flex_ids: vec![] },
        right: ExpressionSlot { spray_ids: vec![], flex_ids: vec![] },
        bottom: ExpressionSlot { spray_ids: vec![], flex_ids: vec![] },
        left: ExpressionSlot { spray_ids: vec![], flex_ids: vec![] },
    };

    let slots = [
        &mut expression_ids.top,
        &mut expression_ids.right,
        &mut expression_ids.bottom,
        &mut expression_ids.left,
    ];
    for (i, slot) in slots.into_iter().enumerate() {
        if let Some(expr) = loadout.active_expressions.get(i) {
            if expr.type_id == spray_type_id {
                slot.spray_ids.push(expr.asset_id.clone());
            } else if expr.type_id == flex_type_id {
                slot.flex_ids.push(expr.asset_id.clone());
            }
        }
    }

    let weapons: HashMap<String, WeaponConfig> = loadout
        .guns
        .iter()
        .filter(|gun| !default_skin_ids.contains(&gun.skin_id))
        .map(|gun| {
            let buddies = if let (Some(charm_id), Some(charm_level_id)) =
                (&gun.charm_id, &gun.charm_level_id)
            {
                vec![BuddyTemplate {
                    id: charm_id.clone(),
                    level_ids: vec![charm_level_id.clone()],
                }]
            } else {
                vec![]
            };

            (
                gun.id.clone(),
                WeaponConfig {
                    templates: vec![WeaponTemplate {
                        id: gun.id.clone(),
                        skin_id: gun.skin_id.clone(),
                        level_ids: vec![gun.skin_level_id.clone()],
                        chroma_ids: vec![gun.chroma_id.clone()],
                        buddies,
                    }],
                },
            )
        })
        .collect();

    Loadout {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.to_string(),
        enabled: true,
        agent_ids: vec![],
        weapons,
        player_card_ids: vec![loadout.identity.player_card_id.clone()],
        player_title_ids: vec![loadout.identity.player_title_id.clone()],
        expression_ids,
    }
}
