use base64::{engine::general_purpose, Engine as _};
use reqwest::Client;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

fn log_response_preview(body: &str, max_len: usize) -> String {
    if body.len() > max_len {
        format!("{}... ({} bytes total)", &body[..max_len], body.len())
    } else {
        body.to_string()
    }
}

async fn parse_json_response<T: DeserializeOwned>(
    response: reqwest::Response,
    context: &str,
) -> Result<T, String> {
    let status = response.status();
    let url = response.url().to_string();

    let body = response.text().await.map_err(|e| {
        eprintln!("[API] Failed to read response body from {}: {}", url, e);
        format!("Failed to read response body: {}", e)
    })?;

    println!(
        "[API] {} response ({}): {}",
        context,
        status,
        log_response_preview(&body, 500)
    );

    if !status.is_success() {
        eprintln!(
            "[API] {} failed with status {}: {}",
            context,
            status,
            log_response_preview(&body, 1000)
        );
        return Err(format!(
            "{} failed ({}): {}",
            context,
            status,
            log_response_preview(&body, 200)
        ));
    }

    serde_json::from_str(&body).map_err(|e| {
        eprintln!("[API] {} JSON parse error: {}", context, e);
        eprintln!(
            "[API] {} raw body was: {}",
            context,
            log_response_preview(&body, 2000)
        );
        format!(
            "JSON parse error for {}: {} (body: {})",
            context,
            e,
            log_response_preview(&body, 200)
        )
    })
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum Region {
    AP,
    EU,
    KO,
    NA,
    LATAM,
    BR,
}

impl Region {
    pub fn as_str(&self) -> &str {
        match self {
            Region::AP => "ap",
            Region::EU => "eu",
            Region::KO => "ko",
            Region::NA => "na",
            Region::LATAM => "latam",
            Region::BR => "br",
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum Shard {
    NA,
    EU,
    AP,
    KR,
    PBE,
}

impl Shard {
    pub fn as_str(&self) -> &str {
        match self {
            Shard::NA => "na",
            Shard::EU => "eu",
            Shard::AP => "ap",
            Shard::KR => "kr",
            Shard::PBE => "pbe",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Lockfile {
    pub port: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlayerInfo {
    pub display_name: String,
    pub game_name: String,
    pub tag_line: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserData {
    pub access_token: String,
    pub entitlements_token: String,
    pub user_id: String,
    pub region: Region,
    pub shard: Shard,
    pub riot_client_version: String,
    pub player_info: PlayerInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct Gun {
    #[serde(rename = "ID")]
    pub id: String,
    #[serde(rename = "SkinID")]
    pub skin_id: String,
    #[serde(rename = "SkinLevelID")]
    pub skin_level_id: String,
    #[serde(rename = "ChromaID")]
    pub chroma_id: String,
    #[serde(rename = "CharmInstanceID")]
    pub charm_instance_id: Option<String>,
    #[serde(rename = "CharmID")]
    pub charm_id: Option<String>,
    #[serde(rename = "CharmLevelID")]
    pub charm_level_id: Option<String>,
    pub attachments: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct ActiveExpression {
    #[serde(rename = "TypeID")]
    pub type_id: String,
    #[serde(rename = "AssetID")]
    pub asset_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct Identity {
    #[serde(rename = "PlayerCardID")]
    pub player_card_id: String,
    #[serde(rename = "PlayerTitleID")]
    pub player_title_id: String,
    pub account_level: u32,
    #[serde(rename = "PreferredLevelBorderID")]
    pub preferred_level_border_id: String,
    pub hide_account_level: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct ValorantLoadout {
    pub subject: String,
    pub version: u32,
    pub guns: Vec<Gun>,
    pub active_expressions: Vec<ActiveExpression>,
    pub identity: Identity,
    pub incognito: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entitlement {
    #[serde(rename = "TypeID")]
    pub type_id: String,
    #[serde(rename = "ItemID")]
    pub item_id: String,
    #[serde(rename = "InstanceID")]
    #[serde(default)]
    pub instance_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EntitlementsByType {
    #[serde(rename = "ItemTypeID")]
    pub item_type_id: String,
    #[serde(rename = "Entitlements")]
    pub entitlements: Vec<Entitlement>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EntitlementsResponse {
    #[serde(rename = "EntitlementsByTypes")]
    pub entitlements_by_types: Vec<EntitlementsByType>,
}

pub type RegionShardCache = Arc<RwLock<HashMap<String, (Region, Shard)>>>;

const USER_CACHE_TTL: std::time::Duration = std::time::Duration::from_secs(55 * 60);

pub type UserDataCache = Arc<RwLock<Option<(UserData, std::time::Instant)>>>;

fn get_player_data_service_url(region: &Region) -> String {
    format!("https://pd.{}.a.pvp.net", region.as_str())
}

pub fn create_client_platform_header() -> String {
    let platform_info = serde_json::json!({
        "platformType": "PC",
        "platformOS": "Windows",
        "platformOSVersion": "10.0.19042.1.256.64bit",
        "platformChipset": "Unknown"
    });
    general_purpose::STANDARD.encode(platform_info.to_string())
}

fn create_http_client() -> Result<Client, reqwest::Error> {
    Client::builder()
        .use_rustls_tls()
        .min_tls_version(reqwest::tls::Version::TLS_1_2)
        .build()
}

fn create_local_http_client() -> Result<Client, reqwest::Error> {
    Client::builder()
        .danger_accept_invalid_certs(true)
        .use_rustls_tls()
        .build()
}

pub async fn get_lockfile() -> Result<Option<Lockfile>, String> {
    let local_appdata = std::env::var("LOCALAPPDATA").map_err(|_| "LOCALAPPDATA not set")?;

    let lockfile_path = std::path::Path::new(&local_appdata)
        .join("Riot Games")
        .join("Riot Client")
        .join("Config")
        .join("lockfile");

    if !lockfile_path.exists() {
        return Ok(None);
    }

    let content = tokio::fs::read_to_string(&lockfile_path)
        .await
        .map_err(|e| e.to_string())?;

    let parts: Vec<&str> = content.split(':').collect();
    if parts.len() < 4 {
        return Err("Invalid lockfile format".to_string());
    }

    Ok(Some(Lockfile {
        port: parts[2].to_string(),
        password: parts[3].to_string(),
    }))
}

pub async fn get_riot_client_version() -> Result<String, String> {
    let client = reqwest::Client::new();

    #[derive(Deserialize)]
    struct VersionData {
        data: RiotClientVersionData,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct RiotClientVersionData {
        riot_client_version: String,
    }

    let url = "https://valorant-api.com/v1/version";
    println!("[API] GET {}", url);

    let response = client.get(url).send().await.map_err(|e| {
        eprintln!("[API] get_riot_client_version request failed: {}", e);
        e.to_string()
    })?;

    let version_data: VersionData =
        parse_json_response(response, "get_riot_client_version").await?;
    println!(
        "[API] Got riot client version: {}",
        version_data.data.riot_client_version
    );
    Ok(version_data.data.riot_client_version)
}

#[derive(Deserialize)]
struct LocalTokenResponse {
    #[serde(rename = "accessToken")]
    access_token: String,
    token: String,
    subject: String,
}

#[derive(Deserialize)]
struct PlayerResponse {
    #[serde(rename = "DisplayName")]
    display_name: String,
    #[serde(rename = "GameName")]
    game_name: String,
    #[serde(rename = "TagLine")]
    tag_line: String,
}

#[derive(Deserialize)]
struct IdTokenResponse {
    token: String,
}

#[derive(Deserialize)]
struct RiotGeoResponse {
    affinities: RiotGeoAffinities,
}

#[derive(Deserialize)]
struct RiotGeoAffinities {
    live: String,
}

async fn get_id_token(lockfile: &Lockfile) -> Result<String, String> {
    let client = create_local_http_client().map_err(|e| e.to_string())?;
    let auth = format!("riot:{}", lockfile.password);
    let auth_header = format!("Basic {}", general_purpose::STANDARD.encode(&auth));

    let url = format!(
        "https://127.0.0.1:{}/rso-auth/v1/authorization/id-token",
        lockfile.port
    );
    println!("[API] GET {}", url);

    let response = client
        .get(&url)
        .header("Authorization", auth_header)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[API] get_id_token request failed: {}", e);
            format!("get_id_token request failed: {}", e)
        })?;

    let token_response: IdTokenResponse =
        parse_json_response(response, "get_id_token").await?;
    Ok(token_response.token)
}

async fn detect_region_shard(
    user_id: &str,
    access_token: &str,
    id_token: &str,
    cache: &RegionShardCache,
) -> Result<Option<(Region, Shard)>, String> {
    {
        let cache_lock = cache.read().await;
        if let Some(cached) = cache_lock.get(user_id) {
            println!(
                "[API] Region/shard cache hit for {}: {:?}/{:?}",
                user_id, cached.0, cached.1
            );
            return Ok(Some(cached.clone()));
        }
    }

    println!("[API] Detecting region via Riot Geo for user {}...", user_id);

    let client = create_http_client().map_err(|e| e.to_string())?;

    let url = "https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant";
    println!("[API] PUT {}", url);

    let response = client
        .put(url)
        .header("Authorization", format!("Bearer {}", access_token))
        .json(&serde_json::json!({ "id_token": id_token }))
        .send()
        .await
        .map_err(|e| {
            eprintln!("[API] Riot Geo request failed: {}", e);
            format!("Riot Geo request failed: {}", e)
        })?;

    let geo: RiotGeoResponse = parse_json_response(response, "riot_geo").await?;

    println!("[API] Riot Geo affinity: live={}", geo.affinities.live);

    let result = match geo.affinities.live.as_str() {
        "na" => (Region::NA, Shard::NA),
        "eu" => (Region::EU, Shard::EU),
        "ap" => (Region::AP, Shard::AP),
        "kr" => (Region::KO, Shard::KR),
        "latam" => (Region::LATAM, Shard::NA),
        "br" => (Region::BR, Shard::NA),
        other => return Err(format!("Unknown region affinity: {}", other)),
    };

    println!("[API] Mapped to region {:?}, shard {:?}", result.0, result.1);

    let mut cache_lock = cache.write().await;
    cache_lock.insert(user_id.to_string(), result.clone());

    Ok(Some(result))
}

async fn get_player_info(
    user_id: &str,
    access_token: &str,
    entitlements_token: &str,
    riot_client_version: &str,
    region: &Region,
) -> Result<PlayerInfo, String> {
    let client = create_http_client().map_err(|e| e.to_string())?;

    let url = format!(
        "{}/name-service/v2/players",
        get_player_data_service_url(region)
    );

    println!("[API] PUT {} (get_player_info)", url);

    let response = client
        .put(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", entitlements_token)
        .header("X-Riot-ClientVersion", riot_client_version)
        .header("X-Riot-ClientPlatform", create_client_platform_header())
        .json(&vec![user_id])
        .send()
        .await
        .map_err(|e| {
            eprintln!("[API] get_player_info request failed: {}", e);
            e.to_string()
        })?;

    let players: Vec<PlayerResponse> = parse_json_response(response, "get_player_info").await?;

    let player = players.into_iter().next().ok_or_else(|| {
        eprintln!("[API] get_player_info returned empty array");
        "No player data returned".to_string()
    })?;

    println!(
        "[API] Got player info: {}#{}",
        player.game_name, player.tag_line
    );

    Ok(PlayerInfo {
        display_name: player.display_name,
        game_name: player.game_name,
        tag_line: player.tag_line,
    })
}

pub async fn invalidate_user_cache(user_cache: &UserDataCache) {
    let mut cached = user_cache.write().await;
    *cached = None;
}

pub async fn get_user(
    region_cache: &RegionShardCache,
    user_cache: &UserDataCache,
) -> Result<Option<UserData>, String> {
    {
        let cached = user_cache.read().await;
        if let Some((ref data, ref cached_at)) = *cached {
            if cached_at.elapsed() < USER_CACHE_TTL {
                println!("[API] get_user: cache hit for {}#{} (age: {:?})", data.player_info.game_name, data.player_info.tag_line, cached_at.elapsed());
                return Ok(Some(data.clone()));
            }
            println!("[API] get_user: cache expired for {}#{} (age: {:?})", data.player_info.game_name, data.player_info.tag_line, cached_at.elapsed());
        }
    }

    let total_start = std::time::Instant::now();
    println!("[API] get_user: cache miss, fetching...");

    let t = std::time::Instant::now();
    let lockfile = match get_lockfile().await? {
        Some(lf) => {
            println!("[API] get_user: Found lockfile on port {} ({:?})", lf.port, t.elapsed());
            lf
        }
        None => {
            println!("[API] get_user: No lockfile found ({:?})", t.elapsed());
            return Ok(None);
        }
    };

    let t = std::time::Instant::now();
    let riot_client_version = get_riot_client_version().await?;
    println!("[API] get_user: got riot_client_version ({:?})", t.elapsed());

    let client = create_local_http_client().map_err(|e| e.to_string())?;

    let auth = format!("riot:{}", lockfile.password);
    let auth_header = format!("Basic {}", general_purpose::STANDARD.encode(&auth));

    let url = format!("https://127.0.0.1:{}/entitlements/v1/token", lockfile.port);

    let t = std::time::Instant::now();
    let response = match client
        .get(&url)
        .header("Authorization", auth_header)
        .send()
        .await
    {
        Ok(resp) => resp,
        Err(e) => {
            eprintln!("[API] get_user local token request failed: {}", e);
            return Ok(None);
        }
    };

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        println!("[API] get_user: local token endpoint returned 404 (Valorant not running)");
        return Ok(None);
    }

    let tokens: LocalTokenResponse =
        parse_json_response(response, "get_user (local token)").await?;
    println!("[API] get_user: Got tokens for user {} ({:?})", tokens.subject, t.elapsed());

    let t = std::time::Instant::now();
    let id_token = get_id_token(&lockfile).await?;
    println!("[API] get_user: got id_token ({:?})", t.elapsed());

    let t = std::time::Instant::now();
    let region_shard = match detect_region_shard(
        &tokens.subject,
        &tokens.access_token,
        &id_token,
        region_cache,
    )
    .await?
    {
        Some(rs) => {
            println!("[API] get_user: detect_region_shard ({:?})", t.elapsed());
            rs
        }
        None => {
            println!("[API] get_user: Could not detect region/shard ({:?})", t.elapsed());
            return Ok(None);
        }
    };

    let t = std::time::Instant::now();
    let player_info = get_player_info(
        &tokens.subject,
        &tokens.access_token,
        &tokens.token,
        &riot_client_version,
        &region_shard.0,
    )
    .await?;
    println!("[API] get_user: get_player_info ({:?})", t.elapsed());

    let user_data = UserData {
        access_token: tokens.access_token,
        entitlements_token: tokens.token,
        user_id: tokens.subject,
        region: region_shard.0,
        shard: region_shard.1,
        riot_client_version,
        player_info,
    };

    println!(
        "[API] get_user: TOTAL {:?} for {}#{}",
        total_start.elapsed(), user_data.player_info.game_name, user_data.player_info.tag_line
    );

    {
        let mut cached = user_cache.write().await;
        *cached = Some((user_data.clone(), std::time::Instant::now()));
    }

    Ok(Some(user_data))
}

pub async fn get_loadout(user: &UserData) -> Result<ValorantLoadout, String> {
    let client = create_http_client().map_err(|e| e.to_string())?;

    let url = format!(
        "{}/personalization/v3/players/{}/playerloadout",
        get_player_data_service_url(&user.region),
        user.user_id
    );

    println!("[API] GET {} (get_loadout)", url);

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", user.access_token))
        .header("X-Riot-Entitlements-JWT", &user.entitlements_token)
        .header("X-Riot-ClientVersion", &user.riot_client_version)
        .header("X-Riot-ClientPlatform", create_client_platform_header())
        .send()
        .await
        .map_err(|e| {
            eprintln!("[API] get_loadout request failed: {}", e);
            e.to_string()
        })?;

    let loadout: ValorantLoadout = parse_json_response(response, "get_loadout").await?;
    println!(
        "[API] get_loadout: Got loadout with {} guns",
        loadout.guns.len()
    );
    Ok(loadout)
}

pub async fn get_entitlements(user: &UserData) -> Result<EntitlementsResponse, String> {
    let client = create_http_client().map_err(|e| e.to_string())?;

    let url = format!(
        "{}/store/v1/entitlements/{}",
        get_player_data_service_url(&user.region),
        user.user_id
    );

    println!("[API] GET {} (get_entitlements)", url);

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", user.access_token))
        .header("X-Riot-Entitlements-JWT", &user.entitlements_token)
        .header("X-Riot-ClientVersion", &user.riot_client_version)
        .header("X-Riot-ClientPlatform", create_client_platform_header())
        .send()
        .await
        .map_err(|e| {
            eprintln!("[API] get_entitlements request failed: {}", e);
            e.to_string()
        })?;

    let entitlements: EntitlementsResponse =
        parse_json_response(response, "get_entitlements").await?;

    let total_items: usize = entitlements
        .entitlements_by_types
        .iter()
        .map(|t| t.entitlements.len())
        .sum();
    println!(
        "[API] get_entitlements: Got {} types with {} total items",
        entitlements.entitlements_by_types.len(),
        total_items
    );

    Ok(entitlements)
}

pub async fn equip_loadout(user: &UserData, loadout: ValorantLoadout) -> Result<(), String> {
    let client = create_http_client().map_err(|e| e.to_string())?;

    let url = format!(
        "{}/personalization/v3/players/{}/playerloadout",
        get_player_data_service_url(&user.region),
        user.user_id
    );

    println!("[API] PUT {} (equip_loadout)", url);

    let request_body = serde_json::to_string(&loadout).unwrap_or_else(|e| {
        eprintln!("[API] equip_loadout: Failed to serialize loadout: {}", e);
        "{}".to_string()
    });
    println!(
        "[API] equip_loadout request body: {}",
        log_response_preview(&request_body, 500)
    );

    let response = client
        .put(&url)
        .header("Authorization", format!("Bearer {}", user.access_token))
        .header("X-Riot-Entitlements-JWT", &user.entitlements_token)
        .header("X-Riot-ClientVersion", &user.riot_client_version)
        .header("X-Riot-ClientPlatform", create_client_platform_header())
        .json(&loadout)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[API] equip_loadout request failed: {}", e);
            e.to_string()
        })?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();

    println!(
        "[API] equip_loadout response ({}): {}",
        status,
        log_response_preview(&body, 500)
    );

    if !status.is_success() {
        eprintln!("[API] equip_loadout failed ({}): {}", status, body);
        return Err(format!(
            "Failed to equip loadout ({}): {}",
            status,
            log_response_preview(&body, 200)
        ));
    }

    println!("[API] equip_loadout: Success!");
    Ok(())
}
