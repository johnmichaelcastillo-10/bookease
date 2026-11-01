import { AlertTriangle, Download, FileJson, HardDrive, Loader2, RotateCcw, ShieldCheck, Sparkles, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Panel, PanelHeader } from '@/components/shared/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { seedDemoData } from '@/database/seed/demoData'
import { useAppState } from '@/hooks/useBusiness'
import { downloadJson, readFileAsText } from '@/lib/download'
import { formatRelative, formatTimestamp } from '@/lib/format'
import {
  backupFileName,
  clearDemoData,
  exportBackup,
  getStorageInfo,
  importBackup,
  markBackupTaken,
  parseBackup,
  requestPersistentStorage,
  resetApplication,
  type ParsedBackup,
  type StorageInfo,
} from '@/services/data/backupService'
import { errorMessage, ValidationError } from '@/services/errors'

function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'Unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

const SUMMARY_LABELS: [keyof ParsedBackup['summary'], string][] = [
  ['appointments', 'Appointments'],
  ['customers', 'Customers'],
  ['services', 'Services'],
  ['staff', 'Staff'],
  ['blockedDates', 'Special dates'],
  ['activityLogs', 'Activity entries'],
]

function Row({ icon: Icon, title, description, action }: { icon: typeof Download; title: string; description: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{action}</div>
    </div>
  )
}

export function DataManagement() {
  const appState = useAppState()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [pending, setPending] = useState<ParsedBackup | null>(null)
  const [importError, setImportError] = useState<{ message: string; issues: string[] } | null>(null)
  const [confirm, setConfirm] = useState<'clear-demo' | 'reset' | null>(null)
  const [resetText, setResetText] = useState('')
  const [resetError, setResetError] = useState('')

  const refreshStorage = useCallback(() => {
    void getStorageInfo().then(setStorage)
  }, [])
  useEffect(refreshStorage, [refreshStorage])

  async function run(key: string, task: () => Promise<void>) {
    setBusy(key)
    try {
      await task()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
      refreshStorage()
    }
  }

  const handleExport = () =>
    run('export', async () => {
      const backup = await exportBackup()
      downloadJson(backupFileName(), backup)
      await markBackupTaken()
      toast.success(`Backup downloaded (${backup.data.appointments.length} appointments).`)
    })

  async function handleFile(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = ''
    if (!file) return
    setImportError(null)
    try {
      setPending(parseBackup(await readFileAsText(file)))
    } catch (error) {
      if (error instanceof ValidationError) {
        setImportError({ message: error.message.split(' · ')[0] ?? error.message, issues: error.issues.slice(0, 5).map((i) => `${i.path}: ${i.message}`) })
      } else {
        setImportError({ message: errorMessage(error), issues: [] })
      }
    }
  }

  async function confirmImport() {
    if (!pending) return
    try {
      await importBackup(pending)
      toast.success('Backup restored. All data was replaced.')
      setPending(null)
      refreshStorage()
    } catch (error) {
      toast.error(`${errorMessage(error)} Nothing was changed.`)
      throw error
    }
  }

  const handleSeed = () =>
    run('seed', async () => {
      const result = await seedDemoData()
      toast[result.seeded ? 'success' : 'info'](result.seeded ? `Loaded ${result.appointments} sample appointments.` : 'Sample data is already loaded.')
    })

  async function confirmClearDemo() {
    try {
      const result = await clearDemoData()
      toast.success(
        `Removed ${result.removed} sample records.${result.kept ? ` Kept ${result.kept} that your own appointments use.` : ''}`,
      )
    } catch (error) {
      toast.error(errorMessage(error))
      throw error
    }
  }

  async function confirmReset() {
    if (resetText.trim() !== 'RESET') {
      setResetError('Type RESET in capital letters to confirm.')
      throw new Error('not confirmed')
    }
    try {
      navigate('/admin', { replace: true })
      await resetApplication()
      toast.success('BookEase was reset. Choose how to start again.')
    } catch (error) {
      toast.error(errorMessage(error))
      throw error
    }
  }

  const demoLoaded = !!appState?.demoSeededAt
  const usagePct = storage?.usageBytes !== null && storage?.quotaBytes ? Math.min(100, (storage.usageBytes! / storage.quotaBytes) * 100) : null

  return (
    <div className="space-y-6">
      <Alert>
        <HardDrive aria-hidden />
        <AlertTitle>Your data lives in this browser</AlertTitle>
        <AlertDescription>
          BookEase has no server. Appointments, customers and settings are stored in this browser’s IndexedDB on this device only. They
          don’t sync to other devices or browsers, and clearing site data (or the browser freeing space) deletes them. Export a backup
          regularly and import it to move your data elsewhere.
        </AlertDescription>
      </Alert>

      <Panel>
        <PanelHeader title="Storage" description="What this browser reports about BookEase’s local storage." />
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Used</p>
            <p className="mt-1 text-lg font-semibold tabular">{storage ? formatBytes(storage.usageBytes) : '…'}</p>
            {usagePct !== null && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(usagePct, 1)}%` }} />
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">of {storage ? formatBytes(storage.quotaBytes) : '…'} available</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Persistent storage</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
              {storage?.persisted ? <ShieldCheck className="size-4 text-completed" aria-hidden /> : <AlertTriangle className="size-4 text-pending" aria-hidden />}
              {storage?.persisted === null || storage === null ? 'Not reported' : storage.persisted ? 'Granted' : 'Not granted'}
            </p>
            {!storage?.persisted && (
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0 text-xs"
                onClick={() =>
                  run('persist', async () => {
                    const ok = await requestPersistentStorage()
                    toast[ok ? 'success' : 'info'](ok ? 'The browser will keep BookEase data unless you clear it.' : 'The browser declined. Keep regular backups.')
                  })
                }
              >
                Ask the browser to keep data
              </Button>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last backup</p>
            <p className="mt-1 text-sm font-medium">{appState?.lastBackupAt ? formatTimestamp(appState.lastBackupAt) : 'Never'}</p>
            {appState?.lastBackupAt && <p className="text-xs text-muted-foreground">{formatRelative(appState.lastBackupAt)}</p>}
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Backup and restore" />
        <div className="divide-y">
          <Row
            icon={Download}
            title="Export full backup"
            description="Downloads every record (appointments, customers, services, staff, hours, settings, activity) as one JSON file."
            action={
              <Button variant="outline" size="sm" onClick={handleExport} disabled={busy === 'export'}>
                {busy === 'export' ? <Loader2 className="animate-spin" /> : <FileJson />} Export JSON
              </Button>
            }
          />
          <Row
            icon={Upload}
            title="Import backup"
            description="Checks every record first. If the file is valid you’ll see what it contains before anything is replaced."
            action={
              <>
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  <Upload /> Choose file…
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="Backup file"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </>
            }
          />
        </div>
        {importError && (
          <div className="px-4 pb-4">
            <Alert variant="destructive">
              <AlertTriangle aria-hidden />
              <AlertTitle>This backup can’t be imported</AlertTitle>
              <AlertDescription>
                <p>{importError.message}</p>
                {importError.issues.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 font-mono text-xs">
                    {importError.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-1">Your current data was not changed.</p>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Sample data" description="Demo records for “BrightSpace Services” are tagged so they can be removed without touching yours." />
        <div className="divide-y">
          <Row
            icon={Sparkles}
            title="Load sample data"
            description={demoLoaded ? 'Sample data is currently loaded.' : 'Adds sample services, staff, customers and appointments. Your records are not changed.'}
            action={
              <Button variant="outline" size="sm" onClick={handleSeed} disabled={demoLoaded || busy === 'seed'}>
                {busy === 'seed' ? <Loader2 className="animate-spin" /> : <Sparkles />} Load sample data
              </Button>
            }
          />
          <Row
            icon={Trash2}
            title="Clear sample data"
            description="Removes demo records. Demo services, staff or customers used by your own appointments are kept."
            action={
              <Button variant="outline" size="sm" onClick={() => setConfirm('clear-demo')} disabled={!demoLoaded}>
                <Trash2 /> Clear sample data
              </Button>
            }
          />
        </div>
      </Panel>

      <Panel className="border-destructive/40">
        <PanelHeader title="Danger zone" />
        <Row
          icon={RotateCcw}
          title="Reset application"
          description="Deletes everything BookEase stores in this browser and returns to first-launch setup. Export a backup first."
          action={
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setResetText('')
                setResetError('')
                setConfirm('reset')
              }}
            >
              <RotateCcw /> Reset application
            </Button>
          }
        />
      </Panel>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Replace all data with this backup?"
        description={
          pending ? (
            <>
              Backup from {pending.exportedAt ? formatTimestamp(pending.exportedAt) : 'an unknown date'}. Everything currently in this browser will be
              replaced. This can’t be undone, so export a backup of the current data first if you need it.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Replace all data"
        destructive
        onConfirm={confirmImport}
      >
        {pending && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border bg-muted/40 p-3 text-sm sm:grid-cols-3">
            {SUMMARY_LABELS.map(([key, label]) => (
              <div key={key}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-medium tabular">{pending.summary[key]}</dd>
              </div>
            ))}
          </dl>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'clear-demo'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Clear sample data?"
        description="Sample appointments, customers, services, staff and special dates are deleted. Records you created stay, along with any sample record they depend on."
        confirmLabel="Clear sample data"
        destructive
        onConfirm={confirmClearDemo}
      />

      <ConfirmDialog
        open={confirm === 'reset'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Reset BookEase?"
        description="This permanently deletes all appointments, customers, services, staff, hours, settings, notifications and activity in this browser."
        confirmLabel="Delete everything"
        destructive
        onConfirm={confirmReset}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="reset-confirm">
            Type <span className="font-mono font-semibold">RESET</span> to confirm
          </Label>
          <Input
            id="reset-confirm"
            value={resetText}
            onChange={(e) => {
              setResetText(e.target.value)
              setResetError('')
            }}
            autoComplete="off"
            aria-invalid={!!resetError}
            aria-describedby={resetError ? 'reset-confirm-error' : undefined}
          />
          {resetError && (
            <p id="reset-confirm-error" role="alert" className="text-xs font-medium text-destructive">
              {resetError}
            </p>
          )}
        </div>
      </ConfirmDialog>
    </div>
  )
}
