import { useEffect, useState } from 'react'
import { eventBus } from '@/lib/event-bus'
import type { ChangesSummaryData } from '@/lib/event-bus'

/**
 * Subscribe to SSE-pushed changes summary for an issue.
 * Returns `{ fileCount, additions, deletions }` pushed by the server
 * whenever file-modifying tool actions occur or execution settles.
 * No polling — purely event-driven.
 */
export function useChangesSummary(issueId: string | undefined) {
  const [summary, setSummary] = useState<ChangesSummaryData | null>(null)

  useEffect(() => {
    if (!issueId) {
      setSummary(null)
      return
    }

    // Reset on issue change
    setSummary(null)

    const unsub = eventBus.onChangesSummary((data) => {
      if (data.issueId === issueId) {
        setSummary(data)
      }
    })

    return unsub
  }, [issueId])

  return summary
}
