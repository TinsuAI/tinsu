// Story file status enum values (Story 5.2c)
// Used for tasks imported from epics.md to track story file creation progress
export const STORY_FILE_STATUS = ['summary_only', 'story_ready'] as const
export type StoryFileStatus = (typeof STORY_FILE_STATUS)[number]
