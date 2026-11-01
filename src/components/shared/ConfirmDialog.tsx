import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /** Extra content between description and buttons (e.g. a reason field). */
  children?: React.ReactNode
  /** May be async; the dialog stays open and shows a spinner until it settles. Throw to keep it open. */
  onConfirm: () => unknown | Promise<unknown>
}

/** Confirmation for sensitive operations (cancel, delete, reset, import...). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Go back',
  destructive,
  children,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    setBusy(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      // The caller reports the error (toast); keep the dialog open so the user can retry.
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={handleConfirm} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
