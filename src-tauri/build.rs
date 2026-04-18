fn main() {
    // Tauri CLI bakes the detected LAN IP (e.g. 172.18.10.79) into both
    // TAURI_CONFIG and the Android asset tauri.conf.json. We patch both to
    // localhost so the ADB reverse tunnel (adb reverse tcp:5173 tcp:5173) works.
    if std::env::var("TAURI_ENV_TARGET_TRIPLE")
        .unwrap_or_default()
        .contains("android")
    {
        // Patch TAURI_CONFIG env var
        if let Ok(config) = std::env::var("TAURI_CONFIG") {
            let patched = patch_dev_url(&config);
            unsafe { std::env::set_var("TAURI_CONFIG", patched) };
        }

        // Patch the Android asset file that Gradle will bundle into the APK
        let asset_conf = std::path::Path::new("gen/android/app/src/main/assets/tauri.conf.json");
        if asset_conf.exists() {
            if let Ok(contents) = std::fs::read_to_string(asset_conf) {
                let patched = patch_dev_url(&contents);
                let _ = std::fs::write(asset_conf, patched);
            }
        }
    }

    tauri_build::build()
}

fn patch_dev_url(config: &str) -> String {
    let needle = "\"devUrl\":\"http://";
    if let Some(start) = config.find(needle) {
        let host_start = start + needle.len();
        if let Some(end_offset) = config[host_start..].find('"') {
            let full_url = &config[host_start..host_start + end_offset];
            let patched_url = if let Some(colon) = full_url.find(':') {
                format!("localhost{}", &full_url[colon..])
            } else {
                "localhost".to_string()
            };
            return format!(
                "{}{}\"{}",
                &config[..host_start],
                patched_url,
                &config[host_start + end_offset + 1..]
            );
        }
    }
    config.to_string()
}
