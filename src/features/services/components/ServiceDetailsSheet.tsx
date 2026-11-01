import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Power, PowerOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Avatar } from '@/components/shared/StaffBadge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { formatDuration, formatMoney, formatTimestamp } from '@/lib/format'
import { getEligibleStaff } from '@/services/availability/engine'
import { deleteService, setServiceActive } from '@/services/catalog/catalogService'
import { errorMessage } from '@/services/errors'
import type { Service, ServiceCategory, Staff } from '@/types/models'
import { ActiveBadge } from './ActiveBadge'

export function ServiceDetailsSheet({
  service,
  onOpenChange,
  categories,
  staff,
  currency,
  onEdit,
}: {
  service: Service | null
  onOpenChange: (open: boolean) => void
  categories: ServiceCategory[]
  staff: Staff[]
  currency: string
  onEdit: (service: Service) => void
}) {
  const [confirm, setConfirm] = useState<'delete' | 'deactivate' | null>(null)
  const appointmentCount = useLiveQuery(
    () => (service ? appointmentsRepository.countByService(service.id) : Promise.resolve(0)),
    [service?.id],
  )
  const canDelete = appointmentCount === 0
  const eligible = service ? getEligibleStaff(service, staff) : []
  const category = categories.find((c) => c.id === service?.categoryId)

  async function activate(next: boolean) {
    if (!service) return
    try {
      await setServiceActive(service.id, next)
      toast.success(next ? `"${service.name}" is bookable again.` : `"${service.name}" is no longer bookable.`)
    } catch (error) {
      toast.error(errorMessage(error))
      throw error
    }
  }

  return (
    <>
      <Sheet open={service !== null} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          {service && (
            <>
              <SheetHeader className="border-b">
                <div className="flex items-center gap-2">
                  <ActiveBadge active={service.isActive} />
                  <span className="text-xs text-muted-foreground">{category?.name ?? 'Uncategorised'}</span>
                </div>
                <SheetTitle className="text-lg">{service.name}</SheetTitle>
                <SheetDescription>{service.description || 'No description.'}</SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-6 overflow-y-auto p-4">
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    ['Duration', formatDuration(service.durationMinutes)],
                    ['Buffer after', service.bufferMinutes ? formatDuration(service.bufferMinutes) : 'None'],
                    ['Price', formatMoney(service.priceCents, currency)],
                    ['Appointments', appointmentCount === undefined ? '…' : String(appointmentCount)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border px-3 py-2">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5 text-sm font-medium tabular">{value}</dd>
                    </div>
                  ))}
                </dl>

                <section>
                  <h3 className="text-sm font-semibold">Who can perform it</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {service.staffMode === 'any' ? 'Any active staff member.' : 'Only staff assigned to this service.'}
                  </p>
                  {eligible.length === 0 ? (
                    <p className="mt-3 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
                      No active staff can perform this service, so it has no available times.{' '}
                      <Link to="/admin/staff" className="font-medium text-primary hover:underline">
                        Assign staff
                      </Link>
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {eligible.map((s) => (
                        <li key={s.id}>
                          <Link to={`/admin/staff/${s.id}`} className="flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-muted/60">
                            <Avatar name={s.fullName} color={s.color} size="sm" />
                            <span className="text-sm">{s.fullName}</span>
                            <span className="truncate text-xs text-muted-foreground">{s.position}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <p className="text-xs text-muted-foreground">
                  Created {formatTimestamp(service.createdAt)} · Updated {formatTimestamp(service.updatedAt)}
                </p>
                {!canDelete && appointmentCount !== undefined && (
                  <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                    This service is used by {appointmentCount} appointment{appointmentCount === 1 ? '' : 's'}, so it can’t be deleted.
                    Deactivate it to stop new bookings while keeping history intact.
                  </p>
                )}
              </div>

              <SheetFooter className="flex-row flex-wrap border-t">
                <Button variant="outline" onClick={() => onEdit(service)}>
                  <Pencil /> Edit
                </Button>
                {service.isActive ? (
                  <Button variant="outline" onClick={() => setConfirm('deactivate')}>
                    <PowerOff /> Deactivate
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => activate(true).catch(() => {})}>
                    <Power /> Activate
                  </Button>
                )}
                {canDelete && (
                  <Button variant="destructive" onClick={() => setConfirm('delete')}>
                    <Trash2 /> Delete
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirm === 'deactivate'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Deactivate "${service?.name}"?`}
        description="Customers and staff won’t be able to book it. Existing appointments stay as they are, and you can activate it again later."
        confirmLabel="Deactivate"
        onConfirm={() => activate(false)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete "${service?.name}"?`}
        description="The service has never been booked, so it can be removed. It will also be removed from staff assignments. This cannot be undone."
        confirmLabel="Delete service"
        destructive
        onConfirm={async () => {
          if (!service) return
          try {
            await deleteService(service.id)
            toast.success(`Deleted "${service.name}".`)
            onOpenChange(false)
          } catch (error) {
            toast.error(errorMessage(error))
            throw error
          }
        }}
      />
    </>
  )
}
