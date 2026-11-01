import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { createCategory, deleteCategory, renameCategory } from '@/services/catalog/catalogService'
import { errorMessage } from '@/services/errors'
import type { ServiceCategory } from '@/types/models'

/** List, add, rename and delete service categories. Deleting a category in use is refused by the service. */
export function CategoriesDialog({
  open,
  onOpenChange,
  categories,
  serviceCounts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: ServiceCategory[]
  serviceCounts: Map<string, number>
}) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [toDelete, setToDelete] = useState<ServiceCategory | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    try {
      const created = await createCategory(newName)
      toast.success(`Added "${created.name}".`)
      setNewName('')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setAdding(false)
    }
  }

  async function saveRename(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    try {
      await renameCategory(editing.id, editing.name)
      setEditing(null)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Service categories</DialogTitle>
            <DialogDescription>Group services on the booking page and in reports.</DialogDescription>
          </DialogHeader>

          <form onSubmit={add} className="flex gap-2">
            <label htmlFor="new-category" className="sr-only">
              New category name
            </label>
            <Input id="new-category" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category name" />
            <Button type="submit" disabled={adding || newName.trim().length === 0}>
              {adding ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
              Add
            </Button>
          </form>

          {categories.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No categories yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {categories.map((c) => {
                const count = serviceCounts.get(c.id) ?? 0
                const isEditing = editing?.id === c.id
                return (
                  <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                    {isEditing ? (
                      <form onSubmit={saveRename} className="flex flex-1 items-center gap-1.5">
                        <label htmlFor={`rename-${c.id}`} className="sr-only">
                          Category name
                        </label>
                        <Input
                          id={`rename-${c.id}`}
                          autoFocus
                          value={editing.name}
                          onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                          onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setEditing(null))}
                          className="h-7"
                        />
                        <Button type="submit" size="icon-sm" variant="ghost" aria-label="Save name">
                          <Check />
                        </Button>
                        <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel rename" onClick={() => setEditing(null)}>
                          <X />
                        </Button>
                      </form>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {count === 0 ? 'No services' : `${count} service${count === 1 ? '' : 's'}`}
                          </span>
                        </span>
                        <Button size="icon-sm" variant="ghost" aria-label={`Rename ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}>
                          <Pencil />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => setToDelete(c)}>
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete "${toDelete?.name}"?`}
        description={
          (serviceCounts.get(toDelete?.id ?? '') ?? 0) > 0
            ? 'This category still has services. Move them to another category first; deleting will be refused.'
            : 'The category will be removed. This cannot be undone.'
        }
        confirmLabel="Delete category"
        destructive
        onConfirm={async () => {
          if (!toDelete) return
          try {
            await deleteCategory(toDelete.id)
            toast.success(`Deleted "${toDelete.name}".`)
          } catch (error) {
            toast.error(errorMessage(error))
            throw error
          }
        }}
      />
    </>
  )
}
