// Manifest-driven catalog. The seed data lives as pure JSON in
// packages/catalog and is validated here with serde at load time.
// Mirror of packages/catalog/schema.ts — keep the two in sync.

use serde::{Deserialize, Serialize};

const CATALOG_JSON: &str = include_str!("../../../../packages/catalog/catalog.json");
const PRESETS_JSON: &str = include_str!("../../../../packages/catalog/presets.json");

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgramIcon {
    pub label: String,
    pub bg: String,
    pub fg: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Program {
    pub id: String,
    pub name: String,
    pub category: String,
    pub description: String,
    pub icon: ProgramIcon,
    #[serde(rename = "iconUrl")]
    pub icon_url: Option<String>,
    pub winget: Option<String>,
    #[serde(default)]
    pub detect: Vec<String>,
    #[serde(default)]
    pub exe: Vec<String>,
    #[serde(rename = "installDirs", default)]
    pub install_dirs: Vec<String>,
    #[serde(rename = "pathTool", default)]
    pub path_tool: bool,
    #[serde(rename = "fallbackUrl")]
    pub fallback_url: Option<String>,
    #[serde(rename = "postInstall", default)]
    pub post_install: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preset {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "programIds")]
    pub program_ids: Vec<String>,
}

/// Parse + validate the seed catalog. Returns a serde error string on failure.
#[tauri::command]
pub fn get_catalog() -> Result<Vec<Program>, String> {
    serde_json::from_str::<Vec<Program>>(CATALOG_JSON).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_presets() -> Result<Vec<Preset>, String> {
    serde_json::from_str::<Vec<Preset>>(PRESETS_JSON).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_catalog_is_valid_and_ids_unique() {
        let catalog = get_catalog().expect("catalog.json must deserialize");
        assert!(!catalog.is_empty(), "catalog should not be empty");
        let mut ids: Vec<&str> = catalog.iter().map(|p| p.id.as_str()).collect();
        ids.sort_unstable();
        let len = ids.len();
        ids.dedup();
        assert_eq!(len, ids.len(), "program ids must be unique");
    }

    #[test]
    fn presets_reference_known_ids() {
        let catalog = get_catalog().unwrap();
        let known: std::collections::HashSet<&str> =
            catalog.iter().map(|p| p.id.as_str()).collect();
        for preset in get_presets().expect("presets.json must deserialize") {
            for id in &preset.program_ids {
                assert!(
                    known.contains(id.as_str()),
                    "preset {} references unknown id {}",
                    preset.id,
                    id
                );
            }
        }
    }
}
