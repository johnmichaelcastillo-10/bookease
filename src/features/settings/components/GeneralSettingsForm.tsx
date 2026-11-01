import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { describedBy, FormItem } from '@/components/shared/FormItem'
import { Panel, PanelHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatPhone } from '@/lib/contact'
import { errorMessage } from '@/services/errors'
import { updateGeneralSettings } from '@/services/settings/settingsService'
import type { BusinessSettings } from '@/types/models'
import { generalSettingsSchema, type GeneralSettingsInput } from '@/validation/schemas'
import { LogoUploader } from './LogoUploader'
import { TimezonePicker } from './TimezonePicker'

const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'JPY', 'CNY', 'INR', 'SGD', 'PHP', 'HKD', 'CHF', 'SEK', 'MXN', 'BRL', 'ZAR', 'AED']

function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames(undefined, { type: 'currency' }).of(code) ?? code
  } catch {
    return code
  }
}

function toFormValues(s: BusinessSettings): GeneralSettingsInput {
  return {
    name: s.name,
    description: s.description,
    email: s.email,
    phone: s.phone ? formatPhone(s.phone) : '',
    address: s.address,
    currency: s.currency,
    timezone: s.timezone,
  }
}

export function GeneralSettingsForm({ settings }: { settings: BusinessSettings }) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<GeneralSettingsInput>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: toFormValues(settings),
  })

  const currencies = useMemo(
    () => (COMMON_CURRENCIES.includes(settings.currency) ? COMMON_CURRENCIES : [settings.currency, ...COMMON_CURRENCIES]),
    [settings.currency],
  )

  async function onSubmit(values: GeneralSettingsInput) {
    try {
      const saved = await updateGeneralSettings(values)
      reset(toFormValues(saved))
      toast.success('Business details saved.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader title="Branding" description="Shown in the admin sidebar and on the booking portal." />
        <div className="p-4">
          <LogoUploader logo={settings.logoDataUrl} name={settings.name} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Business details" description="Customers see these on the booking pages and confirmations." />
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 p-4 sm:grid-cols-2">
          <FormItem label="Business name" htmlFor="gs-name" error={errors.name?.message} required className="sm:col-span-2">
            <Input id="gs-name" {...register('name')} aria-invalid={!!errors.name} aria-describedby={describedBy('gs-name', errors.name?.message)} />
          </FormItem>
          <FormItem
            label="Description"
            htmlFor="gs-description"
            error={errors.description?.message}
            description="One or two sentences for the booking page."
            className="sm:col-span-2"
          >
            <Textarea
              id="gs-description"
              rows={3}
              {...register('description')}
              aria-invalid={!!errors.description}
              aria-describedby={describedBy('gs-description', errors.description?.message, true)}
            />
          </FormItem>
          <FormItem label="Email" htmlFor="gs-email" error={errors.email?.message}>
            <Input id="gs-email" type="email" autoComplete="email" {...register('email')} aria-invalid={!!errors.email} aria-describedby={describedBy('gs-email', errors.email?.message)} />
          </FormItem>
          <FormItem label="Phone" htmlFor="gs-phone" error={errors.phone?.message}>
            <Input id="gs-phone" type="tel" autoComplete="tel" {...register('phone')} aria-invalid={!!errors.phone} aria-describedby={describedBy('gs-phone', errors.phone?.message)} />
          </FormItem>
          <FormItem label="Address" htmlFor="gs-address" error={errors.address?.message} className="sm:col-span-2">
            <Input id="gs-address" autoComplete="street-address" {...register('address')} aria-invalid={!!errors.address} aria-describedby={describedBy('gs-address', errors.address?.message)} />
          </FormItem>
          <FormItem label="Currency" htmlFor="gs-currency" error={errors.currency?.message} description="Used for prices and reports. Existing prices are not converted.">
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="gs-currency" className="w-full" aria-invalid={!!errors.currency} aria-describedby={describedBy('gs-currency', errors.currency?.message, true)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code} · {currencyName(code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormItem>
          <FormItem
            label="Timezone"
            htmlFor="gs-timezone"
            error={errors.timezone?.message}
            description="Appointments are scheduled in this zone’s wall-clock time."
          >
            <Controller
              control={control}
              name="timezone"
              render={({ field }) => (
                <TimezonePicker
                  id="gs-timezone"
                  value={field.value}
                  onChange={(z) => field.onChange(z)}
                  invalid={!!errors.timezone}
                  describedBy={describedBy('gs-timezone', errors.timezone?.message, true)}
                />
              )}
            />
          </FormItem>
          <div className="flex justify-end gap-2 border-t pt-4 sm:col-span-2">
            <Button type="button" variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => reset(toFormValues(settings))}>
              Discard changes
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Save details
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  )
}
