use crate::error::AppError;
use std::time::Duration;
use tokio::time::timeout;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct BranchStatus {
    pub commits_ahead: i64,
    pub commits_behind: i64,
    pub has_uncommitted_changes: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffLine {
    #[serde(rename = "type")]
    pub line_type: String, // "context" | "add" | "remove"
    pub content: String,
    pub old_line_no: Option<i32>,
    pub new_line_no: Option<i32>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffHunk {
    pub header: String,
    pub old_start: i32,
    pub old_lines: i32,
    pub new_start: i32,
    pub new_lines: i32,
    pub lines: Vec<GitDiffLine>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffFile {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String, // "added" | "modified" | "deleted" | "renamed"
    pub is_binary: Option<bool>,
    pub additions: i32,
    pub deletions: i32,
    pub hunks: Vec<GitDiffHunk>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffSummary {
    pub files_changed: i32,
    pub lines_added: i32,
    pub lines_removed: i32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct GitDiffResult {
    pub files: Vec<GitDiffFile>,
    pub summary: GitDiffSummary,
}

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ConflictDetectionResult {
    pub has_conflicts: bool,
    pub conflict_files: Vec<String>,
}

// ─── GitService ───────────────────────────────────────────────────────────────

pub struct GitService;

impl GitService {
    /// Execute a git command in a given directory with a timeout.
    pub async fn exec_git(args: &[&str], cwd: &str, timeout_secs: u64) -> Result<String, AppError> {
        // Basic injection guard: cwd must not contain null bytes
        if cwd.contains('\0') {
            return Err(AppError::BadRequest(
                "cwd contains null bytes".to_string(),
            ));
        }

        let mut cmd = tokio::process::Command::new("git");
        cmd.args(args).current_dir(cwd);

        let fut = cmd.output();
        let output = timeout(Duration::from_secs(timeout_secs), fut)
            .await
            .map_err(|_| {
                AppError::GitOperation(format!(
                    "{} timed out after {}s",
                    args.join(" "),
                    timeout_secs
                ))
            })?
            .map_err(|e| AppError::GitOperation(format!("spawn error: {}", e)))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            // Include both stdout and stderr: git merge writes CONFLICT lines to stdout
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let combined = format!("{}{}", stdout, stderr);
            let code = output.status.code().unwrap_or(-1);
            Err(AppError::GitOperation(format!(
                "{} (exit {}): {}",
                args.join(" "),
                code,
                combined.trim()
            )))
        }
    }

    /// Generate a branch name from task_id and title.
    /// Format: `tinsu/story-{task_id}-{slug}` where slug is max 40 chars.
    pub fn generate_branch_name(task_id: &str, title: &str) -> String {
        let slug = title
            .to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '-' })
            .collect::<String>()
            .split('-')
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join("-");

        let max_len = 40.min(slug.len());
        let truncated = slug[..max_len].trim_end_matches('-').to_string();

        format!("tinsu/story-{}-{}", task_id, truncated)
    }

    /// Create a git worktree for a task. Idempotent — returns existing path if already created.
    pub async fn create_worktree(
        &self,
        project_path: &str,
        task_id: &str,
        title: &str,
    ) -> Result<(String, String), AppError> {
        let branch_name = Self::generate_branch_name(task_id, title);
        let worktree_path = format!("{project_path}/.tinsu/worktrees/{task_id}");

        // Idempotent: if worktree already exists, return existing paths
        if std::fs::metadata(&worktree_path).is_ok() {
            return Ok((worktree_path, branch_name));
        }

        // Create parent directory
        let parent = format!("{project_path}/.tinsu/worktrees");
        std::fs::create_dir_all(&parent)?;

        // Create the worktree with a new branch based on main
        let result = Self::exec_git(
            &["worktree", "add", "-b", &branch_name, &worktree_path, "main"],
            project_path,
            30,
        )
        .await;

        match result {
            Ok(_) => {
                // Ensure .tinsu/worktrees/ is in .gitignore
                Self::ensure_worktrees_ignored(project_path);
                Ok((worktree_path, branch_name))
            }
            Err(e) => {
                // Clean up any stale worktree references
                let _ = Self::exec_git(&["worktree", "prune"], project_path, 5).await;
                Err(e)
            }
        }
    }

    /// Remove a git worktree. Idempotent — ignores errors if worktree is already gone.
    pub async fn remove_worktree(
        &self,
        project_path: &str,
        worktree_path: &str,
    ) -> Result<(), AppError> {
        // If path no longer exists, nothing to do
        if std::fs::metadata(worktree_path).is_err() {
            let _ = Self::exec_git(&["worktree", "prune"], project_path, 5).await;
            return Ok(());
        }

        let _ = Self::exec_git(
            &["worktree", "remove", "--force", worktree_path],
            project_path,
            10,
        )
        .await;

        // Always prune stale references
        let _ = Self::exec_git(&["worktree", "prune"], project_path, 5).await;
        Ok(())
    }

    /// Get the diff between main and HEAD in a worktree.
    pub async fn get_diff(&self, worktree_path: &str) -> Result<GitDiffResult, AppError> {
        // Get unified diff for hunk parsing
        let unified = match Self::exec_git(&["diff", "main...HEAD"], worktree_path, 30).await {
            Ok(s) => s,
            Err(_) => String::new(),
        };

        // Get name-status for renames and deletions
        let name_status =
            match Self::exec_git(&["diff", "--name-status", "main...HEAD"], worktree_path, 10)
                .await
            {
                Ok(s) => s,
                Err(_) => String::new(),
            };

        if unified.is_empty() {
            return Ok(GitDiffResult {
                files: vec![],
                summary: GitDiffSummary {
                    files_changed: 0,
                    lines_added: 0,
                    lines_removed: 0,
                },
            });
        }

        let files = parse_unified_diff(&unified, &name_status);
        let lines_added: i32 = files.iter().map(|f| f.additions).sum();
        let lines_removed: i32 = files.iter().map(|f| f.deletions).sum();
        let files_changed = files.len() as i32;

        Ok(GitDiffResult {
            summary: GitDiffSummary {
                files_changed,
                lines_added,
                lines_removed,
            },
            files,
        })
    }

    /// Get the branch status (commits ahead/behind main, uncommitted changes).
    ///
    /// `worktree_path`: path to the feature branch worktree for uncommitted-change detection.
    /// Falls back to `project_path` if `None`.
    pub async fn get_branch_status(
        &self,
        project_path: &str,
        branch_name: &str,
        worktree_path: Option<&str>,
    ) -> Result<BranchStatus, AppError> {
        let ahead_str = Self::exec_git(
            &[
                "rev-list",
                "--count",
                &format!("main..{}", branch_name),
            ],
            project_path,
            5,
        )
        .await
        .unwrap_or_default();

        let behind_str = Self::exec_git(
            &[
                "rev-list",
                "--count",
                &format!("{}..main", branch_name),
            ],
            project_path,
            5,
        )
        .await
        .unwrap_or_default();

        // Run status check in the worktree, not the main repo, to detect
        // uncommitted changes in the feature branch's working directory.
        let status_cwd = worktree_path.unwrap_or(project_path);
        let status_output = Self::exec_git(
            &["status", "--porcelain"],
            status_cwd,
            5,
        )
        .await
        .unwrap_or_default();

        let commits_ahead = ahead_str.trim().parse::<i64>().unwrap_or(0);
        let commits_behind = behind_str.trim().parse::<i64>().unwrap_or(0);
        let has_uncommitted_changes = !status_output.trim().is_empty();

        Ok(BranchStatus {
            commits_ahead,
            commits_behind,
            has_uncommitted_changes,
        })
    }

    /// Detect merge conflicts via dry-run merge. Returns list of conflicting files.
    pub async fn detect_merge_conflicts(
        &self,
        project_path: &str,
        branch_name: &str,
    ) -> Result<Vec<String>, AppError> {
        let result = Self::exec_git(
            &["merge", "--no-commit", "--no-ff", branch_name],
            project_path,
            30,
        )
        .await;

        match result {
            Ok(_) => {
                // Merge staging succeeded with no conflicts — abort
                let _ = Self::exec_git(&["merge", "--abort"], project_path, 5).await;
                Ok(vec![])
            }
            Err(AppError::GitOperation(ref msg)) if msg.contains("CONFLICT") => {
                // Parse conflict files from the error output
                let conflict_files = msg
                    .lines()
                    .filter(|line| line.contains("CONFLICT (content): Merge conflict in "))
                    .map(|line| {
                        line.trim_start_matches("CONFLICT (content): Merge conflict in ")
                            .trim()
                            .to_string()
                    })
                    .collect();
                let _ = Self::exec_git(&["merge", "--abort"], project_path, 5).await;
                Ok(conflict_files)
            }
            Err(e) => {
                let _ = Self::exec_git(&["merge", "--abort"], project_path, 5).await;
                Err(e)
            }
        }
    }

    /// Merge a feature branch into main. Returns the merge commit SHA.
    pub async fn merge_worktree(
        &self,
        project_path: &str,
        branch_name: &str,
        task_id: &str,
        task_title: &str,
    ) -> Result<String, AppError> {
        let commit_msg = format!(
            "Merge story {}: {}\n\nCloses TinSu task: {}",
            task_id, task_title, task_id
        );

        // Try fast-forward first
        let ff_result =
            Self::exec_git(&["merge", "--ff-only", branch_name], project_path, 30).await;

        if ff_result.is_err() {
            // Fall back to merge commit
            Self::exec_git(
                &["merge", "--no-ff", "-m", &commit_msg, branch_name],
                project_path,
                30,
            )
            .await?;
        }

        // Get the merge commit SHA
        let sha = Self::exec_git(&["rev-parse", "HEAD"], project_path, 5).await?;
        Ok(sha.trim().to_string())
    }

    /// Ensure `.tinsu/worktrees/` is listed in `.gitignore`.
    fn ensure_worktrees_ignored(project_path: &str) {
        let gitignore_path = format!("{project_path}/.gitignore");
        let entry = ".tinsu/worktrees/";

        let existing = std::fs::read_to_string(&gitignore_path).unwrap_or_default();
        if !existing.contains(entry) {
            let new_content = if existing.ends_with('\n') || existing.is_empty() {
                format!("{existing}{entry}\n")
            } else {
                format!("{existing}\n{entry}\n")
            };
            let _ = std::fs::write(&gitignore_path, new_content);
        }
    }
}

// ─── Unified Diff Parser ──────────────────────────────────────────────────────

/// Parse `git diff main...HEAD` unified output into `Vec<GitDiffFile>`.
pub(crate) fn parse_unified_diff(unified: &str, name_status: &str) -> Vec<GitDiffFile> {
    // Build a map of path → status from name-status output
    let mut status_map: std::collections::HashMap<String, (String, Option<String>)> =
        std::collections::HashMap::new();
    for line in name_status.lines() {
        let parts: Vec<&str> = line.splitn(3, '\t').collect();
        match parts.as_slice() {
            [status, path] => {
                let s = match status.chars().next() {
                    Some('A') => "added",
                    Some('D') => "deleted",
                    Some('M') => "modified",
                    _ => "modified",
                };
                status_map.insert(path.to_string(), (s.to_string(), None));
            }
            [status, old_path, new_path] if status.starts_with('R') => {
                status_map.insert(
                    new_path.to_string(),
                    ("renamed".to_string(), Some(old_path.to_string())),
                );
            }
            _ => {}
        }
    }

    let mut files: Vec<GitDiffFile> = vec![];
    let mut current_file: Option<GitDiffFile> = None;
    let mut current_hunk: Option<GitDiffHunk> = None;
    let mut old_line_no = 0i32;
    let mut new_line_no = 0i32;

    for line in unified.lines() {
        if line.starts_with("diff --git ") {
            // Flush previous hunk and file
            if let Some(h) = current_hunk.take() {
                if let Some(f) = current_file.as_mut() {
                    f.hunks.push(h);
                }
            }
            if let Some(f) = current_file.take() {
                files.push(f);
            }
            // New file section — path will be resolved by --- / +++ lines
            current_file = Some(GitDiffFile {
                path: String::new(),
                old_path: None,
                status: "modified".to_string(),
                is_binary: None,
                additions: 0,
                deletions: 0,
                hunks: vec![],
            });
        } else if line.starts_with("--- ") {
            // Capture old path for deleted-file detection ("+++ /dev/null" case)
            let raw_old = line.trim_start_matches("--- ");
            let old_path = raw_old.trim_start_matches("a/").to_string();
            if old_path != "/dev/null" {
                if let Some(ref mut f) = current_file {
                    // Tentatively set path; +++ line will override for non-deleted files
                    if f.path.is_empty() {
                        f.path = old_path;
                    }
                }
            }
        } else if line.starts_with("+++ ") {
            let raw_new = line.trim_start_matches("+++ ");
            if raw_new == "/dev/null" {
                // Deleted file — path already set from --- line; mark as deleted
                if let Some(ref mut f) = current_file {
                    f.status = "deleted".to_string();
                    if let Some((_, old_path)) = status_map.get(&f.path) {
                        f.old_path = old_path.clone();
                    }
                }
            } else {
                let path = raw_new.trim_start_matches("b/").to_string();
                if let Some(ref mut f) = current_file {
                    f.path = path.clone();
                    if let Some((status, old_path)) = status_map.get(&path) {
                        f.status = status.clone();
                        f.old_path = old_path.clone();
                    }
                }
            }
        } else if line.starts_with("Binary files") {
            if let Some(ref mut f) = current_file {
                f.is_binary = Some(true);
            }
        } else if line.starts_with("@@ ") {
            // Flush previous hunk
            if let Some(h) = current_hunk.take() {
                if let Some(f) = current_file.as_mut() {
                    f.hunks.push(h);
                }
            }
            // Parse: @@ -old_start,old_lines +new_start,new_lines @@
            let header = line.to_string();
            let (os, ol, ns, nl) = parse_hunk_header(line);
            old_line_no = os;
            new_line_no = ns;
            current_hunk = Some(GitDiffHunk {
                header,
                old_start: os,
                old_lines: ol,
                new_start: ns,
                new_lines: nl,
                lines: vec![],
            });
        } else if let Some(ref mut hunk) = current_hunk {
            if line.starts_with('+') && !line.starts_with("+++") {
                let content = line[1..].to_string();
                hunk.lines.push(GitDiffLine {
                    line_type: "add".to_string(),
                    content,
                    old_line_no: None,
                    new_line_no: Some(new_line_no),
                });
                if let Some(ref mut f) = current_file {
                    f.additions += 1;
                }
                new_line_no += 1;
            } else if line.starts_with('-') && !line.starts_with("---") {
                let content = line[1..].to_string();
                hunk.lines.push(GitDiffLine {
                    line_type: "remove".to_string(),
                    content,
                    old_line_no: Some(old_line_no),
                    new_line_no: None,
                });
                if let Some(ref mut f) = current_file {
                    f.deletions += 1;
                }
                old_line_no += 1;
            } else if line.starts_with(' ') || line.is_empty() {
                let content = if line.is_empty() {
                    String::new()
                } else {
                    line[1..].to_string()
                };
                hunk.lines.push(GitDiffLine {
                    line_type: "context".to_string(),
                    content,
                    old_line_no: Some(old_line_no),
                    new_line_no: Some(new_line_no),
                });
                old_line_no += 1;
                new_line_no += 1;
            }
        }
    }

    // Flush last hunk and file
    if let Some(h) = current_hunk.take() {
        if let Some(f) = current_file.as_mut() {
            f.hunks.push(h);
        }
    }
    if let Some(f) = current_file.take() {
        files.push(f);
    }

    files
}

/// Parse a hunk header `@@ -old_start,old_lines +new_start,new_lines @@`
/// Returns `(old_start, old_lines, new_start, new_lines)`.
fn parse_hunk_header(header: &str) -> (i32, i32, i32, i32) {
    // Extract the part between first @@ and second @@
    let inner = header
        .trim_start_matches('@')
        .trim()
        .splitn(2, "@@")
        .next()
        .unwrap_or("")
        .trim();

    let parts: Vec<&str> = inner.split(' ').collect();
    let (os, ol) = parse_range(parts.first().copied().unwrap_or(""));
    let (ns, nl) = parse_range(parts.get(1).copied().unwrap_or(""));
    (os, ol, ns, nl)
}

fn parse_range(s: &str) -> (i32, i32) {
    let s = s.trim_start_matches('-').trim_start_matches('+');
    let parts: Vec<&str> = s.splitn(2, ',').collect();
    let start = parts.first().and_then(|v| v.parse().ok()).unwrap_or(0);
    let count = parts.get(1).and_then(|v| v.parse().ok()).unwrap_or(1);
    (start, count)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_branch_name_basic() {
        let name = GitService::generate_branch_name("task-123", "Fix login bug");
        assert_eq!(name, "tinsu/story-task-123-fix-login-bug");
    }

    #[test]
    fn test_generate_branch_name_special_chars() {
        let name = GitService::generate_branch_name("abc", "Add feature: user-auth (v2)");
        // All non-alphanumeric → '-', collapse multiples, trim trailing '-'
        assert!(name.starts_with("tinsu/story-abc-"));
        assert!(!name.ends_with('-'));
        assert!(!name.contains("--"));
    }

    #[test]
    fn test_generate_branch_name_truncation() {
        let long_title = "a".repeat(100);
        let name = GitService::generate_branch_name("id", &long_title);
        // Slug portion should be at most 40 chars
        let slug = name
            .strip_prefix("tinsu/story-id-")
            .expect("should start with prefix");
        assert!(slug.len() <= 40, "slug should be at most 40 chars");
    }

    #[test]
    fn test_generate_branch_name_collapses_dashes() {
        let name = GitService::generate_branch_name("x", "Hello   World!!!");
        assert!(!name.contains("--"));
    }

    #[test]
    fn test_get_diff_empty_output_returns_empty_result() {
        // Directly test parse_unified_diff with empty input
        let result = parse_unified_diff("", "");
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_unified_diff_added_file() {
        let unified = "diff --git a/new.ts b/new.ts\n--- /dev/null\n+++ b/new.ts\n@@ -0,0 +1,2 @@\n+line1\n+line2\n";
        let name_status = "A\tnew.ts\n";
        let files = parse_unified_diff(unified, name_status);
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "new.ts");
        assert_eq!(files[0].status, "added");
        assert_eq!(files[0].additions, 2);
        assert_eq!(files[0].deletions, 0);
    }

    #[test]
    fn test_parse_unified_diff_modified_file() {
        let unified = "diff --git a/main.ts b/main.ts\n--- a/main.ts\n+++ b/main.ts\n@@ -1,3 +1,3 @@\n context\n-old line\n+new line\n context\n";
        let name_status = "M\tmain.ts\n";
        let files = parse_unified_diff(unified, name_status);
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].status, "modified");
        assert_eq!(files[0].additions, 1);
        assert_eq!(files[0].deletions, 1);
    }

    #[test]
    fn test_parse_hunk_header() {
        let (os, ol, ns, nl) = parse_hunk_header("@@ -1,5 +1,7 @@ fn foo() {");
        assert_eq!(os, 1);
        assert_eq!(ol, 5);
        assert_eq!(ns, 1);
        assert_eq!(nl, 7);
    }

    #[test]
    fn test_branch_status_serialization() {
        let bs = BranchStatus {
            commits_ahead: 3,
            commits_behind: 0,
            has_uncommitted_changes: true,
        };
        let json = serde_json::to_string(&bs).expect("serialize");
        assert!(json.contains("commitsAhead"));
        assert!(json.contains("commitsBehind"));
        assert!(json.contains("hasUncommittedChanges"));
    }

    #[test]
    fn test_git_diff_line_serializes_type_field() {
        let line = GitDiffLine {
            line_type: "add".to_string(),
            content: "hello".to_string(),
            old_line_no: None,
            new_line_no: Some(5),
        };
        let json = serde_json::to_string(&line).expect("serialize");
        // Must serialize as "type", not "line_type"
        assert!(json.contains(r#""type""#));
        assert!(!json.contains("line_type"));
        assert!(json.contains("newLineNo"));
    }

    #[test]
    fn test_git_diff_summary_camel_case() {
        let s = GitDiffSummary {
            files_changed: 2,
            lines_added: 10,
            lines_removed: 3,
        };
        let json = serde_json::to_string(&s).expect("serialize");
        assert!(json.contains("filesChanged"));
        assert!(json.contains("linesAdded"));
        assert!(json.contains("linesRemoved"));
    }

    #[tokio::test]
    async fn test_exec_git_rejects_null_byte_in_cwd() {
        let result = GitService::exec_git(&["status"], "path\0with\0null", 5).await;
        assert!(matches!(result, Err(AppError::BadRequest(_))));
    }

    #[tokio::test]
    async fn test_create_worktree_idempotent_when_path_exists() {
        // Use a real path that exists (the project root) to test idempotency
        let tmp = std::env::temp_dir();
        let worktree_path = tmp.join("tinsu-test-worktree-exists");
        std::fs::create_dir_all(&worktree_path).unwrap();

        // Simulate: if .tinsu/worktrees/{task_id} exists → return early
        let git = GitService;
        let tmp_project = tmp.join("tinsu-fake-project");
        std::fs::create_dir_all(tmp_project.join(".tinsu/worktrees/task-1")).unwrap();

        let (wt_path, _branch) = git
            .create_worktree(
                tmp_project.to_str().unwrap(),
                "task-1",
                "Test title",
            )
            .await
            .expect("should return early");
        assert!(wt_path.contains("task-1"));

        // Cleanup
        let _ = std::fs::remove_dir_all(&tmp_project);
        let _ = std::fs::remove_dir_all(&worktree_path);
    }

    #[test]
    fn test_detect_merge_conflicts_conflict_file_parsing() {
        // Test the CONFLICT line parsing logic in isolation
        let msg = "Automatic merge failed; fix conflicts and then commit the result.\nCONFLICT (content): Merge conflict in src/main.ts\nCONFLICT (content): Merge conflict in package.json\n";
        let conflict_files: Vec<String> = msg
            .lines()
            .filter(|line| line.contains("CONFLICT (content): Merge conflict in "))
            .map(|line| {
                line.trim_start_matches("CONFLICT (content): Merge conflict in ")
                    .trim()
                    .to_string()
            })
            .collect();
        assert_eq!(conflict_files.len(), 2);
        assert!(conflict_files.contains(&"src/main.ts".to_string()));
        assert!(conflict_files.contains(&"package.json".to_string()));
    }
}
