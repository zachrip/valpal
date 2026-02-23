use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

const BASE_URL: &str = "https://valorant-api.com/v1";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkinChroma {
    pub uuid: String,
    pub display_name: String,
    pub display_icon: Option<String>,
    pub full_render: String,
    pub swatch: Option<String>,
    pub streamed_video: Option<String>,
    pub asset_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkinLevel {
    pub uuid: String,
    pub display_name: String,
    pub level_item: Option<String>,
    pub display_icon: Option<String>,
    pub streamed_video: Option<String>,
    pub asset_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Skin {
    pub uuid: String,
    pub display_name: String,
    pub theme_uuid: Option<String>,
    pub content_tier_uuid: Option<String>,
    pub display_icon: Option<String>,
    pub wallpaper: Option<String>,
    pub asset_path: String,
    pub chromas: Vec<SkinChroma>,
    pub levels: Vec<SkinLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Weapon {
    pub uuid: String,
    pub display_name: String,
    pub category: String,
    pub default_skin_uuid: String,
    pub display_icon: String,
    pub kill_stream_icon: String,
    pub asset_path: String,
    pub skins: Vec<Skin>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuddyLevel {
    pub uuid: String,
    pub charm_level: u32,
    pub display_name: String,
    pub display_icon: String,
    pub asset_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Buddy {
    pub uuid: String,
    pub display_name: String,
    pub is_hidden_if_not_owned: bool,
    pub theme_uuid: Option<String>,
    pub display_icon: String,
    pub asset_path: String,
    pub levels: Vec<BuddyLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerCard {
    pub uuid: String,
    pub display_name: String,
    pub is_hidden_if_not_owned: bool,
    pub theme_uuid: Option<String>,
    pub display_icon: String,
    pub small_art: String,
    pub wide_art: String,
    pub large_art: Option<String>,
    pub asset_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SprayLevel {
    pub uuid: String,
    pub spray_level: u32,
    pub display_name: String,
    pub display_icon: Option<String>,
    pub asset_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Spray {
    pub uuid: String,
    pub display_name: String,
    pub category: Option<String>,
    pub theme_uuid: Option<String>,
    pub display_icon: String,
    pub full_icon: Option<String>,
    pub full_transparent_icon: Option<String>,
    pub animation_png: Option<String>,
    pub animation_gif: Option<String>,
    pub asset_path: String,
    pub levels: Vec<SprayLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Flex {
    pub uuid: String,
    pub display_name: String,
    pub display_icon: String,
    pub asset_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerTitle {
    pub uuid: String,
    pub display_name: Option<String>,
    pub title_text: Option<String>,
    pub is_hidden_if_not_owned: bool,
    pub asset_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Role {
    pub uuid: String,
    pub display_name: String,
    pub description: String,
    pub display_icon: String,
    pub asset_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Ability {
    pub slot: String,
    pub display_name: String,
    pub description: String,
    pub display_icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub uuid: String,
    pub display_name: String,
    pub description: String,
    pub developer_name: String,
    pub character_tags: Option<Vec<String>>,
    pub display_icon: String,
    pub display_icon_small: String,
    pub bust_portrait: String,
    pub full_portrait: String,
    pub full_portrait_v2: String,
    pub killfeed_portrait: String,
    pub background: String,
    pub background_gradient_colors: Option<Vec<String>>,
    pub asset_path: String,
    pub is_full_portrait_right_facing: bool,
    pub is_playable_character: bool,
    pub is_available_for_test: bool,
    pub is_base_content: bool,
    pub role: Option<Role>,
    pub abilities: Vec<Ability>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValorantData {
    pub weapons: Vec<Weapon>,
    pub buddies: Vec<Buddy>,
    #[serde(rename = "playerCards")]
    pub player_cards: Vec<PlayerCard>,
    pub sprays: Vec<Spray>,
    #[serde(rename = "playerTitles")]
    pub player_titles: Vec<PlayerTitle>,
    pub agents: Vec<Agent>,
    pub flex: Vec<Flex>,
}

pub type ValorantDataCache = Arc<RwLock<Option<ValorantData>>>;

#[derive(Deserialize)]
struct ApiResponse<T> {
    data: T,
}

fn json_context_at(body: &str, column: usize) -> String {
    let start = column.saturating_sub(120);
    let end = (column + 60).min(body.len());
    let snippet = &body[start..end];
    let pointer = column - start;
    format!("...{}...\n   {}^", snippet, " ".repeat(pointer))
}

async fn fetch_data<T: serde::de::DeserializeOwned>(
    client: &Client,
    endpoint: &str,
) -> Result<T, String> {
    let url = format!("{}{}", BASE_URL, endpoint);
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch {}: {}", endpoint, e))?;

    let body = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read body from {}: {}", endpoint, e))?;

    let api_resp: ApiResponse<T> = serde_json::from_str(&body).map_err(|e| {
        let context = json_context_at(&body, e.column().saturating_sub(1));
        format!(
            "Failed to parse {}: {}\n\nContext:\n{}",
            endpoint, e, context
        )
    })?;

    Ok(api_resp.data)
}

pub async fn get_valorant_data(cache: &ValorantDataCache) -> Result<ValorantData, String> {
    {
        let read = cache.read().await;
        if let Some(data) = read.as_ref() {
            return Ok(data.clone());
        }
    }

    let client = Client::new();
    let (weapons, buddies, player_cards, sprays, player_titles, agents, flex) = tokio::try_join!(
        fetch_data::<Vec<Weapon>>(&client, "/weapons"),
        fetch_data::<Vec<Buddy>>(&client, "/buddies"),
        fetch_data::<Vec<PlayerCard>>(&client, "/playercards"),
        fetch_data::<Vec<Spray>>(&client, "/sprays"),
        fetch_data::<Vec<PlayerTitle>>(&client, "/playertitles"),
        fetch_data::<Vec<Agent>>(&client, "/agents?isPlayableCharacter=true"),
        fetch_data::<Vec<Flex>>(&client, "/flex"),
    )?;

    let data = ValorantData {
        weapons,
        buddies,
        player_cards,
        sprays,
        player_titles,
        agents,
        flex,
    };

    let mut write = cache.write().await;
    *write = Some(data.clone());

    Ok(data)
}
