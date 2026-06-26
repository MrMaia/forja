// Install engine. winget is the default; items without a winget id are the
// fallback path (downloading the official installer + UAC elevation) — left as
// a TODO stub for v1, see install_one().

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Clone, Deserialize)]
pub struct InstallItem {
    pub id: String,
    pub winget: Option<String>,
    #[serde(rename = "fallbackUrl")]
    pub fallback_url: Option<String>,
    #[serde(default)]
    pub action: Option<String>, // "install" (default) | "upgrade"
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    id: String,
    status: String, // queued | downloading | installing | done | error | skipped
    #[serde(skip_serializing_if = "Option::is_none")]
    percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    line: Option<String>,
}

const EVENT: &str = "install:progress";

fn emit(app: &AppHandle, id: &str, status: &str, percent: Option<f64>, line: Option<String>) {
    let _ = app.emit(
        EVENT,
        Progress {
            id: id.to_string(),
            status: status.to_string(),
            percent,
            line,
        },
    );
}

// Pull a download percentage out of a winget progress line like
// "███▒▒  595 KB / 1.58 MB". Locale-independent (numbers + B/KB/MB/GB).
fn parse_download_pct(line: &str) -> Option<f64> {
    let toks: Vec<&str> = line.split_whitespace().collect();
    let slash = toks.iter().position(|t| *t == "/")?;
    if slash < 2 || slash + 2 >= toks.len() {
        return None;
    }
    let cur = parse_size(toks[slash - 2], toks[slash - 1])?;
    let total = parse_size(toks[slash + 1], toks[slash + 2])?;
    if total <= 0.0 {
        return None;
    }
    Some((cur / total * 100.0).clamp(0.0, 100.0))
}

fn parse_size(num: &str, unit: &str) -> Option<f64> {
    let n: f64 = num.replace(',', ".").parse().ok()?;
    let mult = match unit.to_ascii_uppercase().as_str() {
        "B" => 1.0,
        "KB" => 1e3,
        "MB" => 1e6,
        "GB" => 1e9,
        _ => return None,
    };
    Some(n * mult)
}

/// Install a list of programs sequentially, streaming progress over the
/// "install:progress" event. Each id transitions queued -> installing -> done/error.
#[tauri::command]
pub async fn install_programs(app: AppHandle, items: Vec<InstallItem>) -> Result<(), String> {
    for item in &items {
        emit(&app, &item.id, "queued", None, None);
    }
    for item in items {
        install_one(&app, &item).await;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_download_percentage() {
        let pct = parse_download_pct("███████▒▒▒▒   595 KB / 1.58 MB").unwrap();
        assert!((pct - 37.6).abs() < 0.5, "got {pct}");
        // decimal comma (pt-BR locale) and full bar
        assert_eq!(parse_download_pct("██████  1,58 MB / 1.58 MB"), Some(100.0));
        // plain text lines have no size pair
        assert_eq!(parse_download_pct("Instalado com êxito"), None);
    }
}

async fn install_one(app: &AppHandle, item: &InstallItem) {
    let Some(winget_id) = item.winget.clone() else {
        // ponytail: fallback installer download + UAC elevation (elevated-command)
        // deferred — for now mark skipped so the UI can deep-link the official source.
        // Add when: drivers / non-winget items need real silent install.
        emit(app, &item.id, "skipped", None, item.fallback_url.clone());
        return;
    };

    emit(app, &item.id, "installing", None, None);

    // "install" by default; "upgrade" updates an already-installed package.
    let sub = if item.action.as_deref() == Some("upgrade") {
        "upgrade"
    } else {
        "install"
    };
    let cmd = app.shell().command("winget").args([
        sub,
        "--id",
        &winget_id,
        "-e",
        "--silent",
        "--accept-package-agreements",
        "--accept-source-agreements",
    ]);

    let (mut rx, _child) = match cmd.spawn() {
        Ok(pair) => pair,
        Err(e) => {
            emit(app, &item.id, "error", None, Some(format!("falha ao iniciar winget: {e}")));
            return;
        }
    };

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(bytes) | CommandEvent::Stderr(bytes) => {
                let line = String::from_utf8_lossy(&bytes).trim().to_string();
                if let Some(pct) = parse_download_pct(&line) {
                    emit(app, &item.id, "downloading", Some(pct), None);
                } else if line.chars().any(|c| c.is_alphabetic()) {
                    // skip pure spinner noise (- \ | / █ ▒); keep real text lines
                    emit(app, &item.id, "installing", None, Some(line));
                }
            }
            CommandEvent::Terminated(payload) => {
                // winget returns 0 on success; also treat "already installed" (no-op) as done.
                let ok = payload.code.unwrap_or(1) == 0;
                emit(app, &item.id, if ok { "done" } else { "error" }, None, None);
            }
            _ => {}
        }
    }
}
