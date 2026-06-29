// Elevated system actions that don't fit the tweaks flow: admin check,
// relaunch-as-admin, and installing the bundled Intel Wi-Fi driver. These use
// std::process::Command directly (not the shell plugin), so they don't go through
// the shell allowlist — UAC is requested per action via Start-Process -Verb RunAs.
//
// All three commands are marked `#[tauri::command(async)]` so Tauri runs them on a
// worker thread instead of the main/UI thread. Their bodies spawn blocking child
// processes (net session, elevated installers) and the relaunch path waits on UAC;
// running those on the main thread freezes the WebView ("Não está respondendo").

use std::process::Command;
use tauri::{AppHandle, Manager};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// Spawning a console subprocess (powershell, net) from this GUI app pops a black
// console window. CREATE_NO_WINDOW suppresses it — without this, "Reabrir como
// admin" flashed a stray cmd window alongside the elevated instance.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// `Command` with the console window suppressed on Windows.
fn quiet_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Run a program elevated (UAC). `wait` blocks until the elevated process exits
/// (use for installers we want to track); without it, control returns as soon as
/// the process launches — UAC denial/cancel still surfaces as a non-zero exit.
fn elevate(file: &str, args: &[&str], wait: bool) -> Result<(), String> {
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
        "Start-Process -FilePath '{}'{} -Verb RunAs{}",
        file.replace('\'', "''"),
        arglist,
        if wait { " -Wait" } else { "" }
    );
    let status = quiet_command("powershell")
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
#[tauri::command(async)]
pub fn is_admin() -> bool {
    quiet_command("net")
        .args(["session"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Relaunch Forja with administrator privileges, then close this instance. We do
/// NOT wait for the new (admin) instance: once it has launched we exit immediately,
/// so the old window doesn't linger frozen alongside it. If UAC is cancelled,
/// `elevate` returns an error and we keep the current instance running.
#[tauri::command(async)]
pub fn relaunch_as_admin(app: AppHandle) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    elevate(exe.to_str().ok_or("caminho do executável inválido")?, &[], false)?;
    app.exit(0);
    Ok(())
}

/// Install the bundled Intel Wi-Fi driver (UAC-elevated).
// ponytail: launches the Intel installer elevated; its own UI drives the steps.
// Silent flags vary by Intel package version, so we don't force one here.
// Add when: a verified silent switch for this exact build is known.
#[tauri::command(async)]
pub fn install_wifi_driver(app: AppHandle) -> Result<(), String> {
    let path = app
        .path()
        .resolve("drivers/wifi-intel.exe", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("driver não encontrado: {e}"))?;
    elevate(path.to_str().ok_or("caminho do driver inválido")?, &[], true)
}
