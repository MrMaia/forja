// Executable-based detection for dev/CLI tools, plus a one-click "add to the
// user PATH". This is the second detection signal alongside `winget list`
// (detect.rs): winget gives version/upgrade, this gives "is the binary here?"
// and "is it on PATH?" — and the directory to add when it isn't.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// Suppress the console window when spawning the version probe (same reason as the
// CREATE_NO_WINDOW in system.rs: a GUI app launching a console child pops a cmd).
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const DEFAULT_VERSION_ARG: &str = "--version";

#[derive(Debug, Clone, Deserialize)]
pub struct PathSpec {
    pub id: String,
    #[serde(default)]
    pub exe: Vec<String>,
    #[serde(rename = "installDirs", default)]
    pub install_dirs: Vec<String>,
    // flag passed to the found binary to read its version (default "--version").
    #[serde(rename = "versionArg", default)]
    pub version_arg: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PathToolInfo {
    pub id: String,
    pub installed: bool,
    pub on_path: bool,
    pub path_dir: Option<String>, // dir to add to PATH when on_path == false
    pub version: Option<String>,  // exact version from `<exe> <versionArg>`, if readable
}

/// Probe a set of tools by executable presence (on PATH, then in install dirs).
/// `(async)` so Tauri runs it off the main thread: it now spawns a version-probe
/// process per found tool, and blocking that on the UI thread would freeze it.
#[tauri::command(async)]
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
    let version_arg = spec.version_arg.as_deref().unwrap_or(DEFAULT_VERSION_ARG);
    // 1. resolvable on PATH?
    for dir in path_dirs {
        if let Some(exe) = dir_find_exe(dir, &spec.exe) {
            return PathToolInfo {
                id: spec.id.clone(),
                installed: true,
                on_path: true,
                path_dir: None,
                version: probe_version(&exe, version_arg),
            };
        }
    }
    // 2. present in a known install dir (so installed, but off PATH)?
    for cand in &spec.install_dirs {
        for dir in expand_candidate(cand) {
            if let Some(exe) = dir_find_exe(&dir, &spec.exe) {
                return PathToolInfo {
                    id: spec.id.clone(),
                    installed: true,
                    on_path: false,
                    path_dir: Some(dir.to_string_lossy().into_owned()),
                    version: probe_version(&exe, version_arg),
                };
            }
        }
    }
    PathToolInfo {
        id: spec.id.clone(),
        installed: false,
        on_path: false,
        path_dir: None,
        version: None,
    }
}

/// Run the found binary with its version flag and pull the first version-looking
/// token out of stdout+stderr. Any failure (spawn error, non-zero, no match)
/// yields None — presence detection is independent of this.
fn probe_version(exe: &Path, arg: &str) -> Option<String> {
    // .cmd/.bat aren't executed directly by CreateProcess — run them via cmd /c.
    let is_script = exe
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("cmd") || e.eq_ignore_ascii_case("bat"))
        .unwrap_or(false);
    let mut cmd = if is_script {
        let mut c = Command::new("cmd");
        c.arg("/c").arg(exe).arg(arg);
        c
    } else {
        let mut c = Command::new(exe);
        c.arg(arg);
        c
    };
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let out = cmd.output().ok()?;
    let mut text = String::from_utf8_lossy(&out.stdout).into_owned();
    text.push_str(&String::from_utf8_lossy(&out.stderr));
    extract_version(&text)
}

/// First version-looking token in `s`: two or three dot-separated number groups
/// (e.g. "8.5.5", "22.1.0", "3.14", and "1.22.0" inside "go version go1.22.0").
fn extract_version(s: &str) -> Option<String> {
    let b = s.as_bytes();
    let digits = |i: &mut usize| {
        let start = *i;
        while *i < b.len() && b[*i].is_ascii_digit() {
            *i += 1;
        }
        *i > start
    };
    let mut i = 0;
    while i < b.len() {
        if !b[i].is_ascii_digit() {
            i += 1;
            continue;
        }
        let start = i;
        digits(&mut i); // first group (we know it's there)
        // need a ".<digits>" to qualify as a version
        if i < b.len() && b[i] == b'.' {
            let mut j = i + 1;
            if digits(&mut j) {
                i = j;
                // optional third group
                if i < b.len() && b[i] == b'.' {
                    let mut k = i + 1;
                    if digits(&mut k) {
                        i = k;
                    }
                }
                return Some(s[start..i].to_string());
            }
        }
        // not a version; skip this number and keep scanning
        if i == start {
            i += 1;
        }
    }
    None
}

fn path_entries() -> Vec<PathBuf> {
    std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).collect())
        .unwrap_or_default()
}

/// First of `exes` that exists as a file in `dir`, as a full path.
fn dir_find_exe(dir: &Path, exes: &[String]) -> Option<PathBuf> {
    exes.iter().map(|e| dir.join(e)).find(|p| p.is_file())
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
            version_arg: None,
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
            version_arg: None,
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
            version_arg: None,
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
            version_arg: None,
        };
        let info = probe(&s, &[]);
        assert!(info.installed && !info.on_path);
        assert_eq!(info.path_dir.as_deref(), Some(bin.to_string_lossy().as_ref()));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn not_found_is_uninstalled() {
        let info = probe(&spec("nope", &["nope.exe"], &["%FORJA_DEFINITELY_UNSET_XYZ%\\x"]), &[]);
        assert!(!info.installed && !info.on_path && info.path_dir.is_none() && info.version.is_none());
    }

    #[test]
    fn extracts_version_from_common_outputs() {
        // covers the `<exe> --version` formats of the tools we probe
        assert_eq!(extract_version("PHP 8.5.5 (cli) (built: Apr 7 2026)").as_deref(), Some("8.5.5"));
        assert_eq!(extract_version("v22.1.0\n").as_deref(), Some("22.1.0"));
        assert_eq!(extract_version("cargo 1.77.0 (3fe68ea 2024-02-29)").as_deref(), Some("1.77.0"));
        assert_eq!(extract_version("go version go1.22.0 windows/amd64").as_deref(), Some("1.22.0"));
        assert_eq!(extract_version("openjdk 21.0.1 2023-10-17").as_deref(), Some("21.0.1"));
        assert_eq!(extract_version("conda 24.1.0").as_deref(), Some("24.1.0"));
        assert_eq!(extract_version("Python 3.14").as_deref(), Some("3.14")); // two groups ok
    }

    #[test]
    fn version_ignores_lone_numbers() {
        assert_eq!(extract_version("built 2026 something"), None); // single number, no dots
        assert_eq!(extract_version("ends with 1."), None); // dot not followed by digits
        assert_eq!(extract_version("no digits here"), None);
    }
}
