import { create } from 'zustand'

/**
 * Store for managing the full-page story view state.
 *
 * Controls which story is currently being viewed/edited in full-page mode.
 * Story 3.7: Full content display and editing.
 */
interface StoryViewStore {
  // State
  /** ID of the story currently being viewed, null if not viewing any story */
  activeStoryId: string | null
  /** Whether the story view is in edit mode */
  isEditing: boolean

  // Actions
  /** Open the full-page view for a story */
  openStory: (storyId: string) => void
  /** Close the full-page view and return to board */
  closeStory: () => void
  /** Toggle edit mode */
  setEditing: (editing: boolean) => void
  /** Toggle edit mode */
  toggleEditing: () => void
}

export const useStoryViewStore = create<StoryViewStore>()((set) => ({
  // Initial state
  activeStoryId: null,
  isEditing: true,

  // Actions
  openStory: (storyId) => set({ activeStoryId: storyId, isEditing: true }),
  closeStory: () => set({ activeStoryId: null, isEditing: false }),
  setEditing: (editing) => set({ isEditing: editing }),
  toggleEditing: () => set((state) => ({ isEditing: !state.isEditing }))
}))
