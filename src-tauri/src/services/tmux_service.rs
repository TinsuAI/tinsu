use crate::error::AppError;

pub struct TmuxService;

impl TmuxService {
    pub fn new() -> Self {
        TmuxService
    }

    /// Create a new tmux session (idempotent — reuses if already exists).
    pub fn create_session(&self, name: &str, cwd: &str) -> Result<(), AppError> {
        let output = std::process::Command::new("tmux")
            .args(["new-session", "-d", "-s", name, "-c", cwd])
            .output()
            .map_err(|e| AppError::Internal(format!("tmux exec error: {}", e)))?;

        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("duplicate session") {
            // Session already exists — idempotent success
            return Ok(());
        }

        Err(AppError::Internal(format!(
            "tmux new-session failed: {}",
            stderr
        )))
    }

    /// Kill a tmux session (idempotent — ignores "no server" and "can't find session" errors).
    pub fn kill_session(&self, name: &str) -> Result<(), AppError> {
        let output = std::process::Command::new("tmux")
            .args(["kill-session", "-t", name])
            .output()
            .map_err(|e| AppError::Internal(format!("tmux exec error: {}", e)))?;

        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("no server running")
            || stderr.contains("can't find session")
            || stderr.contains("session not found")
        {
            return Ok(());
        }

        Err(AppError::Internal(format!(
            "tmux kill-session failed: {}",
            stderr
        )))
    }

    /// Check whether a tmux session exists.
    pub fn has_session(&self, name: &str) -> bool {
        std::process::Command::new("tmux")
            .args(["has-session", "-t", name])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    /// Send keys to a tmux session.
    pub fn send_keys(&self, name: &str, keys: &str) -> Result<(), AppError> {
        let output = std::process::Command::new("tmux")
            .args(["send-keys", "-t", name, keys, "Enter"])
            .output()
            .map_err(|e| AppError::Internal(format!("tmux exec error: {}", e)))?;

        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(AppError::Internal(format!(
            "tmux send-keys failed: {}",
            stderr
        )))
    }

    /// List all tmux session names. Returns an empty Vec if tmux is not running.
    pub fn list_sessions(&self) -> Vec<String> {
        let output = std::process::Command::new("tmux")
            .args(["list-sessions", "-F", "#{session_name}"])
            .output();

        match output {
            Ok(o) if o.status.success() => {
                let stdout = String::from_utf8_lossy(&o.stdout);
                stdout
                    .lines()
                    .filter(|l| !l.is_empty())
                    .map(|l| l.to_string())
                    .collect()
            }
            _ => vec![],
        }
    }

    /// Capture current pane output (for stall detection).
    pub fn capture_pane(&self, session_name: &str) -> String {
        let output = std::process::Command::new("tmux")
            .args(["capture-pane", "-p", "-t", session_name])
            .output();

        match output {
            Ok(o) if o.status.success() => {
                String::from_utf8_lossy(&o.stdout).to_string()
            }
            _ => String::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_has_session_returns_false_for_nonexistent() {
        let svc = TmuxService::new();
        // A UUID-like name that certainly won't exist
        let result = svc.has_session("tinsu-test-nonexistent-xxxxxxxx-99999");
        assert!(!result, "has_session should return false for non-existent session");
    }

    #[test]
    fn test_list_sessions_returns_vec_when_tmux_unavailable() {
        // Even if tmux is available, this should return a Vec (possibly empty).
        // If tmux is not available, it also returns empty vec.
        // Primary purpose: verify no panic occurs.
        let svc = TmuxService::new();
        let _sessions: Vec<String> = svc.list_sessions(); // type check + no-panic verification
    }

    #[test]
    fn test_kill_session_is_idempotent_for_nonexistent() {
        let svc = TmuxService::new();
        // Killing a non-existent session should succeed (idempotent)
        let result = svc.kill_session("tinsu-test-nonexistent-xxxxxxxx-99999");
        assert!(result.is_ok(), "kill_session of non-existent session should be Ok");
    }
}
