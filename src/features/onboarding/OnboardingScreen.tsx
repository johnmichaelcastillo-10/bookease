import { Database, HardDrive, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { BrandMark } from '@/components/shared/BrandMark'
import { Button } from '@/components/ui/button'
import { seedDemoData } from '@/database/seed/demoData'
import { errorMessage } from '@/services/errors'
import { completeOnboarding } from '@/services/settings/settingsService'

/**
 * First launch: load the BrightSpace demo business or start empty. This is a local demo
 * workspace choice, not a sign-in.
 */
export function OnboardingScreen() {
  const [busy, setBusy] = useState<'demo' | 'empty' | null>(null)

  async function choose(kind: 'demo' | 'empty') {
    setBusy(kind)
    try {
      if (kind === 'demo') {
        const result = await seedDemoData()
        if (result.seeded) toast.success(`Loaded ${result.appointments} sample appointments.`)
      }
      await completeOnboarding()
    } catch (error) {
      toast.error(errorMessage(error))
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-sm font-semibold">BookEase</p>
            <p className="text-xs text-muted-foreground">Appointment scheduling for service businesses</p>
          </div>
        </div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Set up your local workspace</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          BookEase runs entirely in this browser. Everything you create is stored on this device in IndexedDB. There is no account and
          no server, so other devices and browsers start with their own empty workspace.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => choose('demo')}
            className="group flex flex-col items-start rounded-lg border bg-card p-5 text-left transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-brand-soft text-primary">
              {busy === 'demo' ? <Loader2 className="size-4.5 animate-spin" /> : <Sparkles className="size-4.5" />}
            </span>
            <span className="mt-4 block font-semibold">Explore with sample data</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Loads “BrightSpace Services”: 5 services, 4 staff, 28 customers and a few hundred appointments around today. Remove it later
              in Settings → Data.
            </span>
            <span className="mt-4 inline-block text-sm font-medium text-primary">Recommended for a first look →</span>
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => choose('empty')}
            className="group flex flex-col items-start rounded-lg border bg-card p-5 text-left transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {busy === 'empty' ? <Loader2 className="size-4.5 animate-spin" /> : <Database className="size-4.5" />}
            </span>
            <span className="mt-4 block font-semibold">Start with an empty business</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Set up your own services, staff and hours from scratch. You can still load the sample data later.
            </span>
          </button>
        </div>

        <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
          <HardDrive className="mt-px size-3.5 shrink-0" aria-hidden />
          Clearing site data in your browser deletes your workspace. Export a backup from Settings → Data to keep a copy.
        </p>
        <div className="mt-6">
          <Button variant="link" className="h-auto p-0 text-xs" asChild>
            <a href="https://github.com/johnmichaelcastillo-10/bookease" target="_blank" rel="noreferrer">
              About this project
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
