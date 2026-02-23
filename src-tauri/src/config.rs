use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;

const CONFIG_VERSION: u32 = 3;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeaponTemplate {
    pub id: String,
    #[serde(rename = "skinId")]
    pub skin_id: String,
    #[serde(rename = "levelIds")]
    pub level_ids: Vec<String>,
    #[serde(rename = "chromaIds")]
    pub chroma_ids: Vec<String>,
    pub buddies: Vec<BuddyTemplate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuddyTemplate {
    pub id: String,
    #[serde(rename = "levelIds")]
    pub level_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeaponConfig {
    pub templates: Vec<WeaponTemplate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpressionSlot {
    #[serde(rename = "sprayIds")]
    pub spray_ids: Vec<String>,
    #[serde(rename = "flexIds")]
    pub flex_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpressionIds {
    pub top: ExpressionSlot,
    pub right: ExpressionSlot,
    pub bottom: ExpressionSlot,
    pub left: ExpressionSlot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Loadout {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    #[serde(rename = "agentIds")]
    pub agent_ids: Vec<String>,
    pub weapons: HashMap<String, WeaponConfig>,
    #[serde(rename = "playerCardIds")]
    pub player_card_ids: Vec<String>,
    #[serde(rename = "playerTitleIds")]
    pub player_title_ids: Vec<String>,
    #[serde(rename = "expressionIds")]
    pub expression_ids: ExpressionIds,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserConfig {
    pub version: u32,
    pub loadouts: Vec<Loadout>,
}

impl Default for UserConfig {
    fn default() -> Self {
        Self {
            version: CONFIG_VERSION,
            loadouts: vec![create_default_loadout()],
        }
    }
}

pub fn create_default_loadout() -> Loadout {
    let weapon_ids = vec![
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
    ];

    let weapons: HashMap<String, WeaponConfig> = weapon_ids
        .into_iter()
        .map(|id| (id.to_string(), WeaponConfig { templates: vec![] }))
        .collect();

    Loadout {
        id: uuid::Uuid::new_v4().to_string(),
        name: "Default Loadout".to_string(),
        enabled: true,
        agent_ids: vec![],
        weapons,
        player_card_ids: vec![],
        player_title_ids: vec![],
        expression_ids: ExpressionIds {
            top: ExpressionSlot {
                spray_ids: vec![],
                flex_ids: vec![],
            },
            right: ExpressionSlot {
                spray_ids: vec![],
                flex_ids: vec![],
            },
            bottom: ExpressionSlot {
                spray_ids: vec![],
                flex_ids: vec![],
            },
            left: ExpressionSlot {
                spray_ids: vec![],
                flex_ids: vec![],
            },
        },
    }
}

fn get_config_path(base_dir: &Path, user_id: &str) -> PathBuf {
    base_dir.join(format!("user_{}.json", user_id))
}

fn migrate_v1_to_v2(config: &mut Value) {
    if let Some(loadouts) = config.get_mut("loadouts").and_then(|v| v.as_array_mut()) {
        for loadout in loadouts.iter_mut() {
            if let Some(spray_ids) = loadout.get("sprayIds").cloned() {
                let pre_round = spray_ids
                    .get("preRound")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();
                let mid_round = spray_ids
                    .get("midRound")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();
                let post_round = spray_ids
                    .get("postRound")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();

                let new_spray_ids = serde_json::json!({
                    "top": mid_round,
                    "right": post_round,
                    "bottom": [],
                    "left": pre_round
                });

                loadout["sprayIds"] = new_spray_ids;
            }
        }
    }
    config["version"] = serde_json::json!(2);
}

fn migrate_v2_to_v3(config: &mut Value) {
    if let Some(loadouts) = config.get_mut("loadouts").and_then(|v| v.as_array_mut()) {
        for loadout in loadouts.iter_mut() {
            if let Some(spray_ids) = loadout.get("sprayIds").cloned() {
                let top = spray_ids
                    .get("top")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();
                let right = spray_ids
                    .get("right")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();
                let bottom = spray_ids
                    .get("bottom")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();
                let left = spray_ids
                    .get("left")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();

                let expression_ids = serde_json::json!({
                    "top": { "sprayIds": top, "flexIds": [] },
                    "right": { "sprayIds": right, "flexIds": [] },
                    "bottom": { "sprayIds": bottom, "flexIds": [] },
                    "left": { "sprayIds": left, "flexIds": [] }
                });

                loadout["expressionIds"] = expression_ids;
                loadout.as_object_mut().map(|o| o.remove("sprayIds"));
            }
        }
    }
    config["version"] = serde_json::json!(3);
}

fn migrate_config(content: &str) -> Result<(UserConfig, bool), String> {
    let mut config: Value =
        serde_json::from_str(content).map_err(|e| format!("Failed to parse config: {}", e))?;

    let original_version = config.get("version").and_then(|v| v.as_u64()).unwrap_or(1) as u32;
    let mut migrated = original_version != CONFIG_VERSION;

    if original_version < 2 {
        println!("Migrating config from v1 to v2...");
        migrate_v1_to_v2(&mut config);
    }

    let version = config.get("version").and_then(|v| v.as_u64()).unwrap_or(2) as u32;

    if version < 3 {
        println!("Migrating config from v2 to v3...");
        migrate_v2_to_v3(&mut config);
    }

    if config.get("version").is_none() {
        config["version"] = serde_json::json!(CONFIG_VERSION);
        migrated = true;
    }

    let user_config = serde_json::from_value(config)
        .map_err(|e| format!("Failed to parse migrated config: {}", e))?;
    Ok((user_config, migrated))
}

pub async fn get_user_config(base_dir: &Path, user_id: &str) -> Result<UserConfig, String> {
    let path = get_config_path(base_dir, user_id);

    if !path.exists() {
        let config = UserConfig::default();
        save_user_config(base_dir, user_id, &config).await?;
        return Ok(config);
    }

    let content = fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read config: {}", e))?;

    let (config, migrated) = migrate_config(&content)?;

    if migrated {
        save_user_config(base_dir, user_id, &config).await?;
    }

    Ok(config)
}

pub async fn save_user_config(
    base_dir: &Path,
    user_id: &str,
    config: &UserConfig,
) -> Result<(), String> {
    let path = get_config_path(base_dir, user_id);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let config_to_save = UserConfig {
        version: CONFIG_VERSION,
        loadouts: config.loadouts.clone(),
    };

    let content = serde_json::to_string_pretty(&config_to_save)
        .map_err(|e| format!("Failed to serialize: {}", e))?;

    fs::write(&path, content)
        .await
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}
