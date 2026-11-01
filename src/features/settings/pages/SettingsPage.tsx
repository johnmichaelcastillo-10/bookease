import { useSearchParams } from 'react-router'
import { LoadingState } from '@/components/feedback/states'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBusinessSettings } from '@/hooks/useBusiness'
import { AppearanceSettings } from '../components/AppearanceSettings'
import { BookingSettingsForm } from '../components/BookingSettingsForm'
import { DataManagement } from '../components/DataManagement'
import { GeneralSettingsForm } from '../components/GeneralSettingsForm'

const TABS = [
  { value: 'general', label: 'General' },
  { value: 'booking', label: 'Booking rules' },
  { value: 'appearance', label: 'Appearance' },
  { value: 'data', label: 'Data' },
] as const
type TabValue = (typeof TABS)[number]['value']

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const settings = useBusinessSettings()
  const requested = params.get('tab')
  const tab: TabValue = TABS.some((t) => t.value === requested) ? (requested as TabValue) : 'general'

  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" description="Business details, booking rules, appearance and your local data." />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="px-3">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="general">
          {/* Re-initialise the form when settings change elsewhere (backup import, another tab). */}
          {settings ? <GeneralSettingsForm key={`${settings.name}|${settings.timezone}|${settings.currency}`} settings={settings} /> : <LoadingState />}
        </TabsContent>
        <TabsContent value="booking">{settings ? <BookingSettingsForm settings={settings} /> : <LoadingState />}</TabsContent>
        <TabsContent value="appearance">
          <AppearanceSettings />
        </TabsContent>
        <TabsContent value="data">
          <DataManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}
