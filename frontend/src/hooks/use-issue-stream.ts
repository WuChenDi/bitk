import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { NormalizedLogEntry, SessionStatus } from '@/types/kanban'
import { eventBus } from '@/lib/event-bus'
import { kanbanApi } from '@/lib/kanban-api'
import { queryKeys } from './use-kanban'

interface UseIssueStreamOptions {
  projectId: string
  issueId: string | null
  sessionStatus?: SessionStatus | null
  enabled?: boolean
}

interface AppendOptions {
  pending?: boolean
  done?: boolean
}

interface UseIssueStreamReturn {
  logs: NormalizedLogEntry[]
  clearLogs: () => void
  appendOptimisticUserMessage: (content: string, opts?: AppendOptions) => void
  revertOptimisticSend: () => void
}

const TERMINAL: Set<string> = new Set(['completed', 'failed', 'cancelled'])

function appendLogWithDedup(
  prev: NormalizedLogEntry[],
  incoming: NormalizedLogEntry,
): NormalizedLogEntry[] {
  // Prefer server messageId for identity/dedup.
  if (incoming.messageId) {
    const byId = prev.some((entry) => entry.messageId === incoming.messageId)
    if (byId) return prev
  }

  // Exact duplicate guard (DB refresh + SSE replay).
  const duplicate = prev.some(
    (entry) =>
      entry.entryType === incoming.entryType &&
      (entry.turnIndex ?? null) === (incoming.turnIndex ?? null) &&
      (entry.timestamp ?? null) === (incoming.timestamp ?? null) &&
      entry.content === incoming.content,
  )
  if (duplicate) return prev

  // Reconcile optimistic user echo with persisted server user-message.
  if (incoming.entryType === 'user-message') {
    const last = prev[prev.length - 1]
    if (
      last.entryType === 'user-message' &&
      (!last.messageId || last.messageId.startsWith('tmp:')) &&
      last.content === incoming.content &&
      !!incoming.messageId
    ) {
      return [...prev.slice(0, -1), incoming]
    }
  }

  return [...prev, incoming]
}

export function useIssueStream({
  projectId,
  issueId,
  sessionStatus: externalStatus,
  enabled = true,
}: UseIssueStreamOptions): UseIssueStreamReturn {
  const [logs, setLogs] = useState<NormalizedLogEntry[]>([])
  const queryClient = useQueryClient()

  const doneReceivedRef = useRef(false)
  const streamScopeRef = useRef<string | null>(null)

  const clearLogs = useCallback(() => {
    setLogs([])
    doneReceivedRef.current = false
  }, [])

  const appendOptimisticUserMessage = useCallback(
    (content: string, opts?: AppendOptions) => {
      const trimmed = content.trim()
      if (!trimmed) return
      if (!opts?.pending) {
        doneReceivedRef.current = false
      }
      const optimisticId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `tmp:${crypto.randomUUID()}`
          : `tmp:${Date.now()}-${Math.random().toString(16).slice(2)}`
      setLogs((prev) => [
        ...prev,
        {
          messageId: optimisticId,
          entryType: 'user-message',
          content: trimmed,
          timestamp: new Date().toISOString(),
          ...(opts?.pending ? { metadata: { pending: true } } : {}),
        },
      ])
    },
    [],
  )

  /** Undo the optimistic send — removes the temp user message */
  const revertOptimisticSend = useCallback(() => {
    setLogs((prev) => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      if (last.messageId?.startsWith('tmp:')) {
        return prev.slice(0, -1)
      }
      return prev
    })
  }, [])

  useEffect(() => {
    if (!issueId || !enabled) {
      streamScopeRef.current = null
      clearLogs()
      return
    }

    const scope = `${projectId}:${issueId}`
    if (streamScopeRef.current !== scope) {
      streamScopeRef.current = scope
      clearLogs()
    }
  }, [projectId, issueId, enabled, clearLogs])

  // Always fetch historical logs from DB (survives server restart)
  useEffect(() => {
    if (!issueId || !enabled) return

    const scope = `${projectId}:${issueId}`
    let cancelled = false

    kanbanApi
      .getIssueLogs(projectId, issueId)
      .then((data) => {
        if (cancelled || streamScopeRef.current !== scope) return
        setLogs((prev) => {
          // Preserve unreconciled optimistic entries (tmp: prefix),
          // but drop pending/done entries — the server already consumed them.
          const optimistic = prev.filter(
            (e) =>
              e.messageId?.startsWith('tmp:') &&
              e.entryType === 'user-message' &&
              !e.metadata?.pending &&
              !e.metadata?.done,
          )
          if (optimistic.length === 0) return data.logs
          // Check which optimistic entries already appear in server data
          const serverUserContents = new Set(
            data.logs
              .filter((e) => e.entryType === 'user-message')
              .map((e) => e.content),
          )
          const unreconciled = optimistic.filter(
            (e) => !serverUserContents.has(e.content),
          )
          return unreconciled.length > 0
            ? [...data.logs, ...unreconciled]
            : data.logs
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [projectId, issueId, enabled, externalStatus])

  // Subscribe to live SSE events for this issue.
  useEffect(() => {
    if (!issueId || !enabled) return

    doneReceivedRef.current = false

    const cleanup = { unsub: (() => {}) as () => void }

    cleanup.unsub = eventBus.subscribe(issueId, {
      onLog: (entry) => {
        if (doneReceivedRef.current) return
        setLogs((prev) => appendLogWithDedup(prev, entry))
      },
      onState: (data) => {
        if (data.state === 'running' || data.state === 'pending') {
          doneReceivedRef.current = false
        } else if (TERMINAL.has(data.state)) {
          doneReceivedRef.current = true
        }
        // Invalidate React Query so server sessionStatus flows to components
        queryClient.invalidateQueries({
          queryKey: queryKeys.issue(projectId, issueId),
        })
      },
      onDone: (data) => {
        doneReceivedRef.current = true
        queryClient.invalidateQueries({
          queryKey: queryKeys.issue(projectId, issueId),
        })
        queryClient.invalidateQueries({ queryKey: queryKeys.issues(projectId) })
      },
    })

    queryClient.invalidateQueries({
      queryKey: queryKeys.issue(projectId, issueId),
    })

    return () => {
      cleanup.unsub()
    }
  }, [projectId, issueId, enabled, queryClient])

  return {
    logs,
    clearLogs,
    appendOptimisticUserMessage,
    revertOptimisticSend,
  }
}
