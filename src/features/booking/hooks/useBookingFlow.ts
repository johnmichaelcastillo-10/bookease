import { useLiveQuery } from 'dexie-react-hooks'
import { servicesRepository } from '@/database/repositories/catalogRepository'
import { staffRepository } from '@/database/repositories/staffRepository'
import { useBusinessContext } from '@/hooks/useBusiness'
import { useBookingDraft } from '@/store/bookingDraftStore'
import type { Service, Staff } from '@/types/models'
import { effectiveStaffId, guardRedirect, type StepKey } from '../lib/flow'

/**
 * Everything a booking step needs: settings, now, the draft, the selected service and staff
 * member, and where to redirect if an earlier step is incomplete.
 * `null` service/staff = selected but no longer exists (or service inactive).
 */
export function useBookingFlow(step: StepKey) {
  const business = useBusinessContext()
  const draft = useBookingDraft()

  const service = useLiveQuery<Service | null>(
    async () => (draft.serviceId ? ((await servicesRepository.get(draft.serviceId)) ?? null) : null),
    [draft.serviceId],
  )
  const staff = useLiveQuery<Staff | null>(
    async () => (draft.staffId ? ((await staffRepository.get(draft.staffId)) ?? null) : null),
    [draft.staffId],
  )

  const allowStaffSelection = business?.settings.allowStaffSelection ?? true
  const loading = !business || service === undefined || staff === undefined
  let redirect: string | null = null
  if (!loading) {
    redirect = guardRedirect(step, draft, allowStaffSelection)
    // A service that was deleted or deactivated since it was picked sends the customer back.
    if (!redirect && step !== 'service' && (!service || !service.isActive)) redirect = '/book/service'
  }

  return {
    loading,
    redirect,
    business,
    draft,
    service: service ?? null,
    staff: allowStaffSelection ? (staff ?? null) : null,
    staffId: effectiveStaffId(draft, allowStaffSelection),
    allowStaffSelection,
  }
}
