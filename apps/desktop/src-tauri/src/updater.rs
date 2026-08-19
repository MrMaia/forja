// "Complete" self-update without code-signing/updater keys: download the release
// installer (.exe), verify it against a SHA256 published alongside it (the
// `<asset>.sha256` sidecar — see checkForjaUpdate in tauri.ts), then launch it.
// The NSIS installer replaces the app in place. URL/hash come from our GitHub
// release check and are passed via env (no injection).

use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

// Downloads $FORJA_UPDATE_URL to %TEMP%, aborts if its SHA256 doesn't match
// $FORJA_UPDATE_SHA256, otherwise runs it. Fixed script — must match the
// allowlist in capabilities/default.json.
const UPDATE_SCRIPT: &str = "$ProgressPreference='SilentlyContinue'; $u=$env:FORJA_UPDATE_URL; $h=$env:FORJA_UPDATE_SHA256; $o=Join-Path $env:TEMP 'Forja-update-setup.exe'; Invoke-WebRequest -Uri $u -OutFile $o; $a=(Get-FileHash -Path $o -Algorithm SHA256).Hash; if ($a -ne $h.ToUpper()) { Remove-Item $o -Force; Write-Error \"hash mismatch: expected $h got $a\"; exit 1 }; Start-Process -FilePath $o";

fn valid_sha256(s: &str) -> bool {
    s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit())
}

#[tauri::command]
pub async fn install_update(app: AppHandle, url: String, sha256: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("URL inválida".into());
    }
    if !valid_sha256(&sha256) {
        return Err("hash de verificação inválido".into());
    }
    let out = app
        .shell()
        .command("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", UPDATE_SCRIPT])
        .env("FORJA_UPDATE_URL", &url)
        .env("FORJA_UPDATE_SHA256", &sha256)
        .output()
        .await
        .map_err(|e| format!("falha ao baixar a atualização: {e}"))?;

    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_64_char_hex() {
        assert!(valid_sha256(&"a".repeat(64)));
        assert!(valid_sha256(&"F".repeat(64)));
    }

    #[test]
    fn rejects_wrong_length_or_non_hex() {
        assert!(!valid_sha256(&"a".repeat(63)));
        assert!(!valid_sha256(&"a".repeat(65)));
        assert!(!valid_sha256(&"g".repeat(64)));
        assert!(!valid_sha256(""));
    }
}
