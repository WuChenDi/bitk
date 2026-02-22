import { useEffect, useState } from 'react'
import { eventBus } from '@/lib/event-bus'

/**
 * Project-scoped SSE connection hook.
 * Connects the EventBus to /api/events?projectId=... for the given project.
 * Reconnects when projectId changes.
 */
export function useEventConnection(projectId?: string) {
  const [connected, setConnected] = useState(eventBus.isConnected())

  useEffect(() => {
    if (projectId) {
      eventBus.connect(projectId)
    }
    return () => {
      // Disconnect when leaving project pages to avoid leaking SSE connections
      eventBus.disconnect()
    }
  }, [projectId])

  useEffect(() => {
    return eventBus.onConnectionChange(setConnected)
  }, [])

  return connected
}
