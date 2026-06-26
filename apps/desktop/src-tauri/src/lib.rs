mod catalog;
mod detect;
mod hardware;
mod install;
mod pathtools;
mod tweaks;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            catalog::get_catalog,
            catalog::get_presets,
            install::install_programs,
            detect::check_installed,
            pathtools::check_path_tools,
            pathtools::add_to_user_path,
            hardware::detect_network,
            tweaks::read_tweaks,
            tweaks::apply_user_tweak,
            tweaks::apply_admin_tweaks,
            tweaks::restart_explorer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Forja");
}
