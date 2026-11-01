import { isRouteErrorResponse, useRouteError } from 'react-router'
import { ErrorState } from '@/components/feedback/states'
import NotFoundPage from '@/app/pages/NotFoundPage'

/** Route-level error element: 404s get the not-found page, everything else a recoverable error. */
export function RouteError() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />
  console.error(error)
  const isChunkError = error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message)
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <ErrorState
        title={isChunkError ? 'BookEase was updated' : 'Something went wrong'}
        description={
          isChunkError
            ? 'A newer version is available. Reload to continue; your data is stored in this browser and is not affected.'
            : 'An unexpected error occurred. Your data is stored in this browser and has not been changed.'
        }
        onRetry={() => window.location.reload()}
      />
    </div>
  )
}
