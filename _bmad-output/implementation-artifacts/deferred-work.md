# Deferred Work

## Sync I/O in planning router
**Source:** Code review of planning-chat-input-enhancements  
**Issue:** `getSkillManifest` (and all other planning router queries) use synchronous filesystem I/O (`readFileSync`, `readdirSync`, `statSync`) which blocks the Electron main process thread. Should be migrated to async `fs/promises` equivalents.
