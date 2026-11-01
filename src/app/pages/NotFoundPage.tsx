import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export default function NotFoundPage({ inAdmin = false }: { inAdmin?: boolean }) {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-lg border bg-background text-muted-foreground">
        <Compass className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-1 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">The address may be mistyped, or the page was moved.</p>
      <div className="mt-6 flex gap-2">
        <Button asChild>
          <Link to={inAdmin ? '/admin' : '/'}>{inAdmin ? 'Back to dashboard' : 'Go home'}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/book">Book an appointment</Link>
        </Button>
      </div>
    </div>
  )
}

export function AdminNotFound() {
  return <NotFoundPage inAdmin />
}
