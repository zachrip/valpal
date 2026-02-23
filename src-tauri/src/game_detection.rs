use crate::config::{self, Loadout};
use crate::valorant::{self, EntitlementsResponse, RegionShardCache, UserData, UserDataCache, ValorantLoadout};
use base64::{engine::general_purpose, Engine as _};
use futures_util::{SinkExt, StreamExt};
use rand::prelude::IndexedRandom;
use serde::Deserialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::AsyncWriteExt;
use tokio::sync::{Mutex, RwLock};
use tokio_tungstenite::{connect_async_tls_with_config, Connector};

#[derive(Debug, Clone, Default)]
pub struct ShuffleSettings {
    pub auto_shuffle_enabled: Arc<AtomicBool>,
    pub agent_detection_enabled: Arc<AtomicBool>,
    pub non_pregame_shuffle_enabled: Arc<AtomicBool>,
}

impl ShuffleSettings {
    pub fn new() -> Self {
        Self {
            auto_shuffle_enabled: Arc::new(AtomicBool::new(true)),
            agent_detection_enabled: Arc::new(AtomicBool::new(true)),
            non_pregame_shuffle_enabled: Arc::new(AtomicBool::new(true)),
        }
    }

    pub fn is_auto_shuffle_enabled(&self) -> bool {
        self.auto_shuffle_enabled.load(Ordering::SeqCst)
    }

    pub fn is_agent_detection_enabled(&self) -> bool {
        self.agent_detection_enabled.load(Ordering::SeqCst)
    }

    pub fn is_non_pregame_shuffle_enabled(&self) -> bool {
        self.non_pregame_shuffle_enabled.load(Ordering::SeqCst)
    }

    pub fn set_auto_shuffle_enabled(&self, enabled: bool) {
        self.auto_shuffle_enabled.store(enabled, Ordering::SeqCst);
    }

    pub fn set_agent_detection_enabled(&self, enabled: bool) {
        self.agent_detection_enabled.store(enabled, Ordering::SeqCst);
    }

    pub fn set_non_pregame_shuffle_enabled(&self, enabled: bool) {
        self.non_pregame_shuffle_enabled.store(enabled, Ordering::SeqCst);
    }
}

#[derive(Debug, Deserialize)]
struct PartyResponse {
    #[serde(rename = "ID")]
    id: String,
    #[serde(rename = "State")]
    state: String,
    #[serde(rename = "Members")]
    members: Vec<PartyMember>,
    #[serde(rename = "MatchmakingData")]
    matchmaking_data: MatchmakingData,
    #[serde(rename = "QueueEntryTime")]
    queue_entry_time: String,
}

#[derive(Debug, Deserialize)]
struct PartyMember {
    #[serde(rename = "Subject")]
    subject: String,
    #[serde(rename = "IsReady")]
    is_ready: bool,
    #[serde(rename = "IsOwner")]
    is_owner: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct MatchmakingData {
    #[serde(rename = "QueueID")]
    queue_id: String,
}

#[derive(Debug, Deserialize)]
struct PregameMatchResponse {
    #[serde(rename = "AllyTeam")]
    ally_team: AllyTeam,
}

#[derive(Debug, Deserialize)]
struct AllyTeam {
    #[serde(rename = "Players")]
    players: Vec<Player>,
}

#[derive(Debug, Deserialize)]
struct Player {
    #[serde(rename = "Subject")]
    subject: String,
    #[serde(rename = "CharacterID")]
    character_id: String,
    #[serde(rename = "CharacterSelectionState")]
    character_selection_state: String,
}

// Queue IDs for modes with SkipPregame/AssignRandomAgents:
//   deathmatch    = Deathmatch
//   ggteam        = Escalation
//   snowball      = Snowball Fight
//   hurm          = Team Deathmatch
//   valaram       = All Random One Site (AROS)
//   skirmish2v2   = Skirmish
//
// Full queue ID mapping:
//   competitive   = Competitive
//   unrated       = Unrated
//   swiftplay     = Swiftplay
//   spikerush     = Spike Rush
//   onefa         = Replication
//   newmap        = New Map
//   custom        = Custom
const NON_PREGAME_QUEUES: &[&str] = &[
    "deathmatch",
    "ggteam",
    "snowball",
    "hurm",
    "valaram",
    "skirmish2v2",
];

pub struct GameDetector {
    region_cache: RegionShardCache,
    user_cache: UserDataCache,
    settings: ShuffleSettings,
    config_dir: PathBuf,
    match_states: Arc<RwLock<HashMap<String, String>>>,
    party_states: Arc<RwLock<HashMap<String, String>>>,
    app_handle: tauri::AppHandle,
    connected: Arc<AtomicBool>,
    ws_log: Arc<Mutex<Option<tokio::fs::File>>>,
}

impl GameDetector {
    pub fn new(
        region_cache: RegionShardCache,
        user_cache: UserDataCache,
        settings: ShuffleSettings,
        config_dir: PathBuf,
        app_handle: tauri::AppHandle,
        connected: Arc<AtomicBool>,
    ) -> Self {
        Self {
            region_cache,
            user_cache,
            settings,
            config_dir,
            match_states: Arc::new(RwLock::new(HashMap::new())),
            party_states: Arc::new(RwLock::new(HashMap::new())),
            app_handle,
            connected,
            ws_log: Arc::new(Mutex::new(None)),
        }
    }

    fn set_connected(&self, status: bool) {
        let prev = self.connected.swap(status, Ordering::SeqCst);
        if prev != status {
            let _ = self.app_handle.emit("valorant-status", status);
        }
    }

    async fn log(&self, msg: &str) {
        println!("{}", msg);
        self.log_to_file(msg).await;
    }

    async fn log_to_file(&self, msg: &str) {
        let mut guard = self.ws_log.lock().await;
        if let Some(file) = guard.as_mut() {
            let timestamp = chrono::Local::now().format("%H:%M:%S%.3f");
            let line = format!("[{}] {}\n", timestamp, msg);
            let _ = file.write_all(line.as_bytes()).await;
            let _ = file.flush().await;
        }
    }

    pub async fn run(&self) {
        self.log("[GameDetector] Starting game detection loop...").await;
        loop {
            self.log("[GameDetector] Attempting to connect to Riot Client...").await;
            match self.connect_and_listen().await {
                Ok(()) => {
                    self.log("[GameDetector] Connection closed normally").await;
                }
                Err(e) => {
                    self.log(&format!("[GameDetector] Error: {}", e)).await;
                }
            }
            self.set_connected(false);
            self.log("[GameDetector] Will retry in 5 seconds...").await;
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        }
    }

    async fn connect_and_listen(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        {
            let log_path = self.config_dir.join("debug.log");
            match tokio::fs::File::create(&log_path).await {
                Ok(file) => {
                    *self.ws_log.lock().await = Some(file);
                    self.log(&format!("[GameDetector] Opened log: {}", log_path.display())).await;
                }
                Err(e) => {
                    eprintln!("[GameDetector] Failed to create log: {}", e);
                }
            }
        }

        let lockfile = match valorant::get_lockfile().await? {
            Some(lf) => {
                self.log(&format!("[GameDetector] Found lockfile: port={}", lf.port)).await;
                lf
            }
            None => {
                return Err("Lockfile not found (Riot Client not running?)".into());
            }
        };

        let url = format!("wss://127.0.0.1:{}/", lockfile.port);

        let auth = format!("riot:{}", lockfile.password);
        let auth_header = format!("Basic {}", general_purpose::STANDARD.encode(&auth));

        let connector = Connector::Rustls(Arc::new(
            rustls::ClientConfig::builder()
                .dangerous()
                .with_custom_certificate_verifier(Arc::new(NoVerifier))
                .with_no_client_auth(),
        ));

        let request = http::Request::builder()
            .uri(&url)
            .header("Authorization", auth_header)
            .header("Host", format!("127.0.0.1:{}", lockfile.port))
            .header("Upgrade", "websocket")
            .header("Connection", "Upgrade")
            .header(
                "Sec-WebSocket-Key",
                tokio_tungstenite::tungstenite::handshake::client::generate_key(),
            )
            .header("Sec-WebSocket-Version", "13")
            .body(())
            .map_err(|e| format!("Failed to build request: {}", e))?;

        let (ws_stream, _) = connect_async_tls_with_config(request, None, false, Some(connector))
            .await
            .map_err(|e| format!("Failed to connect to Riot WebSocket: {}", e))?;

        self.log(&format!("[GameDetector] Connected to Riot Client WebSocket on port {}", lockfile.port)).await;

        {
            let mut cached = self.user_cache.write().await;
            *cached = None;
            self.log("[GameDetector] Cleared user cache on new connection").await;
        }

        self.set_connected(true);

        let (mut write, mut read) = ws_stream.split();

        self.log("[GameDetector] Subscribing to OnJsonApiEvent...").await;
        write
            .send(tokio_tungstenite::tungstenite::Message::Text(
                r#"[5, "OnJsonApiEvent"]"#.to_string().into(),
            ))
            .await?;
        self.log("[GameDetector] Subscription sent, waiting for events...").await;

        while let Some(msg) = read.next().await {
            match msg {
                Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                    if text.is_empty() {
                        continue;
                    }

                    self.log_to_file(&format!("[WS] {}", text)).await;

                    let preview = if text.len() > 200 {
                        format!("{}... ({} bytes total)", &text[..200], text.len())
                    } else {
                        text.to_string()
                    };
                    self.log(&format!("[GameDetector] Received message: {}", preview)).await;

                    if let Err(e) = self.handle_riot_message(&text).await {
                        self.log(&format!("[GameDetector] Error handling message: {}", e)).await;
                    }
                }
                Ok(tokio_tungstenite::tungstenite::Message::Close(frame)) => {
                    self.log(&format!("[GameDetector] WebSocket closed: {:?}", frame)).await;
                    break;
                }
                Err(e) => {
                    self.log(&format!("[GameDetector] WebSocket error: {}", e)).await;
                    break;
                }
                _ => {}
            }
        }

        self.log("[GameDetector] WebSocket loop ended").await;

        Ok(())
    }

    async fn handle_riot_message(
        &self,
        text: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let parsed: serde_json::Value = serde_json::from_str(text)?;

        let arr = match parsed.as_array() {
            Some(a) => a,
            None => return Ok(()),
        };

        if arr.len() < 3 {
            return Ok(());
        }

        let msg_type = arr[0].as_u64().unwrap_or(0);
        let event = arr[1].as_str().unwrap_or("");

        if msg_type != 8 || event != "OnJsonApiEvent" {
            return Ok(());
        }

        let payload = &arr[2];
        let uri = payload["uri"].as_str().unwrap_or("");
        let event_type = payload["eventType"].as_str().unwrap_or("");

        self.log(&format!("[GameDetector] Event: uri={}, type={}", uri, event_type)).await;

        if let Some(party_id) = uri
            .strip_prefix("/riot-messaging-service/v1/message/ares-parties/parties/v1/parties/")
        {
            if event_type == "Create" {
                self.handle_party_event(party_id).await;
            }
            return Ok(());
        }

        let match_id = if let Some(caps) = uri.strip_prefix("/pregame/v1/matches/") {
            caps.to_string()
        } else {
            return Ok(());
        };

        self.log(&format!("[GameDetector] Pregame event: match_id={}, event_type={}", match_id, event_type)).await;

        if event_type != "Create" {
            self.log(&format!("[GameDetector] Ignoring non-Create event type: '{}'", event_type)).await;
            return Ok(());
        }

        self.log(&format!("[GameDetector] Pregame match found: {}", match_id)).await;

        {
            let states = self.match_states.read().await;
            self.log(&format!("[GameDetector] Current tracked match states: {:?}", states.keys().collect::<Vec<_>>())).await;
            if states.get(&match_id) == Some(&"locked".to_string()) {
                self.log(&format!("[GameDetector] Match {} already locked, skipping", match_id)).await;
                return Ok(());
            }
        }

        self.log("[GameDetector] Fetching user data...").await;
        let mut user = match valorant::get_user(&self.region_cache, &self.user_cache).await? {
            Some(u) => {
                self.log(&format!("[GameDetector] Got user: id={}, region={:?}, shard={:?}", u.user_id, u.region, u.shard)).await;
                u
            }
            None => {
                self.log("[GameDetector] No user data available, aborting").await;
                return Ok(());
            }
        };

        self.log("[GameDetector] Fetching pregame data...").await;
        let pregame = match self.get_pregame(&user).await {
            Ok(p) => {
                self.log("[GameDetector] Pregame data retrieved successfully").await;
                p
            }
            Err(e) if e.contains("BAD_CLAIMS") => {
                self.log("[GameDetector] Token expired during pregame, refreshing...").await;
                valorant::invalidate_user_cache(&self.user_cache).await;
                user = match valorant::get_user(&self.region_cache, &self.user_cache).await? {
                    Some(u) => {
                        self.log(&format!("[GameDetector] Refreshed user: id={}", u.user_id)).await;
                        u
                    }
                    None => {
                        self.log("[GameDetector] No user data after refresh, aborting").await;
                        return Ok(());
                    }
                };
                match self.get_pregame(&user).await {
                    Ok(p) => {
                        self.log("[GameDetector] Pregame data retrieved after token refresh").await;
                        p
                    }
                    Err(e) => {
                        self.log(&format!("[GameDetector] Failed to get pregame after refresh: {}", e)).await;
                        return Err(e.into());
                    }
                }
            }
            Err(e) => {
                self.log(&format!("[GameDetector] Failed to get pregame: {}", e)).await;
                return Err(e.into());
            }
        };

        self.log(&format!("[GameDetector] Pregame ally team has {} players", pregame.ally_team.players.len())).await;
        for p in &pregame.ally_team.players {
            self.log(&format!("[GameDetector]   Player: subject={}, character={}, state={}", p.subject, p.character_id, p.character_selection_state)).await;
        }

        let player = pregame
            .ally_team
            .players
            .iter()
            .find(|p| p.subject == user.user_id);

        if let Some(player) = player {
            self.log(&format!("[GameDetector] Found our player: character={}, state={}", player.character_id, player.character_selection_state)).await;

            let new_state = &player.character_selection_state;
            let mut states = self.match_states.write().await;
            let old_state = states.get(&match_id).cloned();

            self.log(&format!("[GameDetector] State comparison: old={:?}, new={}", old_state, new_state)).await;

            if old_state.as_deref() != Some(new_state) {
                self.log("[GameDetector] State changed! Evaluating actions...").await;

                let auto_shuffle = self.settings.is_auto_shuffle_enabled();
                let agent_detection = self.settings.is_agent_detection_enabled();
                self.log(&format!("[GameDetector] Settings: auto_shuffle={}, agent_detection={}", auto_shuffle, agent_detection)).await;

                if new_state == "locked" && auto_shuffle {
                    self.log("[GameDetector] Agent locked and auto-shuffle enabled, triggering loadout equip").await;

                    let agent_id = if agent_detection {
                        self.log(&format!("[GameDetector] Agent detection enabled, using agent_id={}", player.character_id)).await;
                        Some(player.character_id.clone())
                    } else {
                        self.log("[GameDetector] Agent detection disabled, no agent filter").await;
                        None
                    };

                    match self.equip_random_loadout(&user, agent_id.as_deref()).await {
                        Ok(()) => self.log("[GameDetector] Loadout equip completed successfully").await,
                        Err(e) => self.log(&format!("[GameDetector] Failed to equip loadout: {}", e)).await,
                    }
                } else if new_state != "locked" {
                    self.log(&format!("[GameDetector] State is '{}', not 'locked' — skipping loadout equip", new_state)).await;
                } else {
                    self.log("[GameDetector] Auto-shuffle is disabled, skipping loadout equip").await;
                }

                states.insert(match_id.clone(), new_state.clone());
                self.log(&format!("[GameDetector] Updated match {} state to '{}'", match_id, new_state)).await;
            } else {
                self.log(&format!("[GameDetector] State unchanged ({}), no action needed", new_state)).await;
            }
        } else {
            self.log(&format!("[GameDetector] Our player (id={}) not found in pregame ally team", user.user_id)).await;
        }

        Ok(())
    }

    async fn handle_party_event(&self, party_id: &str) {
        self.log(&format!("[GameDetector] Party event detected: party_id={}", party_id)).await;

        let user = match valorant::get_user(&self.region_cache, &self.user_cache).await {
            Ok(Some(u)) => u,
            Ok(None) => {
                self.log("[GameDetector] No user data for party lookup").await;
                return;
            }
            Err(e) => {
                self.log(&format!("[GameDetector] Failed to get user for party lookup: {}", e)).await;
                return;
            }
        };

        let party = match self.get_party(&user, party_id).await {
            Ok(p) => p,
            Err(e) => {
                self.log(&format!("[GameDetector] Failed to get party {}: {}", party_id, e)).await;
                return;
            }
        };

        self.log("[GameDetector] === Party State ===").await;
        self.log(&format!("[GameDetector]   Party ID: {}", party.id)).await;
        self.log(&format!("[GameDetector]   State: {}", party.state)).await;
        self.log(&format!("[GameDetector]   Queue ID: {}", party.matchmaking_data.queue_id)).await;
        self.log(&format!("[GameDetector]   Queue Entry Time: {}", party.queue_entry_time)).await;
        self.log(&format!("[GameDetector]   Members: {}", party.members.len())).await;
        for member in &party.members {
            self.log(&format!("[GameDetector]     - {} (ready={}, owner={})", member.subject, member.is_ready, member.is_owner.unwrap_or(false))).await;
        }
        self.log("[GameDetector] ===================").await;

        let party_key = format!("{}:{}", party_id, party.queue_entry_time);
        let mut states = self.party_states.write().await;
        let old_state = states.get(&party_key).cloned();

        self.log(&format!("[GameDetector] Party key={}, old_state={:?}, new_state={}", party_key, old_state, party.state)).await;

        if old_state.as_deref() == Some(&party.state) {
            return;
        }

        states.insert(party_key, party.state.clone());
        drop(states);

        if party.state != "MATCHMAKING" {
            return;
        }

        let queue_id = party.matchmaking_data.queue_id.to_lowercase();
        let is_non_pregame = NON_PREGAME_QUEUES.iter().any(|q| queue_id == *q);

        if !is_non_pregame {
            self.log(&format!("[GameDetector] Queue '{}' has pregame, skipping non-pregame shuffle", queue_id)).await;
            return;
        }

        let auto_shuffle = self.settings.is_auto_shuffle_enabled();
        let non_pregame = self.settings.is_non_pregame_shuffle_enabled();
        self.log(&format!("[GameDetector] Non-pregame queue detected: auto_shuffle={}, non_pregame_shuffle={}", auto_shuffle, non_pregame)).await;

        if !auto_shuffle || !non_pregame {
            self.log("[GameDetector] Shuffle disabled for non-pregame modes, skipping").await;
            return;
        }

        self.log(&format!("[GameDetector] Triggering loadout equip for non-pregame queue '{}'", queue_id)).await;
        match self.equip_random_loadout(&user, None).await {
            Ok(()) => self.log("[GameDetector] Non-pregame loadout equip completed successfully").await,
            Err(e) => self.log(&format!("[GameDetector] Non-pregame loadout equip failed: {}", e)).await,
        }
    }

    async fn get_party(&self, user: &UserData, party_id: &str) -> Result<PartyResponse, String> {
        let client = reqwest::Client::builder()
            .use_rustls_tls()
            .build()
            .map_err(|e| e.to_string())?;

        let url = format!(
            "https://glz-{}-1.{}.a.pvp.net/parties/v1/parties/{}",
            user.region.as_str(),
            user.shard.as_str(),
            party_id
        );

        self.log(&format!("[GameDetector] GET {}", url)).await;

        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", user.access_token))
            .header("X-Riot-Entitlements-JWT", &user.entitlements_token)
            .header("X-Riot-ClientVersion", &user.riot_client_version)
            .header("X-Riot-ClientPlatform", valorant::create_client_platform_header())
            .send()
            .await
            .map_err(|e| format!("Party request failed: {}", e))?;

        let status = response.status();
        self.log(&format!("[GameDetector] Party endpoint responded: {}", status)).await;

        let body = response.text().await.unwrap_or_default();
        self.log(&format!("[GameDetector] Party response ({}): {}", status, body)).await;

        if !status.is_success() {
            return Err(format!("Party request failed ({}): {}", status, body));
        }

        let party: PartyResponse = serde_json::from_str(&body)
            .map_err(|e| format!("Failed to parse party response: {}", e))?;

        Ok(party)
    }

    async fn get_pregame(&self, user: &UserData) -> Result<PregameMatchResponse, String> {
        let client = reqwest::Client::builder()
            .use_rustls_tls()
            .build()
            .map_err(|e| e.to_string())?;

        let url = format!(
            "https://glz-{}-1.{}.a.pvp.net/pregame/v1/players/{}",
            user.region.as_str(),
            user.shard.as_str(),
            user.user_id
        );

        self.log(&format!("[GameDetector] GET {}", url)).await;

        #[derive(Deserialize)]
        struct PlayerResponse {
            #[serde(rename = "MatchID")]
            match_id: String,
        }

        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", user.access_token))
            .header("X-Riot-Entitlements-JWT", &user.entitlements_token)
            .header("X-Riot-ClientVersion", &user.riot_client_version)
            .header("X-Riot-ClientPlatform", valorant::create_client_platform_header())
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();
        self.log(&format!("[GameDetector] Player endpoint responded: {}", status)).await;
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Player request failed ({}): {}", status, body));
        }

        let player_response: PlayerResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse player response: {}", e))?;

        self.log(&format!("[GameDetector] Player response match_id: {}", player_response.match_id)).await;

        let match_url = format!(
            "https://glz-{}-1.{}.a.pvp.net/pregame/v1/matches/{}",
            user.region.as_str(),
            user.shard.as_str(),
            player_response.match_id
        );

        self.log(&format!("[GameDetector] GET {}", match_url)).await;

        let match_response_raw = client
            .get(&match_url)
            .header("Authorization", format!("Bearer {}", user.access_token))
            .header("X-Riot-Entitlements-JWT", &user.entitlements_token)
            .header("X-Riot-ClientVersion", &user.riot_client_version)
            .header("X-Riot-ClientPlatform", valorant::create_client_platform_header())
            .send()
            .await
            .map_err(|e| format!("Match request failed: {}", e))?;

        let match_status = match_response_raw.status();
        self.log(&format!("[GameDetector] Match endpoint responded: {}", match_status)).await;
        if !match_status.is_success() {
            let body = match_response_raw.text().await.unwrap_or_default();
            return Err(format!("Match request failed ({}): {}", match_status, body));
        }

        let match_response: PregameMatchResponse = match_response_raw
            .json()
            .await
            .map_err(|e| format!("Failed to parse match response: {}", e))?;

        self.log(&format!("[GameDetector] Pregame match parsed: {} players in ally team", match_response.ally_team.players.len())).await;

        Ok(match_response)
    }

    async fn equip_random_loadout(
        &self,
        user: &UserData,
        agent_id: Option<&str>,
    ) -> Result<(), String> {
        self.log(&format!("[GameDetector] equip_random_loadout called: user={}, agent_id={:?}", user.user_id, agent_id)).await;

        let user_config = config::get_user_config(&self.config_dir, &user.user_id).await?;

        self.log(&format!("[GameDetector] User config loaded: {} total loadouts", user_config.loadouts.len())).await;

        let enabled_loadouts: Vec<&Loadout> =
            user_config.loadouts.iter().filter(|l| l.enabled).collect();

        self.log(&format!("[GameDetector] Enabled loadouts: {} (names: [{}])", enabled_loadouts.len(), enabled_loadouts.iter().map(|l| l.name.as_str()).collect::<Vec<_>>().join(", "))).await;

        if enabled_loadouts.is_empty() {
            self.log("[GameDetector] No enabled loadouts, nothing to equip").await;
            return Ok(());
        }

        let loadouts_to_consider: Vec<&Loadout> = if let Some(agent) = agent_id {
            let agent_specific: Vec<&Loadout> = enabled_loadouts
                .iter()
                .filter(|l| l.agent_ids.contains(&agent.to_string()))
                .copied()
                .collect();

            self.log(&format!("[GameDetector] Agent filter '{}': {} agent-specific loadouts found (names: [{}])", agent, agent_specific.len(), agent_specific.iter().map(|l| l.name.as_str()).collect::<Vec<_>>().join(", "))).await;

            if agent_specific.is_empty() {
                self.log(&format!("[GameDetector] No agent-specific loadouts, falling back to all {} enabled loadouts", enabled_loadouts.len())).await;
                enabled_loadouts
            } else {
                agent_specific
            }
        } else {
            self.log(&format!("[GameDetector] No agent filter, using all {} enabled loadouts", enabled_loadouts.len())).await;
            enabled_loadouts
        };

        let loadout = {
            let mut rng = rand::rng();
            loadouts_to_consider.choose(&mut rng).cloned().cloned()
        };
        let loadout = match loadout {
            Some(l) => {
                self.log(&format!("[GameDetector] Randomly selected loadout: {} (id: {})", l.name, l.id)).await;
                l
            }
            None => return Ok(()),
        };

        self.log("[GameDetector] Fetching existing loadout and entitlements...").await;
        let (existing_loadout, entitlements) =
            tokio::join!(valorant::get_loadout(user), valorant::get_entitlements(user));

        let (existing_loadout, entitlements, user_refreshed) =
            match (&existing_loadout, &entitlements) {
                (Err(e), _) | (_, Err(e)) if e.contains("BAD_CLAIMS") => {
                    self.log("[GameDetector] Token expired in equip_random_loadout, refreshing...").await;
                    valorant::invalidate_user_cache(&self.user_cache).await;
                    let fresh_user =
                        match valorant::get_user(&self.region_cache, &self.user_cache).await? {
                            Some(u) => u,
                            None => return Err("No user after refresh".to_string()),
                        };
                    let (el, ent) = tokio::join!(
                        valorant::get_loadout(&fresh_user),
                        valorant::get_entitlements(&fresh_user)
                    );
                    (el?, ent?, Some(fresh_user))
                }
                _ => (existing_loadout?, entitlements?, None),
            };

        self.log("[GameDetector] Existing loadout and entitlements retrieved").await;

        let equip_user = user_refreshed.as_ref().unwrap_or(user);

        self.log(&format!("[GameDetector] Building valorant loadout from '{}'...", loadout.name)).await;
        let valorant_loadout =
            build_valorant_loadout(&loadout, &existing_loadout, &entitlements);

        self.log(&format!("[GameDetector] Built loadout: {} guns, {} expressions, card={}, title={}", valorant_loadout.guns.len(), valorant_loadout.active_expressions.len(), valorant_loadout.identity.player_card_id, valorant_loadout.identity.player_title_id)).await;

        self.log("[GameDetector] Sending equip request to Valorant API...").await;
        valorant::equip_loadout(equip_user, valorant_loadout).await?;

        self.log(&format!("[GameDetector] Loadout '{}' equipped successfully!", loadout.name)).await;

        Ok(())
    }
}

pub fn build_valorant_loadout(
    loadout: &Loadout,
    existing: &ValorantLoadout,
    entitlements: &EntitlementsResponse,
) -> ValorantLoadout {
    use rand::prelude::IndexedRandom;

    let mut rng = rand::rng();

    let buddy_type_id = "dd3bf334-87f3-40bd-b043-682a57a8dc3a";
    let spray_type_id = "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475";
    let flex_type_id = "03a572de-4234-31ed-d344-ababa488f981";

    let buddy_entitlements: HashMap<String, Vec<String>> = entitlements
        .entitlements_by_types
        .iter()
        .find(|e| e.item_type_id == buddy_type_id)
        .map(|e| {
            let mut map: HashMap<String, Vec<String>> = HashMap::new();
            for ent in &e.entitlements {
                if let Some(instance_id) = &ent.instance_id {
                    map.entry(ent.item_id.clone())
                        .or_default()
                        .push(instance_id.clone());
                }
            }
            map
        })
        .unwrap_or_default();

    let mut used_buddies: HashMap<String, usize> = HashMap::new();

    let guns: Vec<valorant::Gun> = loadout
        .weapons
        .iter()
        .map(|(weapon_id, config)| {
            if config.templates.is_empty() {
                if let Some(existing_gun) = existing.guns.iter().find(|g| g.id == *weapon_id) {
                    return valorant::Gun {
                        id: weapon_id.clone(),
                        skin_id: existing_gun.skin_id.clone(),
                        skin_level_id: existing_gun.skin_level_id.clone(),
                        chroma_id: existing_gun.chroma_id.clone(),
                        charm_instance_id: None,
                        charm_id: None,
                        charm_level_id: None,
                        attachments: vec![],
                    };
                }

                return valorant::Gun {
                    id: weapon_id.clone(),
                    skin_id: String::new(),
                    skin_level_id: String::new(),
                    chroma_id: String::new(),
                    charm_instance_id: None,
                    charm_id: None,
                    charm_level_id: None,
                    attachments: vec![],
                };
            }

            let template = config.templates.choose(&mut rng).unwrap();

            let chroma_id = template
                .chroma_ids
                .choose(&mut rng)
                .cloned()
                .unwrap_or_default();
            let level_id = template
                .level_ids
                .choose(&mut rng)
                .cloned()
                .unwrap_or_default();

            let buddy_data = if !template.buddies.is_empty() {
                if let Some(buddy) = template.buddies.choose(&mut rng) {
                    if let Some(level_id) = buddy.level_ids.choose(&mut rng) {
                        let used_count = used_buddies.entry(level_id.clone()).or_insert(0);
                        if let Some(instances) = buddy_entitlements.get(level_id) {
                            if *used_count < instances.len() {
                                let instance = instances[*used_count].clone();
                                *used_count += 1;
                                Some((instance, buddy.id.clone(), level_id.clone()))
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            };

            valorant::Gun {
                id: weapon_id.clone(),
                skin_id: template.skin_id.clone(),
                skin_level_id: level_id,
                chroma_id,
                charm_instance_id: buddy_data.as_ref().map(|(i, _, _)| i.clone()),
                charm_id: buddy_data.as_ref().map(|(_, c, _)| c.clone()),
                charm_level_id: buddy_data.map(|(_, _, l)| l),
                attachments: vec![],
            }
        })
        .collect();

    let mut build_expression =
        |slot: &config::ExpressionSlot, default_spray: &str, default_flex: &str| {
            let options: Vec<valorant::ActiveExpression> = slot
                .spray_ids
                .iter()
                .map(|id| valorant::ActiveExpression {
                    type_id: spray_type_id.to_string(),
                    asset_id: id.clone(),
                })
                .chain(slot.flex_ids.iter().map(|id| valorant::ActiveExpression {
                    type_id: flex_type_id.to_string(),
                    asset_id: id.clone(),
                }))
                .collect();

            if options.is_empty() {
                if !default_spray.is_empty() {
                    valorant::ActiveExpression {
                        type_id: spray_type_id.to_string(),
                        asset_id: default_spray.to_string(),
                    }
                } else {
                    valorant::ActiveExpression {
                        type_id: flex_type_id.to_string(),
                        asset_id: default_flex.to_string(),
                    }
                }
            } else {
                options.choose(&mut rng).unwrap().clone()
            }
        };

    let default_spray = "0a6db78c-48b9-a32d-c47a-82be597584c1";
    let default_flex = "af52b5a0-4a4c-03b2-c9d7-8187a08a2675";

    let active_expressions = vec![
        build_expression(&loadout.expression_ids.top, default_spray, ""),
        build_expression(&loadout.expression_ids.right, default_spray, ""),
        build_expression(&loadout.expression_ids.bottom, default_spray, ""),
        build_expression(&loadout.expression_ids.left, "", default_flex),
    ];

    let player_card_id = loadout
        .player_card_ids
        .choose(&mut rng)
        .cloned()
        .unwrap_or_else(|| "9fb348bc-41a0-91ad-8a3e-818035c4e561".to_string());

    let player_title_id = loadout
        .player_title_ids
        .choose(&mut rng)
        .cloned()
        .unwrap_or_else(|| existing.identity.player_title_id.clone());

    ValorantLoadout {
        subject: existing.subject.clone(),
        version: existing.version,
        guns,
        active_expressions,
        identity: valorant::Identity {
            player_card_id,
            player_title_id,
            account_level: existing.identity.account_level,
            preferred_level_border_id: existing.identity.preferred_level_border_id.clone(),
            hide_account_level: existing.identity.hide_account_level,
        },
        incognito: existing.incognito,
    }
}

#[derive(Debug)]
struct NoVerifier;

impl rustls::client::danger::ServerCertVerifier for NoVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[rustls::pki_types::CertificateDer<'_>],
        _server_name: &rustls::pki_types::ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        vec![
            rustls::SignatureScheme::RSA_PKCS1_SHA256,
            rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
            rustls::SignatureScheme::RSA_PKCS1_SHA384,
            rustls::SignatureScheme::ECDSA_NISTP384_SHA384,
            rustls::SignatureScheme::RSA_PKCS1_SHA512,
            rustls::SignatureScheme::ECDSA_NISTP521_SHA512,
            rustls::SignatureScheme::RSA_PSS_SHA256,
            rustls::SignatureScheme::RSA_PSS_SHA384,
            rustls::SignatureScheme::RSA_PSS_SHA512,
            rustls::SignatureScheme::ED25519,
        ]
    }
}
