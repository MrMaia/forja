// Detect what's already installed (and whether an update is available) by
// parsing a single `winget list`. winget shows an "Available" column for
// packages with a pending upgrade, so one call covers both states.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

// What to look for. `exact` is the winget id; `prefixes` are extra id prefixes
// that also count as installed (e.g. any "Python.Python.*" for a pinned item);
// `names` are display names that count as installed when the package was installed
// outside winget (its id then shows as an opaque "ARP\..." moniker — see below).
#[derive(Debug, Clone, Deserialize)]
pub struct DetectSpec {
    pub id: String, // program id — the key echoed back in the result
    pub exact: Option<String>,
    #[serde(default)]
    pub prefixes: Vec<String>,
    #[serde(default)]
    pub names: Vec<String>,
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
fn matches(id: &str, spec: &DetectSpec) -> bool {
    spec.exact
        .iter()
        .map(String::as_str)
        .chain(spec.prefixes.iter().map(String::as_str))
        .any(|cand| boundary_match(id, cand))
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

// winget's Id column comes in three shapes:
//   1. "Git.Git"                          — installed via winget (upgradeable by id)
//   2. "MSIX\Microsoft.PowerToys.Spar…"   — Store/MSIX package; real id follows the "\"
//   3. "ARP\Machine\X64\{GUID}"           — installed OUTSIDE winget; id is an opaque
//                                           moniker, so the only handle is the name
// Strip everything up to the last "\" so MSIX rows match by id; ARP monikers fall
// through to name matching.
fn strip_source_prefix(id: &str) -> &str {
    match id.rfind('\\') {
        Some(pos) => &id[pos + 1..],
        None => id,
    }
}

// A clean winget id (no "\" moniker) is the only one we can hand back to
// `winget upgrade --id`. MSIX/ARP installs aren't upgradeable that way.
fn winget_managed(raw_id: &str) -> bool {
    !raw_id.contains('\\')
}

// winget pins the version column with a leading "<"/">" marker when it can't read
// the exact version (e.g. "> 3.13.5"). Drop the marker.
fn clean_version(v: &str) -> String {
    v.trim_start_matches(['<', '>', ' ']).trim().to_string()
}

fn is_source(s: &str) -> bool {
    matches!(s.to_ascii_lowercase().as_str(), "winget" | "msstore" | "msix")
}

// Split a winget list row into columns. winget separates columns with runs of
// 2+ spaces, while names themselves keep single spaces ("Python 3.14.6 (64-bit)").
// Splitting on 2+ spaces is far more robust than split_whitespace, which would
// shred multi-word names.
fn columns(line: &str) -> Vec<String> {
    let mut cols = Vec::new();
    let mut cur = String::new();
    let mut spaces = 0usize;
    for ch in line.chars() {
        if ch == ' ' {
            spaces += 1;
        } else {
            if spaces >= 2 && !cur.is_empty() {
                cols.push(cur.trim().to_string());
                cur.clear();
            } else if spaces == 1 && !cur.is_empty() {
                cur.push(' ');
            }
            spaces = 0;
            cur.push(ch);
        }
    }
    if !cur.trim().is_empty() {
        cols.push(cur.trim().to_string());
    }
    cols
}

fn name_matches(name: &str, spec: &DetectSpec) -> bool {
    let n = name.to_ascii_lowercase();
    spec.names.iter().any(|cand| {
        let c = cand.to_ascii_lowercase();
        n == c || n.starts_with(&format!("{c} "))
    })
}

// Read the "Available" (pending upgrade) version, accounting for rows that omit
// it. Columns: [Name, Id, Version, (Available?), (Source?)].
fn available_col(cols: &[String]) -> Option<String> {
    match cols.len() {
        5 => Some(clean_version(&cols[3])),
        // 4 columns: the 4th is either Source (no upgrade) or Available (no source).
        4 if !is_source(&cols[3]) => Some(clean_version(&cols[3])),
        _ => None,
    }
}

// Find the row matching the spec (by id, or by name for non-winget installs),
// then read version/available from its columns.
fn parse_for(text: &str, spec: &DetectSpec) -> InstalledInfo {
    for line in text.lines() {
        let cols = columns(line);
        if cols.len() < 2 {
            continue;
        }
        let raw_id = &cols[1];
        let id = strip_source_prefix(raw_id);
        let by_id = matches(id, spec);
        let by_name = !by_id && name_matches(&cols[0], spec);
        if by_id || by_name {
            let installed = cols.get(2).map(|v| clean_version(v));
            return InstalledInfo {
                id: spec.id.clone(),
                // only winget-managed installs can be upgraded by id
                winget_id: if winget_managed(raw_id) {
                    Some(raw_id.clone())
                } else {
                    None
                },
                installed,
                available: available_col(&cols),
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

    // Real-world rows: install id rarely equals the listed id. The last two are
    // straight from a live machine — Node installed via the official .msi (ARP
    // moniker) and PowerToys from the Microsoft Store (MSIX), the exact cases
    // that used to go undetected.
    const SAMPLE: &str = "\
Name                                  Id                                       Version         Available  Source
-------------------------------------------------------------------------------------------------------------
Git                                   Git.Git                                  2.44.0                     winget
Node.js                               OpenJS.NodeJS.22                         22.20.0         22.23.1    winget
Google Chrome                         Google.Chrome.EXE                        149.0.7827.198             winget
Chrome Remote Desktop Host            Google.ChromeRemoteDesktopHost           150.0.7871.19              winget
Python Launcher                       Python.Launcher                          > 3.13.5                   winget
Python 3.14.0 (64-bit)                Python.Python.3.14                       3.14.0          3.14.6     winget
DBeaver 26.1.1 (current user)         DBeaver.DBeaver.Community                26.1.1                     winget
Node.js                               ARP\\Machine\\X64\\{47D89795-2EFC-4BC5}  24.14.0
PowerToys FileLocksmith Context Menu  MSIX\\Microsoft.PowerToys.FileLocksmith  0.100.1.0";

    fn spec(id: &str, exact: &str, prefixes: &[&str]) -> DetectSpec {
        DetectSpec {
            id: id.to_string(),
            exact: Some(exact.to_string()),
            prefixes: prefixes.iter().map(|s| s.to_string()).collect(),
            names: Vec::new(),
        }
    }

    fn spec_named(id: &str, exact: &str, names: &[&str]) -> DetectSpec {
        DetectSpec {
            id: id.to_string(),
            exact: Some(exact.to_string()),
            prefixes: Vec::new(),
            names: names.iter().map(|s| s.to_string()).collect(),
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

    #[test]
    fn store_msix_package_matches_after_prefix_strip() {
        // PowerToys from the Microsoft Store lists as "MSIX\Microsoft.PowerToys.*".
        let pt = parse_for(SAMPLE, &spec("powertoys", "Microsoft.PowerToys", &[]));
        assert_eq!(pt.installed.as_deref(), Some("0.100.1.0"));
        // MSIX installs aren't upgradeable via `winget upgrade --id`.
        assert_eq!(pt.winget_id, None);
        assert_eq!(pt.available, None);
    }

    #[test]
    fn non_winget_install_matches_by_name() {
        // Node installed via the official .msi: id is an opaque ARP moniker, so
        // the only handle is the display name. Use a sample without a winget Node
        // row so the ARP row is the only candidate.
        const ARP_ONLY: &str = "\
Name      Id                                       Version    Available  Source
Node.js   ARP\\Machine\\X64\\{47D89795-2EFC-4BC5}  24.14.0";
        let node = parse_for(ARP_ONLY, &spec_named("nodejs", "OpenJS.NodeJS.LTS", &["Node.js"]));
        assert_eq!(node.installed.as_deref(), Some("24.14.0"));
        // not winget-managed -> no upgrade offer
        assert_eq!(node.winget_id, None);
        assert_eq!(node.available, None);
    }

    #[test]
    fn name_match_does_not_false_positive() {
        // "Git" must not match "GitHub CLI" / "GitHub Desktop" by name.
        const ROWS: &str = "\
Name            Id            Version  Available  Source
GitHub CLI      GitHub.cli    2.90.0              winget
GitHub Desktop  GitHub.Desk   3.6.1               winget";
        let git = parse_for(ROWS, &spec_named("git", "Git.Git", &["Git"]));
        assert_eq!(git.installed, None);
    }

    #[test]
    fn pinned_version_marker_is_stripped() {
        // winget writes "> 3.13.5" when the version is pinned/uncertain.
        let py = parse_for(SAMPLE, &spec("pylauncher", "Python.Launcher", &[]));
        assert_eq!(py.installed.as_deref(), Some("3.13.5"));
    }

    #[test]
    fn clean_winget_id_is_upgradeable() {
        let git = parse_for(SAMPLE, &spec("git", "Git.Git", &[]));
        assert_eq!(git.winget_id.as_deref(), Some("Git.Git"));
    }

    #[test]
    fn store_powertoys_detected_by_name() {
        // Real machine: the main entry is "PowerToys (Preview) x64" from msstore,
        // plus MSIX context-menu sub-packages. Detect via the display name.
        const ROWS: &str = "\
Name                                  Id                                       Version    Available  Source
PowerToys (Preview) x64               XP89DCGQ3K6VLD                           0.100.2               msstore
PowerToys FileLocksmith Context Menu  MSIX\\Microsoft.PowerToys.FileLocksmithC  0.100.2.0";
        let pt = parse_for(ROWS, &spec_named("powertoys", "Microsoft.PowerToys", &["PowerToys"]));
        assert_eq!(pt.installed.as_deref(), Some("0.100.2"));
    }
}
