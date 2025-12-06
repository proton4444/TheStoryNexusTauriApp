use std::{
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::Duration,
};

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

const DEFAULT_PORT: u16 = 9876;
const DEFAULT_HOST: &str = "127.0.0.1";

#[derive(Default)]
pub struct SidecarState {
    child: Mutex<Option<Child>>,
}

impl SidecarState {
    fn start(
        &self,
        python_bin: &str,
        working_dir: PathBuf,
        host: &str,
        port: u16,
    ) -> Result<(), String> {
        let mut child_guard = self.child.lock().map_err(|_| "sidecar lock poisoned")?;
        if child_guard.is_some() {
            return Ok(()); // already running
        }

        let mut cmd = Command::new(python_bin);
        cmd.args([
            "-m",
            "uvicorn",
            "sidecar.memori_bridge:app",
            "--host",
            host,
            "--port",
            &port.to_string(),
        ])
        .current_dir(working_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

        let child = cmd.spawn().map_err(|e| e.to_string())?;
        *child_guard = Some(child);
        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut child_guard = self.child.lock().map_err(|_| "sidecar lock poisoned")?;
        if let Some(mut child) = child_guard.take() {
            child.kill().ok();
            child.wait().ok();
        }
        Ok(())
    }
}

fn default_working_dir(app: &AppHandle) -> Result<PathBuf, String> {
    std::env::current_dir().or_else(|_| {
        // Fallback to the executable directory if current_dir is unavailable.
        app.path()
            .executable_dir()
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub async fn start_memori_sidecar(
    app: AppHandle,
    state: State<'_, SidecarState>,
    python_bin: Option<String>,
    port: Option<u16>,
) -> Result<(), String> {
    let python = python_bin.unwrap_or_else(|| "python".to_string());
    let resolved_port = port.unwrap_or(DEFAULT_PORT);
    let cwd = default_working_dir(&app)?;

    state.start(&python, cwd, DEFAULT_HOST, resolved_port)
}

#[tauri::command]
pub async fn stop_memori_sidecar(state: State<'_, SidecarState>) -> Result<(), String> {
    state.stop()
}

#[tauri::command]
pub async fn memori_health(port: Option<u16>) -> Result<String, String> {
    let resolved_port = port.unwrap_or(DEFAULT_PORT);
    let url = format!("http://{DEFAULT_HOST}:{resolved_port}/health");

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();

    if status.is_success() {
        Ok(body)
    } else {
        Err(format!("healthcheck failed: {status} {body}"))
    }
}

fn port_or_default(port: Option<u16>) -> u16 {
    port.unwrap_or(DEFAULT_PORT)
}

fn base_url(port: u16) -> String {
    format!("http://{DEFAULT_HOST}:{port}")
}

async fn get_json<T: DeserializeOwned>(path: &str, port: Option<u16>) -> Result<T, String> {
    let resolved_port = port_or_default(port);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}{path}", base_url(resolved_port));
    let mut last_err: Option<String> = None;
    for _ in 0..3 {
        match client.get(&url).send().await {
            Ok(resp) => match resp.error_for_status() {
                Ok(ok) => return ok.json::<T>().await.map_err(|e| e.to_string()),
                Err(e) => last_err = Some(e.to_string()),
            },
            Err(e) => last_err = Some(e.to_string()),
        }
        tokio::time::sleep(Duration::from_millis(120)).await;
    }
    Err(last_err.unwrap_or_else(|| "request failed".to_string()))
}

async fn post_json<T: DeserializeOwned, B: Serialize>(
    path: &str,
    body: &B,
    port: Option<u16>,
) -> Result<T, String> {
    let resolved_port = port_or_default(port);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}{path}", base_url(resolved_port));
    let mut last_err: Option<String> = None;
    for _ in 0..3 {
        match client.post(&url).json(body).send().await {
            Ok(resp) => match resp.error_for_status() {
                Ok(ok) => return ok.json::<T>().await.map_err(|e| e.to_string()),
                Err(e) => last_err = Some(e.to_string()),
            },
            Err(e) => last_err = Some(e.to_string()),
        }
        tokio::time::sleep(Duration::from_millis(150)).await;
    }
    Err(last_err.unwrap_or_else(|| "request failed".to_string()))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfigSnapshot {
    pub backend: String,
    pub host: String,
    pub port: u16,
    pub process_id: String,
    pub llm_provider: String,
    pub llm_model: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionResponse {
    pub story_id: String,
    pub session_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryAddResponse {
    pub memory_id: String,
    pub story_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtractionResponse {
    pub memory_id: String,
    pub story_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryResult {
    pub memory_id: String,
    pub story_id: String,
    pub content: String,
    pub category: Option<String>,
    pub session_id: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    pub results: Vec<MemoryResult>,
    pub total: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContextResponse {
    pub memories: Vec<MemoryResult>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryListRequest {
    pub story_id: Option<String>,
    pub query: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryListResponse {
    pub memories: Vec<MemoryResult>,
    pub total: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompletionResponse {
    pub completion: String,
    pub story_id: String,
    pub session_id: String,
    pub injected_memories: Vec<String>,
    pub llm_provider: Option<String>,
    pub llm_model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompletionRequest {
    pub prompt: String,
    pub story_id: String,
    pub session_id: Option<String>,
    pub inject_limit: Option<u32>,
    pub model: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub max_context_tokens: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryAddRequest {
    pub story_id: String,
    pub content: String,
    pub category: Option<String>,
    pub session_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtractionRequest {
    pub story_id: String,
    pub prompt: String,
    pub completion: String,
    pub category: Option<String>,
    pub session_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IngestRequest {
    pub story_id: String,
    pub prompt: String,
    pub completion: String,
    pub injected_memories: Vec<String>,
    pub category: Option<String>,
    pub session_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchRequest {
    pub story_id: String,
    pub query: String,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContextRequest {
    pub story_id: String,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IngestResponse {
    pub memory_id: String,
    pub story_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionRequest {
    pub story_id: String,
}

#[tauri::command]
pub async fn memori_config(port: Option<u16>) -> Result<ConfigSnapshot, String> {
    get_json::<ConfigSnapshot>("/config", port).await
}

#[tauri::command]
pub async fn memori_completion(
    payload: CompletionRequest,
    port: Option<u16>,
) -> Result<CompletionResponse, String> {
    post_json::<CompletionResponse, _>("/completion", &payload, port).await
}

#[tauri::command]
pub async fn memori_add_memory(
    payload: MemoryAddRequest,
    port: Option<u16>,
) -> Result<MemoryAddResponse, String> {
    post_json::<MemoryAddResponse, _>("/memory/add", &payload, port).await
}

#[tauri::command]
pub async fn memori_extract(
    payload: ExtractionRequest,
    port: Option<u16>,
) -> Result<ExtractionResponse, String> {
    post_json::<ExtractionResponse, _>("/extract", &payload, port).await
}

#[tauri::command]
pub async fn memori_ingest(
    payload: IngestRequest,
    port: Option<u16>,
) -> Result<IngestResponse, String> {
    post_json::<IngestResponse, _>("/ingest", &payload, port).await
}

#[tauri::command]
pub async fn memori_search(
    payload: SearchRequest,
    port: Option<u16>,
) -> Result<SearchResponse, String> {
    post_json::<SearchResponse, _>("/search", &payload, port).await
}

#[tauri::command]
pub async fn memori_context(
    payload: ContextRequest,
    port: Option<u16>,
) -> Result<ContextResponse, String> {
    post_json::<ContextResponse, _>("/context", &payload, port).await
}

#[tauri::command]
pub async fn memori_list_memories(
    payload: MemoryListRequest,
    port: Option<u16>,
) -> Result<MemoryListResponse, String> {
    post_json::<MemoryListResponse, _>("/memory/list", &payload, port).await
}

#[tauri::command]
pub async fn memori_create_session(
    payload: SessionRequest,
    port: Option<u16>,
) -> Result<SessionResponse, String> {
    post_json::<SessionResponse, _>("/session/new", &payload, port).await
}
