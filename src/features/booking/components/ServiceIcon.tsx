import { Briefcase, HeartHandshake, MessagesSquare, Sparkles, Wrench, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const KEYWORDS: [RegExp, LucideIcon][] = [
  [/consult|advice|follow/i, MessagesSquare],
  [/care|spa|beauty|wellness|massage/i, Sparkles],
  [/maint|repair|clean|install/i, Wrench],
  [/professional|business/i, Briefcase],
]

/** A neutral icon chosen from the category or service name; no images needed. */
export function ServiceIcon({ name, category, className }: { name: string; category?: string; className?: string }) {
  const Icon = KEYWORDS.find(([re]) => re.test(category ?? '') || re.test(name))?.[1] ?? HeartHandshake
  return (
    <span aria-hidden className={cn('flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-primary', className)}>
      <Icon className="size-4.5" />
    </span>
  )
}
