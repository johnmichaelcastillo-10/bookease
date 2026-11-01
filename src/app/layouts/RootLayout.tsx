import { Suspense, useEffect, useState } from 'react'
import { Outlet, ScrollRestoration } from 'react-router'
import { ErrorState, LoadingState } from '@/components/feedback/states'
import { openDatabase } from '@/database/db'
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen'
import { useAppState } from '@/hooks/useBusiness'
import { errorMessage } from '@/services/errors'

/** Opens IndexedDB, then shows first-launch onboarding or the app. */
export function RootLayout() {
  const [dbError, setDbError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    openDatabase()
      .then(() => setReady(true))
      .catch((error: unknown) => setDbError(error instanceof Error ? error.message : errorMessage(error)))
  }, [])

  if (dbError) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <ErrorState title="Local storage is unavailable" description={dbError} onRetry={() => window.location.reload()} />
      </div>
    )
  }
  if (!ready) return <LoadingState label="Opening your local workspace…" className="min-h-svh" />
  return <ReadyApp />
}

function ReadyApp() {
  const appState = useAppState()
  if (!appState) return <LoadingState className="min-h-svh" />
  if (!appState.onboardingCompletedAt) return <OnboardingScreen />
  return (
    <>
      <ScrollRestoration />
      <Suspense fallback={<LoadingState className="min-h-svh" />}>
        <Outlet />
      </Suspense>
    </>
  )
}
