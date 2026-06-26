// Executable-based detection for dev/CLI tools, plus a one-click "add to the
// user PATH". This is the second detection signal alongside `winget list`
// (detect.rs): winget gives version/upgrade, this gives "is the binary here?"
// and "is it on PATH?" — and the directory to add when it isn't.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Clone, Deserialize)]
pub struct PathSpec {
    pub id: String,
    #[serde(default)]
    pub exe: Vec<String>,
    #[serde(rename = "installDirs", default)]
    pub install_dirs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PathToolInfo {
    pub id: String,
    pub installed: bool,
    pub on_path: bool,
    pub path_dir: Option<String>, // dir to add to PATH when on_path == false
}

/// Probe a set of tools by executable presence (on PATH, then in install dirs).
#[tauri::command]
pub fn check_path_tools(specs: Vec<PathSpec>) -> Vec<PathToolInfo> {
    let path_dirs = path_entries();
    specs.iter().map(|s| probe(s, &path_dirs)).collect()
}

// Fixed PowerShell that appends the dir (passed via env, never interpolated into
// the command string — so there's nothing to inject) to the USER Path. Setting
// at User scope writes the registry AND broadcasts WM_SETTINGCHANGE, so new
// terminals pick it up; no admin, no setx 1024-char truncation. The literal
// here MUST match the allowlisted args in capabilities/default.json.
const SET_USER_PATH_SCRIPT: &str = "$d=$env:FORJA_PATH_DIR; if($d){ $p=[Environment]::GetEnvironmentVariable('Path','User'); if(-not $p){$p=''}; if(($p -split ';') -notcontains $d){ [Environment]::SetEnvironmentVariable('Path', ($p.TrimEnd(';')+';'+$d), 'User') } }";

/// Append `dir` to the current user's PATH (idempotent). No-op if already present.
#[tauri::command]
pub async fn add_to_user_path(app: AppHandle, dir: String) -> Result<(), String> {
    if dir.trim().is_empty() {
        return Err("pasta vazia".into());
    }
    let output = app
        .shell()
        .command("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            SET_USER_PATH_SCRIPT,
        ])
        .env("FORJA_PATH_DIR", &dir)
        .output()
        .await
        .map_err(|e| format!("falha ao rodar powershell: {e}"))?;

    if output.status.success() {
        Ok(())
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(format!("não foi possível alterar o PATH: {}", err.trim()))
    }
}

fn probe(spec: &PathSpec, path_dirs: &[PathBuf]) -> PathToolInfo {
    // 1. resolvable on PATH?
    for dir in path_dirs {
        if dir_has_exe(dir, &spec.exe) {
            return PathToolInfo {
                id: spec.id.clone(),
                installed: true,
                on_path: true,
                path_dir: None,
            };
        }
    }
    // 2. present in a known install dir (so installed, but off PATH)?
    for cand in &spec.install_dirs {
        for dir in expand_candidate(cand) {
            if dir_has_exe(&dir, &spec.exe) {
                return PathToolInfo {
                    id: spec.id.clone(),
                    installed: true,
                    on_path: false,
                    path_dir: Some(dir.to_string_lossy().into_owned()),
                };
            }
        }
    }
    PathToolInfo {
        id: spec.id.clone(),
        installed: false,
        on_path: false,
        path_dir: None,
    }
}

fn path_entries() -> Vec<PathBuf> {
    std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).collect())
        .unwrap_or_default()
}

fn dir_has_exe(dir: &std::path::Path, exes: &[String]) -> bool {
    exes.iter().any(|e| dir.join(e).is_file())
}

// Expand a candidate dir: substitute %VAR% (skip the candidate if any var is
// missing). A single "*" component means "each immediate subdirectory" and may
// appear anywhere — used for tools that install under a version folder, whether
// it's the last segment (Python\Python313) or in the middle
// (Eclipse Adoptium\jdk-21\bin).
fn expand_candidate(cand: &str) -> Vec<PathBuf> {
    let Some(expanded) = expand_env(cand) else {
        return Vec::new();
    };
    let p = PathBuf::from(&expanded);
    // components() keeps the drive/root, so the rebuilt base stays absolute
    let comps: Vec<_> = p.components().collect();
    let Some(star) = comps.iter().position(|c| c.as_os_str().to_str() == Some("*")) else {
        return vec![p];
    };
    let base: PathBuf = comps[..star].iter().map(|c| c.as_os_str()).collect();
    let suffix: PathBuf = comps[star + 1..].iter().map(|c| c.as_os_str()).collect();
    match std::fs::read_dir(&base) {
        Ok(entries) => entries
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.is_dir())
            .map(|d| if suffix.as_os_str().is_empty() { d } else { d.join(&suffix) })
            .collect(),
        Err(_) => Vec::new(),
    }
}

// Replace %VAR% occurrences from the environment. Returns None if a referenced
// variable isn't set (the candidate doesn't apply on this machine).
fn expand_env(s: &str) -> Option<String> {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        let end = after.find('%')?;
        let var = &after[..end];
        out.push_str(&std::env::var(var).ok()?);
        rest = &after[end + 1..];
    }
    out.push_str(rest);
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn spec(id: &str, exe: &[&str], dirs: &[&str]) -> PathSpec {
        PathSpec {
            id: id.to_string(),
            exe: exe.iter().map(|s| s.to_string()).collect(),
            install_dirs: dirs.iter().map(|s| s.to_string()).collect(),
        }
    }

    fn tmp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("forja_pathtools_{name}_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn expands_known_env_var() {
        std::env::set_var("FORJA_TEST_VAR", "C:\\base");
        assert_eq!(expand_env("%FORJA_TEST_VAR%\\cmd").as_deref(), Some("C:\\base\\cmd"));
    }

    #[test]
    fn missing_env_var_skips_candidate() {
        assert_eq!(expand_env("%FORJA_DEFINITELY_UNSET_XYZ%\\x"), None);
        assert!(expand_candidate("%FORJA_DEFINITELY_UNSET_XYZ%\\x").is_empty());
    }

    #[test]
    fn detects_exe_on_path() {
        let dir = tmp("onpath");
        fs::write(dir.join("tool.exe"), b"").unwrap();
        let info = probe(&spec("t", &["tool.exe"], &[]), &[dir.clone()]);
        assert!(info.installed && info.on_path);
        assert_eq!(info.path_dir, None);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn detects_exe_in_install_dir_off_path() {
        let dir = tmp("offpath");
        fs::write(dir.join("git.exe"), b"").unwrap();
        let s = PathSpec {
            id: "git".into(),
            exe: vec!["git.exe".into()],
            install_dirs: vec![dir.to_string_lossy().into_owned()],
        };
        let info = probe(&s, &[]); // empty PATH
        assert!(info.installed && !info.on_path);
        assert_eq!(info.path_dir.as_deref(), Some(dir.to_string_lossy().as_ref()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn glob_searches_subdirectories() {
        // base/Python313/python.exe matched by "base\*"
        let base = tmp("glob");
        let sub = base.join("Python313");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("python.exe"), b"").unwrap();
        let cand = format!("{}\\*", base.to_string_lossy());
        let s = PathSpec {
            id: "python".into(),
            exe: vec!["python.exe".into()],
            install_dirs: vec![cand],
        };
        let info = probe(&s, &[]);
        assert!(info.installed && !info.on_path);
        assert_eq!(info.path_dir.as_deref(), Some(sub.to_string_lossy().as_ref()));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn glob_searches_mid_path_subdirectory() {
        // base/jdk-21/bin/java.exe matched by "base\*\bin" (star in the middle)
        let base = tmp("midglob");
        let bin = base.join("jdk-21").join("bin");
        fs::create_dir_all(&bin).unwrap();
        fs::write(bin.join("java.exe"), b"").unwrap();
        let cand = format!("{}\\*\\bin", base.to_string_lossy());
        let s = PathSpec {
            id: "java".into(),
            exe: vec!["java.exe".into()],
            install_dirs: vec![cand],
        };
        let info = probe(&s, &[]);
        assert!(info.installed && !info.on_path);
        assert_eq!(info.path_dir.as_deref(), Some(bin.to_string_lossy().as_ref()));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn not_found_is_uninstalled() {
        let info = probe(&spec("nope", &["nope.exe"], &["%FORJA_DEFINITELY_UNSET_XYZ%\\x"]), &[]);
        assert!(!info.installed && !info.on_path && info.path_dir.is_none());
    }
}
