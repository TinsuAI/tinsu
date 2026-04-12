use crate::error::AppError;
use portable_pty::{CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tauri::ipc::Channel;

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct PtyExitPayload {
    pub process_id: String,
    pub task_id: Option<String>,
    pub exit_code: i32,
}

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
    task_id: Option<String>,
}

pub struct PtyService {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyService {
    pub fn new() -> Self {
        PtyService {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Spawn a new PTY process. The PTY reader loop runs on a dedicated OS thread
    /// (never in async context) to avoid blocking the Tokio executor.
    pub async fn spawn(
        &self,
        process_id: &str,
        cmd: &str,
        args: &[&str],
        cwd: &str,
        cols: u16,
        rows: u16,
        task_id: Option<String>,
        app_handle: &AppHandle,
        on_data: Channel<Vec<u8>>,
    ) -> Result<(), AppError> {
        let pty_system = NativePtySystem::default();
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pty_pair = pty_system
            .openpty(size)
            .map_err(|e| AppError::Internal(format!("openpty failed: {}", e)))?;

        // Clone reader BEFORE taking writer (order matters for portable-pty API)
        let mut reader = pty_pair
            .master
            .try_clone_reader()
            .map_err(|e| AppError::Internal(format!("clone reader failed: {}", e)))?;

        let writer = pty_pair
            .master
            .take_writer()
            .map_err(|e| AppError::Internal(format!("take writer failed: {}", e)))?;

        let mut cmd_builder = CommandBuilder::new(cmd);
        for arg in args {
            cmd_builder.arg(arg);
        }
        cmd_builder.cwd(cwd);

        let child = pty_pair
            .slave
            .spawn_command(cmd_builder)
            .map_err(|e| AppError::Internal(format!("spawn_command failed: {}", e)))?;

        let session = PtySession {
            master: pty_pair.master,
            writer,
            child,
            task_id: task_id.clone(),
        };

        {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|e| AppError::Internal(format!("lock poisoned: {}", e)))?;
            sessions.insert(process_id.to_string(), session);
        }

        // Spawn OS thread for blocking PTY read loop
        let sessions_clone = Arc::clone(&self.sessions);
        let process_id_clone = process_id.to_string();
        let app_clone = app_handle.clone();

        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        if on_data.send(buf[..n].to_vec()).is_err() {
                            break; // Channel closed (frontend navigated away)
                        }
                    }
                }
            }

            // PTY EOF — emit exit event
            let task_id_on_exit = sessions_clone
                .lock()
                .ok()
                .and_then(|s| s.get(&process_id_clone).and_then(|s| s.task_id.clone()));

            let _ = app_clone.emit(
                "pty:exit",
                PtyExitPayload {
                    process_id: process_id_clone.clone(),
                    task_id: task_id_on_exit,
                    exit_code: 0,
                },
            );

            // Remove from sessions map
            if let Ok(mut sessions) = sessions_clone.lock() {
                sessions.remove(&process_id_clone);
            }
        });

        Ok(())
    }

    /// Write data to a PTY process.
    pub fn write(&self, process_id: &str, data: &[u8]) -> Result<(), AppError> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|e| AppError::Internal(format!("lock poisoned: {}", e)))?;

        let session = sessions
            .get_mut(process_id)
            .ok_or_else(|| AppError::NotFound(format!("PTY process not found: {}", process_id)))?;

        session
            .writer
            .write_all(data)
            .map_err(|e| AppError::Internal(format!("write failed: {}", e)))?;

        session
            .writer
            .flush()
            .map_err(|e| AppError::Internal(format!("flush failed: {}", e)))?;

        Ok(())
    }

    /// Resize a PTY process.
    pub fn resize(&self, process_id: &str, cols: u16, rows: u16) -> Result<(), AppError> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|e| AppError::Internal(format!("lock poisoned: {}", e)))?;

        let session = sessions
            .get(process_id)
            .ok_or_else(|| AppError::NotFound(format!("PTY process not found: {}", process_id)))?;

        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| AppError::Internal(format!("resize failed: {}", e)))?;

        Ok(())
    }

    /// Kill a PTY process (idempotent — logs warning if not found).
    pub fn kill(&self, process_id: &str) -> Result<(), AppError> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|e| AppError::Internal(format!("lock poisoned: {}", e)))?;

        let session = match sessions.remove(process_id) {
            Some(s) => s,
            None => {
                tracing::warn!("kill called on unknown process_id: {}", process_id);
                return Ok(()); // Idempotent
            }
        };

        let mut child = session.child;
        child
            .kill()
            .map_err(|e| AppError::Internal(format!("kill failed: {}", e)))?;

        Ok(())
    }

    /// List process IDs that belong to a given task_id.
    pub fn list_by_task_id(&self, task_id: &str) -> Vec<String> {
        self.sessions
            .lock()
            .map(|sessions| {
                sessions
                    .iter()
                    .filter(|(_, s)| s.task_id.as_deref() == Some(task_id))
                    .map(|(id, _)| id.clone())
                    .collect()
            })
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pty_exit_payload_serialization() {
        let payload = PtyExitPayload {
            process_id: "test-proc-123".to_string(),
            task_id: Some("task-456".to_string()),
            exit_code: 0,
        };

        let json = serde_json::to_string(&payload).expect("serialization should succeed");
        assert!(json.contains("test-proc-123"));
        assert!(json.contains("task-456"));
        assert!(json.contains("exit_code"));

        let deserialized: PtyExitPayload =
            serde_json::from_str(&json).expect("deserialization should succeed");
        assert_eq!(deserialized.process_id, "test-proc-123");
        assert_eq!(deserialized.task_id, Some("task-456".to_string()));
        assert_eq!(deserialized.exit_code, 0);
    }

    #[test]
    fn test_pty_exit_payload_serialization_null_task_id() {
        let payload = PtyExitPayload {
            process_id: "proc-1".to_string(),
            task_id: None,
            exit_code: 1,
        };

        let json = serde_json::to_string(&payload).expect("serialization should succeed");
        let deserialized: PtyExitPayload =
            serde_json::from_str(&json).expect("deserialization should succeed");
        assert_eq!(deserialized.task_id, None);
        assert_eq!(deserialized.exit_code, 1);
    }

    #[test]
    fn test_session_map_operations() {
        // Test that PtyService can be constructed and initial state is empty
        let svc = PtyService::new();
        let sessions = svc.sessions.lock().unwrap();
        assert!(sessions.is_empty(), "sessions map should start empty");
    }

    #[test]
    fn test_write_returns_not_found_for_unknown_process() {
        let svc = PtyService::new();
        let result = svc.write("nonexistent-process-id", b"hello");
        assert!(result.is_err());
        matches!(result.unwrap_err(), AppError::NotFound(_));
    }

    #[test]
    fn test_resize_returns_not_found_for_unknown_process() {
        let svc = PtyService::new();
        let result = svc.resize("nonexistent-process-id", 80, 24);
        assert!(result.is_err());
        matches!(result.unwrap_err(), AppError::NotFound(_));
    }

    #[test]
    fn test_kill_is_idempotent_for_unknown_process() {
        let svc = PtyService::new();
        // killing an unknown process should be Ok (idempotent)
        let result = svc.kill("nonexistent-process-id");
        assert!(result.is_ok(), "kill of unknown process should be Ok");
    }

    #[test]
    fn test_list_by_task_id_empty_when_no_sessions() {
        let svc = PtyService::new();
        let ids = svc.list_by_task_id("some-task");
        assert!(ids.is_empty());
    }
}
