// Elevated system actions that don't fit the tweaks flow: admin check,
// relaunch-as-admin, and installing the bundled Intel Wi-Fi driver. These use
// std::process::Command directly (not the shell plugin), so they don't go through
// the shell allowlist — UAC is requested per action via Start-Process -Verb RunAs.

use std::process::Command;
use tauri::{AppHandle, Manager};

/// Run a program elevated (UAC) and wait for it to finish.
fn elevate(file: &str, args: &[&str]) -> Result<(), String> {
    let arglist = if args.is_empty() {
        String::new()
    } else {
        let quoted: Vec<String> = args
            .iter()
            .map(|a| format!("'{}'", a.replace('\'', "''")))
            .collect();
        format!(" -ArgumentList {}", quoted.join(","))
    };
    let ps = format!(
        "Start-Process -FilePath '{}'{} -Verb RunAs -Wait",
        file.replace('\'', "''"),
        arglist
    );
    let status = Command::new("powershell")
        .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps])
        .status()
        .map_err(|e| format!("falha ao elevar: {e}"))?;
    if status.success() {
        Ok(())
    } else {
        Err("ação cancelada ou falhou (permissão de administrador)".into())
    }
}

/// True when Forja is already running elevated. `net session` only succeeds for an
/// administrator, so it's a cheap, dependency-free probe.
#[tauri::command]
pub fn is_admin() -> bool {
    Command::new("net")
        .args(["session"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Relaunch Forja with administrator privileges, then close this instance.
#[tauri::command]
pub fn relaunch_as_admin(app: AppHandle) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    elevate(exe.to_str().ok_or("caminho do executável inválido")?, &[])?;
    app.exit(0);
    Ok(())
}

/// Install the bundled Intel Wi-Fi driver (UAC-elevated).
// ponytail: launches the Intel installer elevated; its own UI drives the steps.
// Silent flags vary by Intel package version, so we don't force one here.
// Add when: a verified silent switch for this exact build is known.
#[tauri::command]
pub fn install_wifi_driver(app: AppHandle) -> Result<(), String> {
    let path = app
        .path()
        .resolve("drivers/wifi-intel.exe", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("driver não encontrado: {e}"))?;
    elevate(path.to_str().ok_or("caminho do driver inválido")?, &[])
}
