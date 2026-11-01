/** Services offered by the business and their categories. */
import { db } from '@/database/db'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { categoriesRepository, servicesRepository } from '@/database/repositories/catalogRepository'
import { amountToCents, formatDuration } from '@/lib/format'
import { newId } from '@/lib/ids'
import { nowTimestamp } from '@/services/clock'
import { BusinessRuleError, NotFoundError, ValidationError } from '@/services/errors'
import { logActivity } from '@/services/events'
import type { ID, RecordSource, Service, ServiceCategory } from '@/types/models'
import { categoryInputSchema, serviceInputSchema, type ServiceInput } from '@/validation/schemas'

function parse(input: ServiceInput): ServiceInput {
  const parsed = serviceInputSchema.safeParse(input)
  if (!parsed.success) throw ValidationError.fromZod(parsed.error)
  return parsed.data
}

export function createService(input: ServiceInput, source: RecordSource = 'user'): Promise<Service> {
  const value = parse(input)
  return db.transaction('rw', db.services, db.serviceCategories, db.activityLogs, async () => {
    if (!(await categoriesRepository.get(value.categoryId))) throw new NotFoundError('The category')
    const now = nowTimestamp()
    const { price, ...rest } = value
    const service: Service = { id: newId(), ...rest, priceCents: amountToCents(price), source, createdAt: now, updatedAt: now }
    await servicesRepository.put(service)
    await logActivity({
      entityType: 'service',
      entityId: service.id,
      action: 'service.created',
      description: `Added service "${service.name}" (${formatDuration(service.durationMinutes)}).`,
    })
    return service
  })
}

/**
 * Updates a service. Existing appointments keep their own snapshot of name, duration, buffer
 * and price, so editing here only affects bookings made afterwards.
 */
export function updateService(id: ID, input: ServiceInput): Promise<Service> {
  const value = parse(input)
  return db.transaction('rw', db.services, db.serviceCategories, db.activityLogs, async () => {
    const existing = await servicesRepository.get(id)
    if (!existing) throw new NotFoundError('The service')
    if (!(await categoriesRepository.get(value.categoryId))) throw new NotFoundError('The category')
    const { price, ...rest } = value
    const updated: Service = { ...existing, ...rest, priceCents: amountToCents(price), updatedAt: nowTimestamp() }
    await servicesRepository.put(updated)
    const changes: string[] = []
    if (existing.durationMinutes !== updated.durationMinutes) changes.push(`duration ${existing.durationMinutes}→${updated.durationMinutes} min`)
    if (existing.priceCents !== updated.priceCents) changes.push('price')
    if (existing.isActive !== updated.isActive) changes.push(updated.isActive ? 'activated' : 'deactivated')
    await logActivity({
      entityType: 'service',
      entityId: id,
      action: 'service.updated',
      description: `Updated service "${updated.name}"${changes.length ? ` (${changes.join(', ')})` : ''}.`,
    })
    return updated
  })
}

export function setServiceActive(id: ID, isActive: boolean): Promise<Service> {
  return db.transaction('rw', db.services, db.activityLogs, async () => {
    const existing = await servicesRepository.get(id)
    if (!existing) throw new NotFoundError('The service')
    const updated = { ...existing, isActive, updatedAt: nowTimestamp() }
    await servicesRepository.put(updated)
    await logActivity({
      entityType: 'service',
      entityId: id,
      action: isActive ? 'service.activated' : 'service.deactivated',
      description: `${isActive ? 'Activated' : 'Deactivated'} service "${existing.name}".`,
    })
    return updated
  })
}

/** A service can be deleted only while no appointment references it; otherwise deactivate it. */
export async function canDeleteService(id: ID): Promise<boolean> {
  return (await appointmentsRepository.countByService(id)) === 0
}

export function deleteService(id: ID): Promise<void> {
  return db.transaction('rw', db.services, db.appointments, db.staff, db.activityLogs, async () => {
    const existing = await servicesRepository.get(id)
    if (!existing) throw new NotFoundError('The service')
    const used = await appointmentsRepository.countByService(id)
    if (used > 0) {
      throw new BusinessRuleError(
        `"${existing.name}" is used by ${used} appointment${used === 1 ? '' : 's'}. Deactivate it instead so history stays intact.`,
        'service-in-use',
      )
    }
    await servicesRepository.delete(id)
    // Remove the service from staff assignments.
    await db.staff.where('serviceIds').equals(id).modify((s) => {
      s.serviceIds = s.serviceIds.filter((sid) => sid !== id)
    })
    await logActivity({ entityType: 'service', entityId: id, action: 'service.deleted', description: `Deleted service "${existing.name}".` })
  })
}

export function createCategory(name: string): Promise<ServiceCategory> {
  const parsed = categoryInputSchema.safeParse({ name })
  if (!parsed.success) throw ValidationError.fromZod(parsed.error)
  return db.transaction('rw', db.serviceCategories, db.activityLogs, async () => {
    const all = await categoriesRepository.list()
    if (all.some((c) => c.name.toLowerCase() === parsed.data.name.toLowerCase())) {
      throw new BusinessRuleError(`A category called "${parsed.data.name}" already exists.`, 'duplicate-category')
    }
    const category: ServiceCategory = { id: newId(), name: parsed.data.name, createdAt: nowTimestamp() }
    await categoriesRepository.put(category)
    await logActivity({ entityType: 'service', entityId: category.id, action: 'category.created', description: `Added category "${category.name}".` })
    return category
  })
}

export function renameCategory(id: ID, name: string): Promise<ServiceCategory> {
  const parsed = categoryInputSchema.safeParse({ name })
  if (!parsed.success) throw ValidationError.fromZod(parsed.error)
  return db.transaction('rw', db.serviceCategories, db.activityLogs, async () => {
    const existing = await categoriesRepository.get(id)
    if (!existing) throw new NotFoundError('The category')
    const all = await categoriesRepository.list()
    if (all.some((c) => c.id !== id && c.name.toLowerCase() === parsed.data.name.toLowerCase())) {
      throw new BusinessRuleError(`A category called "${parsed.data.name}" already exists.`, 'duplicate-category')
    }
    const updated = { ...existing, name: parsed.data.name }
    await categoriesRepository.put(updated)
    await logActivity({ entityType: 'service', entityId: id, action: 'category.renamed', description: `Renamed category "${existing.name}" to "${updated.name}".` })
    return updated
  })
}

export function deleteCategory(id: ID): Promise<void> {
  return db.transaction('rw', db.serviceCategories, db.services, db.activityLogs, async () => {
    const existing = await categoriesRepository.get(id)
    if (!existing) throw new NotFoundError('The category')
    const used = await servicesRepository.countByCategory(id)
    if (used > 0) throw new BusinessRuleError(`"${existing.name}" still has ${used} service${used === 1 ? '' : 's'}. Move them first.`, 'category-in-use')
    await categoriesRepository.delete(id)
    await logActivity({ entityType: 'service', entityId: id, action: 'category.deleted', description: `Deleted category "${existing.name}".` })
  })
}
