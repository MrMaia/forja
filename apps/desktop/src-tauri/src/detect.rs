// Detect what's already installed (and whether an update is available) by
// parsing a single `winget list`. winget shows an "Available" column for
// packages with a pending upgrade, so one call covers both states.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

// What to look for. `exact` is the winget id; `prefixes` are extra id prefixes
// that also count as installed (e.g. any "Python.Python.*" for a pinned item).
#[derive(Debug, Clone, Deserialize)]
pub struct DetectSpec {
    pub id: String, // program id — the key echoed back in the result
    pub exact: Option<String>,
    #[serde(default)]
    pub prefixes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledInfo {
    pub id: String,                 // program id (echoed back)
    pub winget_id: Option<String>,  // the actual id winget lists — use THIS to upgrade
    pub installed: Option<String>,  // installed version, if present
    pub available: Option<String>,  // newer version available, if outdated
}

/// Look up install/upgrade state for a set of programs.
#[tauri::command]
pub async fn check_installed(
    app: AppHandle,
    specs: Vec<DetectSpec>,
) -> Result<Vec<InstalledInfo>, String> {
    let output = app
        .shell()
        .command("winget")
        .args(["list", "--accept-source-agreements"])
        .output()
        .await
        .map_err(|e| format!("falha ao consultar winget: {e}"))?;

    let text = String::from_utf8_lossy(&output.stdout);
    Ok(specs.iter().map(|s| parse_for(&text, s)).collect())
}

// winget's install id often differs from the id it reports as installed
// (e.g. install "Google.Chrome" but it lists as "Google.Chrome.EXE"; install
// "OpenJS.NodeJS.LTS" but it lists "OpenJS.NodeJS.22"). So we match the exact
// id AND any manifest prefixes as *boundary prefixes*: a token matches if it
// equals the candidate or starts with "<candidate>." — the dot boundary keeps
// "Google.Chrome" from matching "Google.ChromeRemoteDesktopHost".
fn matches(tok: &str, spec: &DetectSpec) -> bool {
    spec.exact
        .iter()
        .map(String::as_str)
        .chain(spec.prefixes.iter().map(String::as_str))
        .any(|cand| boundary_match(tok, cand))
}

fn boundary_match(tok: &str, cand: &str) -> bool {
    if tok.eq_ignore_ascii_case(cand) {
        return true;
    }
    // ids are ASCII, so byte indexing on cand.len() is safe
    tok.len() > cand.len()
        && tok.as_bytes()[cand.len()] == b'.'
        && tok[..cand.len()].eq_ignore_ascii_case(cand)
}

// Find the row whose id token matches the spec, then read version/available.
// Row shape: <name words...> <Id> <Version> [<Available>] <Source>.
// ponytail: assumes a single-token Source (winget/msstore) — true for the whole
// seed catalog. A two-word source ("Microsoft Store") would misread Available;
// upgrade path: parse by column header offsets if non-winget sources are added.
fn parse_for(text: &str, spec: &DetectSpec) -> InstalledInfo {
    for line in text.lines() {
        let toks: Vec<&str> = line.split_whitespace().collect();
        if let Some(pos) = toks.iter().position(|t| matches(t, spec)) {
            let rest = &toks[pos + 1..]; // [version, (available?), source]
            let installed = rest.first().map(|s| s.to_string());
            let available = if rest.len() >= 3 {
                Some(rest[1].to_string())
            } else {
                None
            };
            return InstalledInfo {
                id: spec.id.clone(),
                winget_id: Some(toks[pos].to_string()),
                installed,
                available,
            };
        }
    }
    InstalledInfo {
        id: spec.id.clone(),
        winget_id: None,
        installed: None,
        available: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Real-world rows: install id rarely equals the listed id.
    const SAMPLE: &str = "\
Name                        Id                              Version         Available  Source
---------------------------------------------------------------------------------------------
Git                         Git.Git                         2.44.0                     winget
Node.js                     OpenJS.NodeJS.22                22.20.0         22.23.1    winget
Google Chrome               Google.Chrome.EXE               149.0.7827.198             winget
Chrome Remote Desktop Host  Google.ChromeRemoteDesktopHost  150.0.7871.19              winget
Python Launcher             Python.Launcher                 3.13.5                     winget
Python 3.14.0 (64-bit)      Python.Python.3.14              3.14.0          3.14.6     winget";

    fn spec(id: &str, exact: &str, prefixes: &[&str]) -> DetectSpec {
        DetectSpec {
            id: id.to_string(),
            exact: Some(exact.to_string()),
            prefixes: prefixes.iter().map(|s| s.to_string()).collect(),
        }
    }

    #[test]
    fn exact_id_matches_and_reads_available() {
        let cur = parse_for(SAMPLE, &spec("git", "Git.Git", &[]));
        assert_eq!(cur.installed.as_deref(), Some("2.44.0"));
        assert_eq!(cur.available, None);
    }

    #[test]
    fn install_id_boundary_matches_listed_suffix() {
        // installs "Google.Chrome", listed as "Google.Chrome.EXE"
        let chrome = parse_for(SAMPLE, &spec("chrome", "Google.Chrome", &[]));
        assert_eq!(chrome.installed.as_deref(), Some("149.0.7827.198"));
        // and must NOT match Google.ChromeRemoteDesktopHost
        assert_ne!(chrome.installed.as_deref(), Some("150.0.7871.19"));
    }

    #[test]
    fn prefix_matches_other_minor_and_reads_upgrade() {
        // installs "OpenJS.NodeJS.LTS", listed as "OpenJS.NodeJS.22"
        let node = parse_for(SAMPLE, &spec("nodejs", "OpenJS.NodeJS.LTS", &["OpenJS.NodeJS"]));
        assert_eq!(node.installed.as_deref(), Some("22.20.0"));
        assert_eq!(node.available.as_deref(), Some("22.23.1"));

        // python prefix matches 3.14 row, not Python.Launcher
        let py = parse_for(SAMPLE, &spec("python", "Python.Python.3.13", &["Python.Python"]));
        assert_eq!(py.installed.as_deref(), Some("3.14.0"));
        assert_eq!(py.available.as_deref(), Some("3.14.6"));
    }

    #[test]
    fn missing_is_none() {
        let missing = parse_for(SAMPLE, &spec("nope", "Not.Here", &[]));
        assert_eq!(missing.installed, None);
    }
}
