# Sprint Change Proposal: Story Number Schema Fix

**Date:** 2026-01-12
**Triggered By:** Story 5.3 (Story Task Execution Path)
**Severity:** Minor
**Status:** Approved for Implementation

---

## 1. Issue Summary

### Problem Statement
The `story_number` column in the tasks table is defined as INTEGER, but story identifiers in BMAD epics use a `{epic}.{number}{suffix}` format (e.g., "5.2b", "5.2c", "3b"). When stories are imported from epics.md, the letter suffixes are stripped, causing:

- Stories 5.2b and 5.2c both map to `story_number = 2` → one overwrites the other
- Stories 5.3 and 5.3b both map to `story_number = 3` → collision

### Discovery Context
- Found during Story 5.3 development when SQLite showed only 2 stories instead of 4
- Root cause traced through: `epics-parser.service.ts` → `story-import.service.ts` → `schema.ts`

### Evidence
- SQLite shows only 2 stories (5.2c, 5.3b) when 4 should exist
- `story_number` values are "2" and "3" instead of "2b", "2c", "3", "3b"
- Code trace confirms: `parseInt(storyNumber.replace(/[^\d]/g, ''), 10)` strips letters
- Schema confirms: `story_number: integer('story_number')`

---

## 2. Impact Analysis

### Epic Impact
| Epic | Impact | Details |
|------|--------|---------|
| Epic 1 | Schema origin | Story 1.4 defined base schema (completed) |
| Epic 3 | Import logic | Story 3.7 added story_number field (deferred) |
| Epic 5 | Discovery | Story 5.3 revealed the bug (in-progress) |
| Epics 6-8 | None | No story_number dependencies |

### Artifact Conflicts
| Artifact | Impact | Changes Needed |
|----------|--------|----------------|
| PRD | None | — |
| Architecture | None | — |
| UI/UX | None | — |
| Schema | **Yes** | `story_number: integer` → `story_number: text` |
| Import Service | **Yes** | Use `storyNumber` string instead of `storyNumberInt` |
| Tests | **Yes** | Update test expectations |

### Technical Impact
- Database migration required (INTEGER → TEXT)
- Re-import needed to restore collided stories
- No API changes
- No UI changes

---

## 3. Recommended Approach

**Selected Path:** Direct Adjustment (Patch Story)

### Rationale
1. **Isolated fix** — Only 3 files need changes (schema, import service, parser interface)
2. **Low risk** — Clear root cause, straightforward solution
3. **No dependencies** — Doesn't block or require changes to other epics
4. **Quick turnaround** — Can be done in current sprint as patch
5. **Data recoverable** — Re-import will restore missing stories

### Alternatives Considered
| Option | Decision | Reason |
|--------|----------|--------|
| Wait for Story 3.7 | Rejected | Bug blocks current testing |
| UI workaround | Rejected | Root cause should be fixed |
| Rollback recent work | Rejected | Bug predates current sprint |

### Effort & Risk
- **Effort:** Low (~1-2 hours)
- **Risk:** Low (isolated change, clear fix)
- **Timeline Impact:** None

---

## 4. Detailed Change Proposals

### 4.1 Schema Change
**File:** `src/main/db/schema.ts`
**Line:** 117

```typescript
// OLD
story_number: integer('story_number'), // 1, 2, 3... within each epic

// NEW
story_number: text('story_number'), // "1", "2", "2b", "3b"... within each epic
```

### 4.2 Import Service - Insert
**File:** `src/main/services/story-import.service.ts`
**Line:** 248

```typescript
// OLD
story_number: story.storyNumberInt, // Use integer for database

// NEW
story_number: story.storyNumber, // Use full string ("2b", "3", etc.)
```

### 4.3 Import Service - Query
**File:** `src/main/services/story-import.service.ts`
**Lines:** 194-204

```typescript
// OLD - comment
// Use storyNumberInt for database queries (integer column)

// NEW - comment
// Use full storyNumber string for database queries (text column)

// OLD - query parameter
eq(schema.tasks.story_number, story.storyNumberInt),

// NEW - query parameter
eq(schema.tasks.story_number, story.storyNumber),
```

### 4.4 Parser Interface Cleanup
**File:** `src/main/services/epics-parser.service.ts`
**Lines:** 17-21

```typescript
// Add deprecation notice to storyNumberInt
/** @deprecated No longer used - story_number column is now TEXT */
storyNumberInt: number
```

### 4.5 Database Migration
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 4.6 Test Updates
Update test expectations in:
- `src/main/services/story-import.service.test.ts`
- `src/main/services/epics-parser.service.test.ts`
- `src/main/db/schema.test.ts`

Change integer expectations to string:
```typescript
// OLD
expect(task.story_number).toBe(2)

// NEW
expect(task.story_number).toBe('2b')
```

---

## 5. Implementation Handoff

### Scope Classification
**Minor** — Direct implementation by development team

### Responsibilities
| Role | Action |
|------|--------|
| Dev Agent | Implement all 6 approved changes |
| Dev Agent | Run migrations and verify fix |
| Dev Agent | Re-import stories to restore missing data |
| Human (Tinxu) | Verify stories 5.2b, 5.2c, 5.3, 5.3b all appear in SQLite |

### Implementation Sequence
1. Apply schema change (`schema.ts`)
2. Apply import service changes (`story-import.service.ts`)
3. Apply parser deprecation (`epics-parser.service.ts`)
4. Update tests
5. Run `npm run rebuild:electron` (per CLAUDE.md)
6. Generate and apply migration
7. Re-import stories from epics.md
8. Verify all stories present in database

### Success Criteria
- [ ] Schema migrated: `story_number` is TEXT
- [ ] Import uses `storyNumber` string
- [ ] All 4 stories (5.2b, 5.2c, 5.3, 5.3b) exist in database with correct identifiers
- [ ] Tests pass
- [ ] Story 5.3 development can continue

---

## 6. Approval

**Proposed by:** PM Agent (John)
**Reviewed with:** Tinxu
**Date:** 2026-01-12

**Approval Status:** ✅ Approved by Tinxu (2026-01-12)

---

*Generated by BMAD Course Correction Workflow*
