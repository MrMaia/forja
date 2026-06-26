// "Complete" self-update without code-signing/updater keys: download the release
// installer (.exe) and launch it. The NSIS installer replaces the app in place.
// URL comes from our GitHub release check and is passed via env (no injection).

use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

// Downloads $FORJA_UPDATE_URL to %TEMP% and runs it. Fixed script — must match
// the allowlist in capabilities/default.json.
const UPDATE_SCRIPT: &str = "$ProgressPreference='SilentlyContinue'; $u=$env:FORJA_UPDATE_URL; $o=Join-Path $env:TEMP 'Forja-update-setup.exe'; Invoke-WebRequest -Uri $u -OutFile $o; Start-Process -FilePath $o";

#[tauri::command]
pub async fn install_update(app: AppHandle, url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("URL inválida".into());
    }
    let out = app
        .shell()
        .command("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", UPDATE_SCRIPT])
        .env("FORJA_UPDATE_URL", &url)
        .output()
        .await
        .map_err(|e| format!("falha ao baixar a atualização: {e}"))?;

    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}
