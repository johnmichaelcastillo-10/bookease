import type { Transaction } from 'dexie'
import { normalizeEmail } from '@/lib/contact'

/**
 * v1 → v2: customers gain `normalizedEmail` (trimmed, lowercased) so duplicates can be found
 * through an index regardless of how the email was typed.
 */
export async function upgradeToV2(tx: Transaction): Promise<void> {
  await tx
    .table('customers')
    .toCollection()
    .modify((customer: { email?: string; normalizedEmail?: string }) => {
      customer.normalizedEmail = normalizeEmail(customer.email ?? '')
    })
}
