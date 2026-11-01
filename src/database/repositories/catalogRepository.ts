import { db } from '@/database/db'
import type { ID, Service, ServiceCategory } from '@/types/models'

export const servicesRepository = {
  list(): Promise<Service[]> {
    return db.services.orderBy('name').toArray()
  },
  listActive(): Promise<Service[]> {
    return db.services.orderBy('name').filter((s) => s.isActive).toArray()
  },
  get(id: ID): Promise<Service | undefined> {
    return db.services.get(id)
  },
  put(service: Service): Promise<ID> {
    return db.services.put(service)
  },
  delete(id: ID): Promise<void> {
    return db.services.delete(id)
  },
  countByCategory(categoryId: ID): Promise<number> {
    return db.services.where('categoryId').equals(categoryId).count()
  },
}

export const categoriesRepository = {
  list(): Promise<ServiceCategory[]> {
    return db.serviceCategories.orderBy('name').toArray()
  },
  get(id: ID): Promise<ServiceCategory | undefined> {
    return db.serviceCategories.get(id)
  },
  put(category: ServiceCategory): Promise<ID> {
    return db.serviceCategories.put(category)
  },
  delete(id: ID): Promise<void> {
    return db.serviceCategories.delete(id)
  },
}
