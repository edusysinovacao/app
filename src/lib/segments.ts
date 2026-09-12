import type { TimeRange } from '../types'

/**
 * The editor keeps a single [trimStart, trimEnd] range plus a list of "cuts"
 * (silences/breaths, in the ORIGINAL video's timeline) to remove from inside it.
 * Everything else — preview playback, the text-layer timeline, and the final
 * export — works in terms of the "effective" timeline: the cuts removed and
 * the remaining pieces played back to back, starting at 0.
 *
 * These helpers convert between the two. `computeKeepSegments` is the single
 * source of truth: both the preview and the ffmpeg export build their view of
 * the world from the same kept-segment list, so they can never disagree.
 */

/** The kept (i.e. not cut) sub-ranges of [trimStart, trimEnd], in original-video time, in order. */
export function computeKeepSegments(trimStart: number, trimEnd: number, cuts: TimeRange[]): TimeRange[] {
  const clamped = cuts
    .map((c) => ({ start: Math.max(trimStart, Math.min(c.start, trimEnd)), end: Math.max(trimStart, Math.min(c.end, trimEnd)) }))
    .filter((c) => c.end > c.start)
    .sort((a, b) => a.start - b.start)

  const merged: TimeRange[] = []
  for (const c of clamped) {
    const last = merged[merged.length - 1]
    if (last && c.start <= last.end) {
      last.end = Math.max(last.end, c.end)
    } else {
      merged.push({ ...c })
    }
  }

  const keep: TimeRange[] = []
  let cursor = trimStart
  for (const c of merged) {
    if (c.start > cursor) keep.push({ start: cursor, end: c.start })
    cursor = Math.max(cursor, c.end)
  }
  if (cursor < trimEnd) keep.push({ start: cursor, end: trimEnd })

  // Never return an empty timeline (e.g. everything got cut) — fall back to a sliver
  // of the trim range so playback/export always has something to work with.
  if (keep.length === 0) return [{ start: trimStart, end: Math.min(trimEnd, trimStart + 0.05) }]
  return keep
}

export function totalDuration(segments: TimeRange[]): number {
  return segments.reduce((sum, s) => sum + (s.end - s.start), 0)
}

/** Maps a position on the effective timeline (0..totalDuration) to the corresponding original-video time. */
export function sourceTimeFromEffective(t: number, segments: TimeRange[]): number {
  let remaining = t
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const len = seg.end - seg.start
    if (remaining <= len || i === segments.length - 1) {
      return seg.start + Math.max(0, Math.min(remaining, len))
    }
    remaining -= len
  }
  return 0
}

export interface Locate {
  /** Index into `segments` that this source time falls in (or the next one, if in a gap). */
  segmentIndex: number
  /** The corresponding position on the effective timeline. */
  effectiveTime: number
  /** True when `sourceTime` falls inside a cut (between kept segments), not in a kept one. */
  inGap: boolean
}

/** Maps an original-video time to its place on the effective timeline. */
export function locate(sourceTime: number, segments: TimeRange[]): Locate {
  let acc = 0
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (sourceTime < seg.start) return { segmentIndex: i, effectiveTime: acc, inGap: true }
    if (sourceTime <= seg.end) return { segmentIndex: i, effectiveTime: acc + (sourceTime - seg.start), inGap: false }
    acc += seg.end - seg.start
  }
  const lastIndex = Math.max(0, segments.length - 1)
  return { segmentIndex: lastIndex, effectiveTime: acc, inGap: true }
}
