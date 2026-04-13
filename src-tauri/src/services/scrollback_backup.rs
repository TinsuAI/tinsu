use crate::error::AppError;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

#[derive(Debug, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ScrollbackMetadata {
    pub last_backup: i64, // Unix seconds
    pub size: u64,        // bytes
}

#[derive(Debug, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ScrollbackResult {
    pub content: Option<String>,
    pub metadata: Option<ScrollbackMetadata>,
}

pub struct ScrollbackBackup {
    base_dir: PathBuf,
}

impl ScrollbackBackup {
    pub fn new(app_data_dir: PathBuf) -> Self {
        ScrollbackBackup {
            base_dir: app_data_dir.join("tinsu").join("scrollback"),
        }
    }

    /// Validate that a task_id is safe to use as a filename component.
    fn validate_task_id(task_id: &str) -> Result<(), AppError> {
        if task_id.is_empty() || task_id.contains('/') || task_id.contains("..") {
            return Err(AppError::BadRequest(format!(
                "Invalid task_id: {}",
                task_id
            )));
        }
        // Only allow alphanumeric and hyphens (UUID format)
        if !task_id.chars().all(|c| c.is_alphanumeric() || c == '-') {
            return Err(AppError::BadRequest(format!(
                "Invalid task_id chars: {}",
                task_id
            )));
        }
        Ok(())
    }

    /// Save scrollback content for a task.
    pub fn save(&self, task_id: &str, content: &str) -> Result<(), AppError> {
        Self::validate_task_id(task_id)?;
        std::fs::create_dir_all(&self.base_dir)
            .map_err(|e| AppError::Internal(format!("create_dir_all failed: {}", e)))?;
        let path = self.base_dir.join(format!("{}.txt", task_id));
        std::fs::write(&path, content)
            .map_err(|e| AppError::Internal(format!("write scrollback failed: {}", e)))?;
        Ok(())
    }

    /// Load scrollback content for a task. Returns `ScrollbackResult` with `content: None`
    /// if the file does not exist.
    pub fn load(&self, task_id: &str) -> Result<ScrollbackResult, AppError> {
        Self::validate_task_id(task_id)?;
        let path = self.base_dir.join(format!("{}.txt", task_id));

        if !path.exists() {
            return Ok(ScrollbackResult {
                content: None,
                metadata: None,
            });
        }

        let content = std::fs::read_to_string(&path)
            .map_err(|e| AppError::Internal(format!("read scrollback failed: {}", e)))?;

        let metadata = std::fs::metadata(&path)
            .map_err(|e| AppError::Internal(format!("metadata failed: {}", e)))?;

        let last_backup = metadata
            .modified()
            .map_err(|e| AppError::Internal(format!("modified time failed: {}", e)))?
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        let size = metadata.len();

        Ok(ScrollbackResult {
            content: Some(content),
            metadata: Some(ScrollbackMetadata { last_backup, size }),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_backup() -> (ScrollbackBackup, PathBuf) {
        let tmp = std::env::temp_dir().join(format!(
            "tinsu_scrollback_test_{}",
            std::process::id()
        ));
        let backup = ScrollbackBackup::new(tmp.clone());
        (backup, tmp)
    }

    #[test]
    fn test_save_and_load_round_trip() {
        let (backup, tmp) = temp_backup();
        let task_id = "test-task-roundtrip";
        let content = "Hello\nWorld\nLine 3";

        backup.save(task_id, content).expect("save should succeed");
        let result = backup.load(task_id).expect("load should succeed");

        assert_eq!(result.content, Some(content.to_string()));
        assert!(result.metadata.is_some());
        let meta = result.metadata.unwrap();
        assert!(meta.last_backup > 0);
        assert_eq!(meta.size, content.len() as u64);

        // Cleanup
        let _ = fs::remove_dir_all(tmp);
    }

    #[test]
    fn test_load_returns_none_for_missing_file() {
        let (backup, _) = temp_backup();
        let result = backup
            .load("task-does-not-exist")
            .expect("load of missing should not error");
        assert_eq!(result.content, None);
        assert!(result.metadata.is_none());
    }

    #[test]
    fn test_validate_task_id_rejects_path_traversal() {
        let err = ScrollbackBackup::validate_task_id("../../etc/passwd");
        assert!(err.is_err());
    }

    #[test]
    fn test_validate_task_id_rejects_slash() {
        let err = ScrollbackBackup::validate_task_id("task/evil");
        assert!(err.is_err());
    }

    #[test]
    fn test_validate_task_id_accepts_uuid_format() {
        let result =
            ScrollbackBackup::validate_task_id("550e8400-e29b-41d4-a716-446655440000");
        assert!(result.is_ok());
    }
}
