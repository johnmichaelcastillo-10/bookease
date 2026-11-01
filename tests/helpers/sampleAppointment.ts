import type { Appointment } from '@/types/models'

export function sampleAppointment(overrides: Partial<Appointment> = {}): Appointment {
  const at = '2026-11-01T10:00:00.000Z'
  return {
    id: 'appt-1',
    reference: 'BE-AAAAAA',
    customerId: 'c1',
    customerName: 'Sample',
    customerEmail: 'sample@example.com',
    customerPhone: '5550100000',
    serviceId: 's1',
    serviceName: 'Service',
    staffId: 'st1',
    staffName: 'Staff',
    date: '2026-11-03',
    startTime: '10:00',
    endTime: '11:00',
    durationMinutes: 60,
    bufferMinutes: 0,
    priceCents: 1000,
    status: 'confirmed',
    statusHistory: [{ status: 'confirmed', at, by: 'admin' }],
    customerNotes: '',
    internalNotes: '',
    channel: 'admin',
    createdAt: at,
    updatedAt: at,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: '',
    source: 'user',
    ...overrides,
  }
}
