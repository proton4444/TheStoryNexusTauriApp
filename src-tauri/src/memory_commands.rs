use std::{
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::Duration,
};

use tauri::{AppHandle, State};

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

    fn stop(&self) -> Result<(), String> {
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
