// Install engine. winget is the default; items without a winget id are the
// fallback path (downloading the official installer + UAC elevation) — left as
// a TODO stub for v1, see install_one().

use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

// Hard cap per package so a stuck winget (waiting on an invisible prompt, a hung
// download) can't freeze the queue forever. Generous — big installers are slow.
const PER_ITEM_TIMEOUT: Duration = Duration::from_secs(30 * 60);

#[derive(Debug, Clone, Deserialize)]
pub struct InstallItem {
    pub id: String,
    pub winget: Option<String>,
    #[serde(default)]
    pub npm: Option<String>, // global npm package for CLIs not in winget (Claude/Codex)
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

    #[test]
    fn extracts_installer_log_path() {
        let line = "Installer log is available at: C:\\Users\\Allan\\AppData\\Local\\Git.Git.log";
        assert_eq!(
            extract_log_path(line).as_deref(),
            Some("C:\\Users\\Allan\\AppData\\Local\\Git.Git.log")
        );
        assert_eq!(extract_log_path("no path here"), None);
    }

    #[test]
    fn classifies_files_in_use() {
        let log = "The following process(es) use Git for Windows:\nPlease terminate those processes and retry.";
        assert!(classify_log(log).unwrap().contains("em uso"));
    }

    #[test]
    fn classifies_msi_1603() {
        let log = "Produto: Epic Games Launcher -- Falha na instalação. Status de erro: 1603.";
        assert!(classify_log(log).unwrap().contains("1603"));
    }

    #[test]
    fn unknown_log_is_none() {
        assert_eq!(classify_log("everything went fine, nothing to see"), None);
    }

    #[test]
    fn account_names_dont_trigger_admin_false_positive() {
        // Epic's log lists WIX account names ("BUILTIN\Administradores") AND fails
        // with 1603 — must report 1603, not "needs admin".
        let log = "WIX_ACCOUNT_ADMINS = BUILTIN\\Administradores\nFalha na instalação. Status de erro: 1603.";
        assert!(classify_log(log).unwrap().contains("1603"));
    }

    #[test]
    fn decodes_utf16le_with_bom() {
        let mut bytes = vec![0xFF, 0xFE];
        for u in "erro 1603".encode_utf16() {
            bytes.extend_from_slice(&u.to_le_bytes());
        }
        assert!(decode_log(&bytes).contains("1603"));
    }
}

async fn install_one(app: &AppHandle, item: &InstallItem) {
    // winget is the default engine; CLIs absent from winget (Claude/Codex) install
    // globally via npm; anything else falls back to a deep-link (skipped).
    let cmd = if let Some(winget_id) = item.winget.clone() {
        // install (default) | upgrade | uninstall — each has its own arg set,
        // matching the entries allowlisted in capabilities/default.json.
        match item.action.as_deref() {
            Some("uninstall") => app.shell().command("winget").args([
                "uninstall",
                "--id",
                &winget_id,
                "-e",
                "--silent",
                "--accept-source-agreements",
            ]),
            Some("upgrade") => app.shell().command("winget").args([
                "upgrade",
                "--id",
                &winget_id,
                "-e",
                "--silent",
                "--accept-package-agreements",
                "--accept-source-agreements",
            ]),
            _ => app.shell().command("winget").args([
                "install",
                "--id",
                &winget_id,
                "-e",
                "--silent",
                "--accept-package-agreements",
                "--accept-source-agreements",
            ]),
        }
    } else if let Some(pkg) = item.npm.clone() {
        // npm is npm.cmd on Windows — go through cmd so it resolves
        app.shell().command("cmd").args(["/c", "npm", "install", "-g", &pkg])
    } else {
        // drivers / non-winget items with no command: deep-link the official source
        emit(app, &item.id, "skipped", None, item.fallback_url.clone());
        return;
    };

    emit(app, &item.id, "installing", None, None);

    let (mut rx, child) = match cmd.spawn() {
        Ok(pair) => pair,
        Err(e) => {
            emit(app, &item.id, "error", None, Some(format!("falha ao iniciar winget: {e}")));
            return;
        }
    };

    // Keep the last meaningful text line so a failure can show *why* instead of a
    // bare "Erro" — winget piped (no console) buffers its progress bar, so this
    // last line is usually the only diagnostic we get.
    let mut last_line: Option<String> = None;
    let timeout = tokio::time::sleep(PER_ITEM_TIMEOUT);
    tokio::pin!(timeout);

    loop {
        tokio::select! {
            _ = &mut timeout => {
                let _ = child.kill();
                emit(app, &item.id, "error", None,
                    Some("tempo esgotado (30 min) — winget não respondeu".into()));
                return;
            }
            event = rx.recv() => {
                let Some(event) = event else { break };
                match event {
                    CommandEvent::Stdout(bytes) | CommandEvent::Stderr(bytes) => {
                        let line = String::from_utf8_lossy(&bytes).trim().to_string();
                        if let Some(pct) = parse_download_pct(&line) {
                            emit(app, &item.id, "downloading", Some(pct), None);
                        } else if line.chars().any(|c| c.is_alphabetic()) {
                            // skip pure spinner noise (- \ | / █ ▒); keep real text lines
                            last_line = Some(line.clone());
                            emit(app, &item.id, "installing", None, Some(line));
                        }
                    }
                    CommandEvent::Terminated(payload) => {
                        let code = payload.code.unwrap_or(-1);
                        if code == 0 {
                            emit(app, &item.id, "done", None, None);
                        } else {
                            // winget wraps both "files in use" and MSI 1603 in the
                            // same generic code, so the real reason lives in the
                            // installer log it points to. Translate it to plain text.
                            let why = friendly_failure(code, last_line.take());
                            emit(app, &item.id, "error", None, Some(why));
                        }
                    }
                    _ => {}
                }
            }
        }
    }
}

// Turn a failed winget run into a human reason. winget's exit code is too generic
// (the same code covers "in use", MSI 1603, etc.), so we read the installer log it
// points to and match a few common signatures. Falls back to the raw line + code.
fn friendly_failure(code: i32, last_line: Option<String>) -> String {
    if let Some(line) = &last_line {
        if let Some(reason) = reason_from_log(line) {
            return reason;
        }
    }
    match last_line {
        Some(l) if !l.is_empty() => format!("{l} (winget {code})"),
        _ => format!("winget falhou (código {code})"),
    }
}

fn reason_from_log(last_line: &str) -> Option<String> {
    let path = extract_log_path(last_line)?;
    let bytes = std::fs::read(&path).ok()?;
    classify_log(&decode_log(&bytes))
}

// MSI logs are UTF-16LE (often with a BOM); Inno/others are UTF-8. Decode
// properly so accented Portuguese text matches — naive NUL-stripping mangles
// multibyte chars and caused false matches.
fn decode_log(bytes: &[u8]) -> String {
    let utf16le = |b: &[u8]| {
        let units: Vec<u16> = b.chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
        String::from_utf16_lossy(&units)
    };
    if bytes.starts_with(&[0xFF, 0xFE]) {
        utf16le(&bytes[2..])
    } else if looks_utf16le(bytes) {
        utf16le(bytes)
    } else {
        String::from_utf8_lossy(bytes).into_owned()
    }
}

// Heuristic: ASCII text in UTF-16LE has a zero high-byte at most odd offsets.
fn looks_utf16le(bytes: &[u8]) -> bool {
    let sample = bytes.len().min(256);
    if sample < 4 {
        return false;
    }
    let odd = (1..sample).step_by(2);
    let zeros = odd.clone().filter(|&i| bytes[i] == 0).count();
    zeros * 2 > odd.count()
}

// Map an installer log to a plain-language reason. Order matters: specific
// causes (in-use, busy, elevation) before the generic MSI 1603.
fn classify_log(text: &str) -> Option<String> {
    let low = text.to_lowercase();
    if low.contains("use git for windows")
        || low.contains("please terminate those processes")
        || low.contains("process(es) use")
    {
        return Some(
            "o programa está em uso — feche terminais, editores e janelas dele e tente de novo"
                .into(),
        );
    }
    if low.contains("1618") {
        return Some("outra instalação está em andamento — aguarde ela terminar e tente de novo".into());
    }
    if low.contains("requires elevation")
        || low.contains("access is denied")
        || low.contains("0x80070005")
    {
        return Some("precisa de permissão de administrador para atualizar".into());
    }
    if low.contains("1603") {
        return Some(
            "o instalador falhou (erro 1603) — provavelmente já há uma versão instalada por fora do winget; atualize pelo próprio app ou no site oficial"
                .into(),
        );
    }
    None
}

// Pull the log path out of winget's "Installer log is available at: C:\...\X.log".
fn extract_log_path(line: &str) -> Option<String> {
    let end = line.to_lowercase().find(".log")? + 4;
    let start = line.find(": ").map(|i| i + 2).unwrap_or(0);
    if start >= end {
        return None;
    }
    Some(line[start..end].trim().to_string())
}
