import { BarChart3, Table2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Panel, PanelHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { VolumePoint } from '@/services/reports/reportService'
import { useChartTheme } from './chartTheme'

export interface LegendItem {
  label: string
  color: string
}

export interface ChartTable {
  headers: string[]
  rows: (string | number)[][]
}

/** Legend as text + colour swatch; text stays in text tokens, identity rides the swatch. */
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * A titled chart panel with a chart/table toggle. The table is the accessible (and
 * low-contrast-safe) view of the same numbers; the chart carries an aria summary.
 */
export function ChartFrame({
  title,
  description,
  legend,
  table,
  summary,
  children,
  className,
  toolbar,
}: {
  title: string
  description?: string
  /** Extra controls in the header (e.g. a day/week/month toggle). */
  toolbar?: React.ReactNode
  legend?: LegendItem[]
  table: ChartTable
  /** One-sentence description of what the chart shows, for screen readers. */
  summary: string
  children: React.ReactNode
  className?: string
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const descId = useId()
  return (
    <Panel className={cn('print-area flex min-w-0 flex-col', className)}>
      <PanelHeader
        title={title}
        description={description}
        actions={
          <>
          {toolbar}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setView((v) => (v === 'chart' ? 'table' : 'chart'))}
            aria-label={view === 'chart' ? `Show ${title} as a table` : `Show ${title} as a chart`}
            title={view === 'chart' ? 'Table view' : 'Chart view'}
          >
            {view === 'chart' ? <Table2 /> : <BarChart3 />}
          </Button>
          </>
        }
      />
      <div className="flex-1 px-4 py-3">
        {view === 'chart' ? (
          <figure aria-describedby={descId} className="m-0">
            <p id={descId} className="sr-only">
              {summary}
            </p>
            {legend && legend.length > 1 && (
              <div className="mb-3">
                <ChartLegend items={legend} />
              </div>
            )}
            {children}
          </figure>
        ) : (
          <DataGrid table={table} caption={title} />
        )}
      </div>
    </Panel>
  )
}

export function DataGrid({ table, caption }: { table: ChartTable; caption: string }) {
  return (
    <div className="max-h-80 overflow-auto">
      <Table>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {table.headers.map((h, i) => (
              <TableHead key={h} className={cn('h-8 text-xs', i > 0 && 'text-right')}>
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((row, r) => (
            <TableRow key={r}>
              {row.map((cell, i) => (
                <TableCell key={i} className={cn('py-1.5 text-sm', i > 0 && 'text-right tabular')}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

interface TooltipEntry {
  name?: string | number
  value?: number | string | (number | string)[]
  color?: string
  dataKey?: string | number | ((obj: unknown) => unknown)
}

function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean
  payload?: readonly TooltipEntry[]
  label?: string | number
  format: (n: number) => string
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + Number(p.value ?? 0), 0)
  return (
    <div className="min-w-40 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1.5 font-medium">{label}</p>
      <ul className="space-y-1">
        {[...payload].reverse().map((p) => (
          <li key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span aria-hidden className="size-2 rounded-sm" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-medium tabular">{format(Number(p.value ?? 0))}</span>
          </li>
        ))}
      </ul>
      {payload.length > 1 && (
        <p className="mt-1.5 flex justify-between border-t pt-1.5 text-muted-foreground">
          Total <span className="font-medium text-popover-foreground tabular">{format(total)}</span>
        </p>
      )}
    </div>
  )
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

/** Axis money in compact form from cents: 45000 → "$450", 250000 → "$2.5K". */
function compactMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(cents / 100)
  } catch {
    return compact.format(cents / 100)
  }
}

interface StackSeries {
  key: string
  name: string
  color: string
}

/**
 * Stacked columns with the dataviz mark specs: ≤24px columns, 4px rounded top on the last
 * series only, 2px surface gap between segments, hairline horizontal grid, one y-axis.
 */
function StackedColumns({
  data,
  series,
  format,
  axisFormat,
  height = 240,
}: {
  data: Record<string, string | number>[]
  series: StackSeries[]
  format: (n: number) => string
  axisFormat: (n: number) => string
  height?: number
}) {
  const theme = useChartTheme()
  return (
    <div className="text-muted-foreground" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.18} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'currentColor', fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'currentColor', fontSize: 11 }}
            width={44}
            allowDecimals={false}
            tickFormatter={(v: number) => axisFormat(v)}
          />
          <Tooltip
            cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
            content={(props) => <ChartTooltip {...(props as object)} format={format} />}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="stack"
              fill={s.color}
              maxBarSize={24}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
              shape={(props: unknown) => <GapRect {...(props as GapRectProps)} gap={i > 0 ? 2 : 0} surface={theme.surface} />}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface GapRectProps {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  radius?: number | number[]
}

/** A bar segment with a surface-coloured gap underneath it (separates stacked segments). */
function GapRect({ x = 0, y = 0, width = 0, height = 0, fill, radius, gap, surface }: GapRectProps & { gap: number; surface: string }) {
  if (height <= 0 || width <= 0) return null
  const r = Array.isArray(radius) ? Math.min(radius[0] ?? 0, height, width / 2) : 0
  const h = Math.max(0, height - gap)
  if (h <= 0) return null
  if (r <= 0) return <rect x={x} y={y} width={width} height={h} fill={fill} />
  const rr = Math.min(r, h)
  const path = `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + width - rr} Q${x + width},${y} ${x + width},${y + rr} V${y + h} Z`
  return (
    <g>
      <path d={path} fill={fill} />
      {gap > 0 && <rect x={x} y={y + h} width={width} height={gap} fill={surface} />}
    </g>
  )
}

/** Appointment volume per bucket: completed / scheduled / cancelled & no-show. */
export function VolumeChart({
  points,
  title = 'Appointment volume',
  description,
  toolbar,
}: {
  points: VolumePoint[]
  title?: string
  description?: string
  toolbar?: React.ReactNode
}) {
  const theme = useChartTheme()
  const data = points.map((p) => ({
    label: p.label,
    completed: p.byStatus.completed,
    scheduled: p.byStatus.pending + p.byStatus.confirmed,
    lost: p.byStatus.cancelled + p.byStatus['no-show'],
  }))
  const series: StackSeries[] = [
    { key: 'completed', name: 'Completed', color: theme.completed },
    { key: 'scheduled', name: 'Pending & confirmed', color: theme.scheduled },
    { key: 'lost', name: 'Cancelled & no-show', color: theme.lost },
  ]
  const total = points.reduce((s, p) => s + p.total, 0)
  const peak = points.reduce((m, p) => (p.total > m.total ? p : m), points[0] ?? { label: '', total: 0 })
  return (
    <ChartFrame
      title={title}
      description={description}
      toolbar={toolbar}
      legend={series.map((s) => ({ label: s.name, color: s.color }))}
      summary={`${total} appointments across ${points.length} periods. Busiest: ${peak.label} with ${peak.total}.`}
      table={{
        headers: ['Period', 'Completed', 'Pending & confirmed', 'Cancelled & no-show', 'Total'],
        rows: data.map((d, i) => [d.label, d.completed, d.scheduled, d.lost, points[i]!.total]),
      }}
    >
      <StackedColumns data={data} series={series} format={(n) => String(n)} axisFormat={(n) => compact.format(n)} />
    </ChartFrame>
  )
}

/** Revenue per bucket: completed (realized) + projected (pending & confirmed). */
export function RevenueChart({
  points,
  currency,
  title = 'Revenue',
  description = 'Completed is realized revenue; projected is the value of pending and confirmed bookings.',
  toolbar,
}: {
  points: VolumePoint[]
  currency: string
  title?: string
  description?: string
  toolbar?: React.ReactNode
}) {
  const theme = useChartTheme()
  const data = points.map((p) => ({ label: p.label, completed: p.completedCents, projected: p.projectedCents }))
  const series: StackSeries[] = [
    { key: 'completed', name: 'Completed', color: theme.completed },
    { key: 'projected', name: 'Projected', color: theme.scheduled },
  ]
  const totalCompleted = points.reduce((s, p) => s + p.completedCents, 0)
  const totalProjected = points.reduce((s, p) => s + p.projectedCents, 0)
  const money = (n: number) => formatMoney(n, currency)
  return (
    <ChartFrame
      title={title}
      description={description}
      toolbar={toolbar}
      legend={series.map((s) => ({ label: s.name, color: s.color }))}
      summary={`Completed revenue ${money(totalCompleted)} and projected revenue ${money(totalProjected)} across ${points.length} periods.`}
      table={{
        headers: ['Period', 'Completed', 'Projected', 'Total'],
        rows: data.map((d) => [d.label, money(d.completed), money(d.projected), money(d.completed + d.projected)]),
      }}
    >
      <StackedColumns
        data={data}
        series={series}
        format={money}
        axisFormat={(n) => compactMoney(n, currency)}
      />
    </ChartFrame>
  )
}

export interface BarRow {
  id: string
  label: React.ReactNode
  /** Plain-text label for the table and aria. */
  text: string
  value: number
  display: string
  color: string
}

/**
 * Horizontal bars in plain HTML: thin 10px bars with a 4px rounded end, value at the tip in a
 * text token. Used for rankings and part-to-whole with few categories.
 */
export function HorizontalBars({ rows, valueLabel = 'Value' }: { rows: BarRow[]; valueLabel?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.id} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]" title={`${r.text}: ${r.display}`}>
          <span className="truncate text-sm">{r.label}</span>
          <span className="flex items-center gap-2" aria-label={`${r.text}, ${valueLabel.toLowerCase()} ${r.display}`}>
            <span className="h-2.5 rounded-r-[4px]" style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / max) * 100)}%`, background: r.color }} />
            <span className="shrink-0 text-xs font-medium text-muted-foreground tabular">{r.display}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
