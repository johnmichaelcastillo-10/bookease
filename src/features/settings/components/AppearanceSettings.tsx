import { Monitor, Moon, Sun } from 'lucide-react'
import { Panel, PanelHeader } from '@/components/shared/PageHeader'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useUiStore, type ThemePreference } from '@/store/uiStore'

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun; help: string }[] = [
  { value: 'light', label: 'Light', icon: Sun, help: 'Always light' },
  { value: 'dark', label: 'Dark', icon: Moon, help: 'Always dark' },
  { value: 'system', label: 'System', icon: Monitor, help: 'Follow this device' },
]

/** Per-device preferences, saved in localStorage rather than the business database. */
export function AppearanceSettings() {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const setCollapsed = useUiStore((s) => s.setSidebarCollapsed)
  const pageSize = useUiStore((s) => s.pageSize)
  const setPageSize = useUiStore((s) => s.setPageSize)

  return (
    <Panel>
      <PanelHeader
        title="Appearance"
        description="These preferences apply to this browser only and are saved in localStorage. They aren’t part of backups."
      />
      <div className="space-y-6 p-4">
        <fieldset>
          <legend className="text-sm font-medium">Theme</legend>
          <RadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePreference)} className="mt-2 grid gap-2 sm:grid-cols-3">
            {THEMES.map((t) => (
              <Label
                key={t.value}
                htmlFor={`theme-${t.value}`}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3 has-data-checked:border-primary/50 has-data-checked:bg-brand-soft/40"
              >
                <RadioGroupItem id={`theme-${t.value}`} value={t.value} aria-label={t.label} />
                <t.icon className="size-4 text-muted-foreground" aria-hidden />
                <span>
                  <span className="block text-sm font-medium">{t.label}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{t.help}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </fieldset>

        <div className="flex items-start justify-between gap-4 rounded-md border p-3">
          <div>
            <Label htmlFor="ap-sidebar" className="text-sm font-medium">
              Collapse the sidebar
            </Label>
            <p id="ap-sidebar-description" className="mt-0.5 text-xs text-muted-foreground">
              Show only icons in the admin navigation on wide screens.
            </p>
          </div>
          <Switch id="ap-sidebar" checked={collapsed} onCheckedChange={setCollapsed} aria-describedby="ap-sidebar-description" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border p-3">
          <div>
            <Label htmlFor="ap-rows" className="text-sm font-medium">
              Rows per page
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">Default page size for tables.</p>
          </div>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger id="ap-rows" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Panel>
  )
}
