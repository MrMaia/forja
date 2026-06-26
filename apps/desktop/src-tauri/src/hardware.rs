// Offline hardware detection for the "network drivers" flow. On a freshly
// formatted PC with no internet winget can't download anything, so the realistic
// help is: read the machine's network adapters + make/model locally (WMI, works
// offline) and point the user at the exact official driver to grab on a pendrive.

use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

// Fixed PowerShell that emits the machine make/model, physical network adapters,
// and any net devices missing a driver, as compact JSON. UTF-8 so accents in the
// model survive. The literal MUST match the allowlist in capabilities/default.json.
const NET_SCRIPT: &str = "[Console]::OutputEncoding=[Text.Encoding]::UTF8; $cs=Get-CimInstance Win32_ComputerSystem; $ad=@(Get-CimInstance Win32_NetworkAdapter -Filter 'PhysicalAdapter=true' | Select-Object Name,NetConnectionStatus); $missing=@(Get-CimInstance Win32_PnPEntity -Filter 'ConfigManagerErrorCode<>0' | Where-Object { $_.PNPClass -eq 'Net' } | Select-Object Name); [pscustomobject]@{manufacturer=$cs.Manufacturer;model=$cs.Model;adapters=$ad;missing=$missing} | ConvertTo-Json -Depth 4 -Compress";

// Free space (bytes) on the system drive. Fixed script — matches the allowlist.
const DISK_SCRIPT: &str = "(Get-CimInstance Win32_LogicalDisk -Filter (\"DeviceID='\" + $env:SystemDrive + \"'\")).FreeSpace";

/// Free disk space on the system drive, in bytes.
#[tauri::command]
pub async fn disk_free(app: AppHandle) -> Result<u64, String> {
    let out = app
        .shell()
        .command("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", DISK_SCRIPT])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    String::from_utf8_lossy(&out.stdout)
        .trim()
        .parse::<u64>()
        .map_err(|e| e.to_string())
}

/// Detect network hardware (make/model + adapters). Returns raw JSON for the UI
/// to parse. Runs fully offline.
#[tauri::command]
pub async fn detect_network(app: AppHandle) -> Result<String, String> {
    let out = app
        .shell()
        .command("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", NET_SCRIPT])
        .output()
        .await
        .map_err(|e| format!("falha ao consultar o hardware: {e}"))?;

    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}
