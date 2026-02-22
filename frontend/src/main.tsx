import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { eventBus } from './lib/event-bus'
import './i18n'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
})

// SSE connection is now project-scoped — see useEventConnection(projectId)
// Invalidate all queries on SSE reconnect so stale statuses get refreshed
eventBus.onConnectionChange((connected) => {
  if (connected) queryClient.invalidateQueries()
})
// Invalidate issue queries when any issue status changes via SSE
eventBus.onIssueUpdated(() => {
  queryClient.invalidateQueries({ queryKey: ['projects'] })
})
// Debounced invalidation of changes queries on any issue activity (log/state/done)
{
  let activityTimer: ReturnType<typeof setTimeout> | null = null
  eventBus.onIssueActivity(() => {
    if (activityTimer) clearTimeout(activityTimer)
    activityTimer = setTimeout(() => {
      activityTimer = null
      queryClient.invalidateQueries({
        queryKey: ['projects'],
        predicate: (q) => q.queryKey.includes('changes'),
      })
    }, 2000)
  })
}

const HomePage = lazy(() => import('./pages/HomePage'))
const KanbanPage = lazy(() => import('./pages/KanbanPage'))
const IssueDetailPage = lazy(() => import('./pages/IssueDetailPage'))

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="flex h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/projects/:projectId" element={<KanbanPage />} />
              <Route
                path="/projects/:projectId/issues"
                element={<IssueDetailPage />}
              />
              <Route
                path="/projects/:projectId/issues/:issueId"
                element={<IssueDetailPage />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
      {import.meta.env.DEV ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>,
  )
}
