import { create } from 'zustand'
import type { Issue } from '@/types/kanban'

type PanelState = { kind: 'closed' } | { kind: 'view'; issue: Issue }

const MIN_WIDTH = 360
const DEFAULT_WIDTH_RATIO = 0.4
const MAX_WIDTH_RATIO = 0.6

function getViewportWidth(): number {
  return typeof window === 'undefined' ? 800 : window.innerWidth
}

function clampWidth(w: number): number {
  const maxW = getViewportWidth() * MAX_WIDTH_RATIO
  return Math.max(MIN_WIDTH, Math.min(w, maxW))
}

interface PanelStore {
  panel: PanelState

  selectedIssueId: string | null
  isPanelOpen: boolean
  width: number

  // Create dialog (centered modal)
  createDialogOpen: boolean
  createDialogStatusId: string | undefined

  openView: (issue: Issue) => void
  close: () => void
  setWidth: (w: number) => void
  openCreateDialog: (statusId?: string) => void
  closeCreateDialog: () => void
}

export { MIN_WIDTH as PANEL_MIN_WIDTH }
export const PANEL_MAX_WIDTH_RATIO = MAX_WIDTH_RATIO

export const usePanelStore = create<PanelStore>((set) => ({
  panel: { kind: 'closed' },
  selectedIssueId: null,
  isPanelOpen: false,
  width: Math.round(getViewportWidth() * DEFAULT_WIDTH_RATIO),

  createDialogOpen: false,
  createDialogStatusId: undefined,

  openView: (issue) =>
    set({
      panel: { kind: 'view', issue },
      selectedIssueId: issue.id,
      isPanelOpen: true,
    }),

  close: () =>
    set({
      panel: { kind: 'closed' },
      selectedIssueId: null,
      isPanelOpen: false,
    }),

  setWidth: (w) => set({ width: clampWidth(w) }),

  openCreateDialog: (statusId) =>
    set({ createDialogOpen: true, createDialogStatusId: statusId }),

  closeCreateDialog: () =>
    set({ createDialogOpen: false, createDialogStatusId: undefined }),
}))

// Re-clamp width on window resize (guarded to prevent duplicate listeners during HMR)
if (typeof window !== 'undefined') {
  const RESIZE_KEY = '__panelStoreResizeAttached'
  if (!(window as Record<string, unknown>)[RESIZE_KEY]) {
    ;(window as Record<string, unknown>)[RESIZE_KEY] = true
    window.addEventListener('resize', () => {
      const store = usePanelStore.getState()
      const clamped = clampWidth(store.width)
      if (clamped !== store.width) {
        store.setWidth(clamped)
      }
    })
  }
}
