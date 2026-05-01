use serde::{Deserialize, Serialize};
use specta::Type;

use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct BmadStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub modules: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct BmadInstallInput {
    pub project_path: String,
    pub modules: Vec<String>,
    pub tools: Vec<String>,
    pub user_name: String,
    pub communication_language: String,
    pub document_output_language: String,
    pub output_folder: Option<String>,
}

/// Returns BMAD installation status by reading _bmad/_config/manifest.yaml.
#[tauri::command]
#[specta::specta]
pub async fn bmad_check_status(project_path: String) -> Result<BmadStatus, AppError> {
    let manifest_path = std::path::Path::new(&project_path)
        .join("_bmad")
        .join("_config")
        .join("manifest.yaml");

    if !manifest_path.exists() {
        return Ok(BmadStatus {
            installed: false,
            version: None,
            modules: None,
        });
    }

    let content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| AppError::Internal(format!("Failed to read BMAD manifest: {}", e)))?;

    // Pull top-level version (first `version:` line)
    let version = content
        .lines()
        .find(|l| {
            let t = l.trim();
            t.starts_with("version:") && !t.contains("null")
        })
        .and_then(|l| l.split(':').nth(1))
        .map(|v| v.trim().to_string());

    // Collect module names
    let mut modules: Vec<String> = Vec::new();
    let mut in_modules = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "modules:" {
            in_modules = true;
            continue;
        }
        if in_modules {
            if let Some(stripped) = trimmed.strip_prefix("- name:") {
                modules.push(stripped.trim().to_string());
            } else if !trimmed.starts_with('-')
                && !trimmed.starts_with(' ')
                && !trimmed.is_empty()
                && !trimmed.starts_with('#')
            {
                // Top-level key — we've left the modules list
                in_modules = false;
            }
        }
    }

    Ok(BmadStatus {
        installed: true,
        version,
        modules: if modules.is_empty() { None } else { Some(modules) },
    })
}

/// Runs `npx bmad-method install` with the given options.
#[tauri::command]
#[specta::specta]
pub async fn bmad_install_to_path(input: BmadInstallInput) -> Result<(), AppError> {
    let modules_str = input.modules.join(",");
    let tools_str = if input.tools.is_empty() {
        "none".to_string()
    } else {
        input.tools.join(",")
    };

    let mut cmd = std::process::Command::new("npx");
    cmd.arg("--yes")
        .arg("bmad-method")
        .arg("install")
        .arg("--directory")
        .arg(&input.project_path)
        .arg("--modules")
        .arg(&modules_str)
        .arg("--tools")
        .arg(&tools_str)
        .arg("--user-name")
        .arg(&input.user_name)
        .arg("--communication-language")
        .arg(&input.communication_language)
        .arg("--document-output-language")
        .arg(&input.document_output_language);

    if let Some(ref folder) = input.output_folder {
        cmd.arg("--output-folder").arg(folder);
    }

    let output = cmd
        .arg("--yes")
        .output()
        .map_err(|e| AppError::Internal(format!("Failed to run bmad-method: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(AppError::Internal(format!(
            "bmad-method install failed:\n{}\n{}",
            stdout, stderr
        )));
    }

    Ok(())
}

/// Attempts to install Node.js via the platform package manager.
#[tauri::command]
#[specta::specta]
pub async fn install_nodejs() -> Result<(), AppError> {
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("brew")
            .args(["install", "node"])
            .output()
            .map_err(|_| {
                AppError::Internal(
                    "Homebrew not found. Install Node.js from https://nodejs.org".to_string(),
                )
            })?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Internal(format!(
                "brew install node failed: {}",
                stderr
            )));
        }
    }
    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("sudo")
            .args(["apt", "install", "-y", "nodejs", "npm"])
            .output()
            .map_err(|_| {
                AppError::Internal(
                    "apt not found. Install Node.js from https://nodejs.org".to_string(),
                )
            })?;
        if !output.status.success() {
            return Err(AppError::Internal(
                "Failed to install Node.js. Install manually from https://nodejs.org".to_string(),
            ));
        }
    }
    #[cfg(target_os = "windows")]
    {
        return Err(AppError::Internal(
            "Auto-install not supported on Windows. Install Node.js from https://nodejs.org"
                .to_string(),
        ));
    }
    Ok(())
}
