import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { getAppState, getBusinessSettings } from '@/database/repositories/settingsRepository'
import { businessNow } from '@/services/clock'
import type { WallClock } from '@/lib/time'
import type { AppState, BusinessSettings } from '@/types/models'

/** Live business settings (re-renders when they change in any tab). Undefined while loading. */
export function useBusinessSettings(): BusinessSettings | undefined {
  return useLiveQuery(() => getBusinessSettings(), [])
}

export function useAppState(): AppState | undefined {
  return useLiveQuery(() => getAppState(), [])
}

/** "Now" in the business timezone, refreshed every 30 seconds. */
export function useBusinessNow(timeZone: string | undefined): WallClock | undefined {
  const [now, setNow] = useState<WallClock | undefined>(() => (timeZone ? businessNow(timeZone) : undefined))
  useEffect(() => {
    if (!timeZone) return
    const tick = () => setNow(businessNow(timeZone))
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [timeZone])
  return now
}

/** Settings plus a ticking "now"; undefined until both are ready. */
export function useBusinessContext(): { settings: BusinessSettings; now: WallClock } | undefined {
  const settings = useBusinessSettings()
  const now = useBusinessNow(settings?.timezone)
  return settings && now ? { settings, now } : undefined
}
