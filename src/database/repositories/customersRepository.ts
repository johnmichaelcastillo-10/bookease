import { db } from '@/database/db'
import { normalizeEmail } from '@/lib/contact'
import type { Customer, ID } from '@/types/models'

export const customersRepository = {
  list(): Promise<Customer[]> {
    return db.customers.orderBy('fullName').toArray()
  },
  get(id: ID): Promise<Customer | undefined> {
    return db.customers.get(id)
  },
  findByEmail(email: string): Promise<Customer[]> {
    return db.customers.where('normalizedEmail').equals(normalizeEmail(email)).toArray()
  },
  put(customer: Customer): Promise<ID> {
    return db.customers.put(customer)
  },
  delete(id: ID): Promise<void> {
    return db.customers.delete(id)
  },
  count(): Promise<number> {
    return db.customers.count()
  },
}
