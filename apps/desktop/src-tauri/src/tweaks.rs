// Post-format Windows tweaks. Two tiers:
//  - user tweaks: HKCU registry, applied in-process, no admin.
//  - admin tweaks: HKLM / services / powercfg, applied by an elevated PowerShell
//    (one UAC prompt) reading a temp script we generate from a known key->command
//    map (frontend only sends keys, so there's nothing to inject).
// Reading current state never needs elevation.

use std::io::Write;

use serde::Deserialize;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Clone, Deserialize)]
pub struct TweakItem {
    pub key: String,
    pub on: bool,
}

// Reads the on/off state of every known tweak as JSON booleans. The literal must
// match the allowlist in capabilities/default.json.
const READ_SCRIPT: &str = "[Console]::OutputEncoding=[Text.Encoding]::UTF8; $adv='HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced'; $per='HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'; $srch='HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search'; function gv($p,$n){ try{ (Get-ItemProperty -Path $p -Name $n -ErrorAction Stop).$n }catch{ $null } } $o=[ordered]@{}; $o['dark-theme']=((gv $per 'AppsUseLightTheme') -eq 0); $o['file-ext']=((gv $adv 'HideFileExt') -eq 0); $o['hidden-files']=((gv $adv 'Hidden') -eq 1); $o['taskbar-left']=((gv $adv 'TaskbarAl') -eq 0); $o['hide-widgets']=((gv $adv 'TaskbarDa') -eq 0); $o['hide-chat']=((gv $adv 'TaskbarMn') -eq 0); $o['explorer-thispc']=((gv $adv 'LaunchTo') -eq 1); $o['bing-off']=((gv $srch 'BingSearchEnabled') -eq 0); $o['telemetry-off']=((gv 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' 'AllowTelemetry') -eq 0); $o['consumer-off']=((gv 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent' 'DisableWindowsConsumerFeatures') -eq 1); $o['power-high']=((powercfg /getactivescheme) -match '8c5e7fda'); $o['hibernate-off']=((gv 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power' 'HibernateEnabled') -eq 0); [pscustomobject]$o | ConvertTo-Json -Compress";

// Applies one HKCU tweak; key + on passed via env so the script stays fixed.
const USER_APPLY_SCRIPT: &str = "$k=$env:FORJA_TWEAK_KEY; $on=$env:FORJA_TWEAK_ON -eq '1'; $adv='HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced'; $per='HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'; $srch='HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search'; function sv($p,$n,$v){ if(-not(Test-Path $p)){New-Item -Path $p -Force | Out-Null}; Set-ItemProperty -Path $p -Name $n -Type DWord -Value $v } switch($k){ 'dark-theme'{ $v=[int](-not $on); sv $per 'AppsUseLightTheme' $v; sv $per 'SystemUsesLightTheme' $v } 'file-ext'{ sv $adv 'HideFileExt' ([int](-not $on)) } 'hidden-files'{ sv $adv 'Hidden' $(if($on){1}else{2}) } 'taskbar-left'{ sv $adv 'TaskbarAl' $(if($on){0}else{1}) } 'hide-widgets'{ sv $adv 'TaskbarDa' $(if($on){0}else{1}) } 'hide-chat'{ sv $adv 'TaskbarMn' $(if($on){0}else{1}) } 'explorer-thispc'{ sv $adv 'LaunchTo' $(if($on){1}else{2}) } 'bing-off'{ sv $srch 'BingSearchEnabled' $(if($on){0}else{1}) } }";

// Elevates and runs the temp admin script (path via env). One UAC prompt; waits.
const ADMIN_OUTER_SCRIPT: &str = "$f=$env:FORJA_ADMIN_SCRIPT; if(Test-Path $f){ Start-Process powershell -Verb RunAs -Wait -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$f) }";

const RESTART_EXPLORER_SCRIPT: &str = "Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue";

async fn run_fixed(app: &AppHandle, script: &str, env: &[(&str, String)]) -> Result<String, String> {
    let mut cmd = app
        .shell()
        .command("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script]);
    for (k, v) in env {
        cmd = cmd.env(k, v);
    }
    let out = cmd.output().await.map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[tauri::command]
pub async fn read_tweaks(app: AppHandle) -> Result<String, String> {
    run_fixed(&app, READ_SCRIPT, &[]).await
}

#[tauri::command]
pub async fn apply_user_tweak(app: AppHandle, key: String, on: bool) -> Result<(), String> {
    run_fixed(
        &app,
        USER_APPLY_SCRIPT,
        &[
            ("FORJA_TWEAK_KEY", key),
            ("FORJA_TWEAK_ON", if on { "1".into() } else { "0".into() }),
        ],
    )
    .await
    .map(|_| ())
}

#[tauri::command]
pub async fn restart_explorer(app: AppHandle) -> Result<(), String> {
    run_fixed(&app, RESTART_EXPLORER_SCRIPT, &[]).await.map(|_| ())
}

// Map a known admin key+state to its PowerShell. Unknown keys are ignored.
fn admin_command(item: &TweakItem) -> Option<String> {
    let on = item.on;
    Some(match item.key.as_str() {
        "telemetry-off" => if on {
            "New-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Force | Out-Null; Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Name AllowTelemetry -Type DWord -Value 0; Set-Service DiagTrack -StartupType Disabled -ErrorAction SilentlyContinue; Stop-Service DiagTrack -Force -ErrorAction SilentlyContinue".into()
        } else {
            "Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Name AllowTelemetry -ErrorAction SilentlyContinue; Set-Service DiagTrack -StartupType Automatic -ErrorAction SilentlyContinue".into()
        },
        "consumer-off" => if on {
            "New-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent' -Force | Out-Null; Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent' -Name DisableWindowsConsumerFeatures -Type DWord -Value 1".into()
        } else {
            "Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent' -Name DisableWindowsConsumerFeatures -ErrorAction SilentlyContinue".into()
        },
        "power-high" => if on {
            "powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c".into()
        } else {
            "powercfg -setactive 381b4222-f694-41f0-9685-ff5bb260df2e".into()
        },
        "hibernate-off" => if on { "powercfg -h off".into() } else { "powercfg -h on".into() },
        _ => return None,
    })
}

#[tauri::command]
pub async fn apply_admin_tweaks(app: AppHandle, items: Vec<TweakItem>) -> Result<(), String> {
    let body: Vec<String> = items.iter().filter_map(admin_command).collect();
    if body.is_empty() {
        return Ok(());
    }
    let script = body.join("\n");
    let path = std::env::temp_dir().join("forja_admin_tweaks.ps1");
    {
        let mut f = std::fs::File::create(&path).map_err(|e| e.to_string())?;
        f.write_all(script.as_bytes()).map_err(|e| e.to_string())?;
    }
    run_fixed(
        &app,
        ADMIN_OUTER_SCRIPT,
        &[("FORJA_ADMIN_SCRIPT", path.to_string_lossy().into_owned())],
    )
    .await
    .map(|_| ())
}
