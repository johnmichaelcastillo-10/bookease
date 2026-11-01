import type { BusinessSettings } from '@/types/models'

/** Plain-language cancellation rule shown before and after booking. */
export function cancellationPolicyText(settings: Pick<BusinessSettings, 'allowCustomerCancellation' | 'cancellationNoticeHours'>): string {
  if (!settings.allowCustomerCancellation) return 'Online cancellation is not available. Contact the business to change or cancel.'
  if (settings.cancellationNoticeHours === 0) return 'You can cancel online from “Find my booking” any time before the start time.'
  return `You can cancel online from “Find my booking” up to ${settings.cancellationNoticeHours} hour${settings.cancellationNoticeHours === 1 ? '' : 's'} before the start time.`
}
