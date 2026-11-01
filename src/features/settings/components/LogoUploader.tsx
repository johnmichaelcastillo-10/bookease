import { ImageUp, Loader2, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { BrandMark } from '@/components/shared/BrandMark'
import { Button } from '@/components/ui/button'
import { readImageAsDataUrl } from '@/lib/download'
import { errorMessage } from '@/services/errors'
import { updateLogo } from '@/services/settings/settingsService'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml'

/** Logo stored as a small data URL in the local settings record (no upload anywhere). */
export function LogoUploader({ logo, name }: { logo: string | null; name: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!ACCEPT.split(',').includes(file.type)) {
      toast.error('Use a PNG, JPEG, WebP or SVG image.')
      return
    }
    setBusy(true)
    try {
      await updateLogo(await readImageAsDataUrl(file, 160))
      toast.success('Logo updated.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await updateLogo(null)
      toast.success('Logo removed.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <BrandMark logo={logo} name={name} className="size-14 rounded-lg" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="animate-spin" /> : <ImageUp />}
            {logo ? 'Replace logo' : 'Upload logo'}
          </Button>
          {logo && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove}>
              <Trash2 /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPEG, WebP or SVG. Scaled to 160 px and kept in this browser.</p>
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="Logo image file"
        tabIndex={-1}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
