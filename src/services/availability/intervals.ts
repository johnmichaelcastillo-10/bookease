/** Half-open minute intervals `[start, end)` and set operations on lists of them. */

export interface MinuteRange {
  start: number
  end: number
}

/** True when two half-open intervals share at least one minute. Touching ends do not overlap. */
export function overlaps(a: MinuteRange, b: MinuteRange): boolean {
  return a.start < b.end && a.end > b.start
}

/** Sorts, drops empty ranges and merges overlapping or touching ones. */
export function normalize(ranges: readonly MinuteRange[]): MinuteRange[] {
  const sorted = ranges.filter((r) => r.end > r.start).sort((a, b) => a.start - b.start)
  const out: MinuteRange[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else out.push({ ...r })
  }
  return out
}

/** `ranges` minus every range in `cuts`. */
export function subtract(ranges: readonly MinuteRange[], cuts: readonly MinuteRange[]): MinuteRange[] {
  let result = normalize(ranges)
  for (const cut of normalize(cuts)) {
    const next: MinuteRange[] = []
    for (const r of result) {
      if (!overlaps(r, cut)) {
        next.push(r)
        continue
      }
      if (cut.start > r.start) next.push({ start: r.start, end: cut.start })
      if (cut.end < r.end) next.push({ start: cut.end, end: r.end })
    }
    result = next
  }
  return result
}

/** Minutes present in both lists. */
export function intersect(a: readonly MinuteRange[], b: readonly MinuteRange[]): MinuteRange[] {
  const na = normalize(a)
  const nb = normalize(b)
  const out: MinuteRange[] = []
  let i = 0
  let j = 0
  while (i < na.length && j < nb.length) {
    const x = na[i]!
    const y = nb[j]!
    const start = Math.max(x.start, y.start)
    const end = Math.min(x.end, y.end)
    if (end > start) out.push({ start, end })
    if (x.end < y.end) i++
    else j++
  }
  return out
}

/** True when `inner` lies entirely inside one of `ranges`. */
export function containedIn(inner: MinuteRange, ranges: readonly MinuteRange[]): boolean {
  return normalize(ranges).some((r) => inner.start >= r.start && inner.end <= r.end)
}
