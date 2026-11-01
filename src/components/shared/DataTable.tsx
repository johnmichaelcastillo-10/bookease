import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/uiStore'
import { Pagination } from './Pagination'

export interface Column<T> {
  id: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  /** Enables sorting on this column. */
  sortValue?: (row: T) => string | number
  className?: string
  headerClassName?: string
}

export type SortState = { id: string; dir: 'asc' | 'desc' } | null

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: readonly T[]
  getRowId: (row: T) => string
  onRowClick?: (row: T) => void
  /** Rendered instead of the table below 768px. */
  mobileCard?: (row: T) => React.ReactNode
  empty?: React.ReactNode
  initialSort?: SortState
  /** Paginate client-side; set false for short lists. */
  paginate?: boolean
  caption?: string
  /** Changing this resets to page 1 (pass the active filters). */
  resetKey?: string
  rowClassName?: (row: T) => string | undefined
}

/**
 * Sortable, paginated table that turns into a card list on phones. Rows are clickable with
 * the keyboard (Enter/Space) when `onRowClick` is set.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  mobileCard,
  empty,
  initialSort = null,
  paginate = true,
  caption,
  resetKey = '',
  rowClassName,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(initialSort)
  const [pageState, setPageState] = useState({ page: 1, key: resetKey })
  const pageSize = useUiStore((s) => s.pageSize)
  const setPageSize = useUiStore((s) => s.setPageSize)
  // Reset to the first page whenever filters change (derived, no effect needed).
  const page = pageState.key === resetKey ? pageState.page : 1
  const setPage = (p: number) => setPageState({ page: p, key: resetKey })

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.id === sort.id)
    if (!col?.sortValue) return rows
    const value = col.sortValue
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * dir
    })
  }, [rows, sort, columns])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages)
  const visible = paginate ? sorted.slice((current - 1) * pageSize, current * pageSize) : sorted

  const toggleSort = (id: string) =>
    setSort((s) => (s?.id !== id ? { id, dir: 'asc' } : s.dir === 'asc' ? { id, dir: 'desc' } : null))

  if (rows.length === 0) return <>{empty}</>

  const activate = (row: T) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRowClick?.(row)
    }
  }

  return (
    <div>
      {mobileCard && (
        <ul className="divide-y md:hidden">
          {visible.map((row) => (
            <li key={getRowId(row)}>
              {onRowClick ? (
                <button type="button" onClick={() => onRowClick(row)} className="block w-full px-4 py-3 text-left hover:bg-muted/50 focus-visible:bg-muted/50">
                  {mobileCard(row)}
                </button>
              ) : (
                <div className="px-4 py-3">{mobileCard(row)}</div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className={cn(mobileCard && 'hidden md:block')}>
        <Table>
          {caption && <caption className="sr-only">{caption}</caption>}
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => {
                const active = sort?.id === col.id
                return (
                  <TableHead
                    key={col.id}
                    className={cn('h-9 text-xs font-medium text-muted-foreground', col.headerClassName)}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {col.sortValue ? (
                      <button type="button" onClick={() => toggleSort(col.id)} className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground">
                        {col.header}
                        {active ? sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <TableRow
                key={getRowId(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? activate(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(onRowClick && 'cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none', rowClassName?.(row))}
              >
                {columns.map((col) => (
                  <TableCell key={col.id} className={cn('py-2.5', col.className)}>
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {paginate && sorted.length > pageSize / 2 && (
        <Pagination page={current} pageSize={pageSize} total={sorted.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }} />
      )}
    </div>
  )
}
