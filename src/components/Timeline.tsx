import type React from 'react'
import { useMemo, useRef } from 'react'
import { clamp, formatTime } from '../lib/mediaUtils'
import { computeKeepSegments, sourceTimeFromEffective, totalDuration } from '../lib/segments'
import { useEditorStore } from '../store/editorStore'

const MIN_TRIM_GAP = 0.2
const TRACK_COLORS = ['#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#fb7185']

export function Timeline() {
  const videoDuration = useEditorStore((s) => s.videoDuration)
  const trimStart = useEditorStore((s) => s.trimStart)
  const trimEnd = useEditorStore((s) => s.trimEnd)
  const setTrim = useEditorStore((s) => s.setTrim)
  const cuts = useEditorStore((s) => s.cuts)
  const currentTime = useEditorStore((s) => s.currentTime)
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying)
  const textLayers = useEditorStore((s) => s.textLayers)
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer)
  const selectedTextId = useEditorStore((s) => s.selectedTextId)
  const selectText = useEditorStore((s) => s.selectText)
  const setActiveTab = useEditorStore((s) => s.setActiveTab)

  const trackRef = useRef<HTMLDivElement>(null)
  const effectiveTrackRef = useRef<HTMLDivElement>(null)

  const keepSegments = useMemo(() => computeKeepSegments(trimStart, trimEnd, cuts), [trimStart, trimEnd, cuts])
  const effectiveDuration = Math.max(0.01, totalDuration(keepSegments))

  if (videoDuration <= 0) return null

  const pct = (t: number) => `${clamp((t / videoDuration) * 100, 0, 100)}%`
  const pctEff = (t: number) => `${clamp((t / effectiveDuration) * 100, 0, 100)}%`
  const sourcePlayhead = sourceTimeFromEffective(currentTime, keepSegments)

  function timeFromClientX(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return clamp(((clientX - rect.left) / rect.width) * videoDuration, 0, videoDuration)
  }

  function effectiveTimeFromClientX(clientX: number): number {
    const rect = effectiveTrackRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return clamp(((clientX - rect.left) / rect.width) * effectiveDuration, 0, effectiveDuration)
  }

  function dragHandle(which: 'start' | 'end') {
    return (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      ;(e.target as Element).setPointerCapture(e.pointerId)
      function onMove(ev: PointerEvent) {
        const t = timeFromClientX(ev.clientX)
        if (which === 'start') {
          setTrim(clamp(t, 0, trimEnd - MIN_TRIM_GAP), trimEnd)
        } else {
          setTrim(trimStart, clamp(t, trimStart + MIN_TRIM_GAP, videoDuration))
        }
        setCurrentTime(0)
      }
      function onUp() {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }

  function onScrub(e: React.PointerEvent) {
    setIsPlaying(false)
    const t = clamp(timeFromClientX(e.clientX), trimStart, trimEnd)
    setCurrentTime(Math.min(t - trimStart, effectiveDuration))
    ;(e.target as Element).setPointerCapture(e.pointerId)
    function onMove(ev: PointerEvent) {
      const tt = clamp(timeFromClientX(ev.clientX), trimStart, trimEnd)
      setCurrentTime(Math.min(tt - trimStart, effectiveDuration))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function onScrubEffective(e: React.PointerEvent) {
    setIsPlaying(false)
    setCurrentTime(effectiveTimeFromClientX(e.clientX))
    ;(e.target as Element).setPointerCapture(e.pointerId)
    function onMove(ev: PointerEvent) {
      setCurrentTime(effectiveTimeFromClientX(ev.clientX))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function dragTextBlock(id: string, mode: 'move' | 'start' | 'end') {
    return (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      selectText(id)
      setActiveTab('text')
      const layer = textLayers.find((l) => l.id === id)
      if (!layer) return
      const startX = e.clientX
      const layerDuration = layer.end - layer.start
      ;(e.target as Element).setPointerCapture(e.pointerId)
      function onMove(ev: PointerEvent) {
        const rect = effectiveTrackRef.current?.getBoundingClientRect()
        if (!rect) return
        const deltaTime = ((ev.clientX - startX) / rect.width) * effectiveDuration
        if (mode === 'move') {
          const newStart = clamp(layer!.start + deltaTime, 0, effectiveDuration - layerDuration)
          updateTextLayer(id, { start: newStart, end: newStart + layerDuration })
        } else if (mode === 'start') {
          const newStart = clamp(layer!.start + deltaTime, 0, layer!.end - MIN_TRIM_GAP)
          updateTextLayer(id, { start: newStart })
        } else {
          const newEnd = clamp(layer!.end + deltaTime, layer!.start + MIN_TRIM_GAP, effectiveDuration)
          updateTextLayer(id, { end: newEnd })
        }
      }
      function onUp() {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }

  return (
    <div className="w-full select-none px-1 pb-2">
      <div className="mb-1 flex justify-between font-mono text-[11px] text-zinc-500">
        <span>{formatTime(trimStart)}</span>
        <span>
          Vídeo final: {formatTime(effectiveDuration)}
          {cuts.length > 0 && ` (${cuts.length} corte${cuts.length > 1 ? 's' : ''} aplicado${cuts.length > 1 ? 's' : ''})`}
        </span>
        <span>{formatTime(trimEnd)}</span>
      </div>

      <div ref={trackRef} className="relative h-9 rounded-md bg-zinc-800" onPointerDown={onScrub}>
        {/* dimmed trimmed-out regions */}
        <div className="absolute inset-y-0 left-0 rounded-l-md bg-black/50" style={{ width: pct(trimStart) }} />
        <div
          className="absolute inset-y-0 right-0 rounded-r-md bg-black/50"
          style={{ width: `${100 - clamp((trimEnd / videoDuration) * 100, 0, 100)}%` }}
        />
        {/* active region */}
        <div
          className="absolute inset-y-0 rounded-sm bg-fuchsia-600/30 ring-1 ring-fuchsia-500/60"
          style={{ left: pct(trimStart), width: pct(trimEnd - trimStart) }}
        />
        {/* detected/applied cuts (silences, breaths) */}
        {cuts.map((cut, i) => (
          <div
            key={i}
            className="pointer-events-none absolute inset-y-0"
            style={{
              left: pct(cut.start),
              width: pct(cut.end - cut.start),
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(248,113,113,0.75) 0px, rgba(248,113,113,0.75) 3px, rgba(24,24,27,0.85) 3px, rgba(24,24,27,0.85) 6px)',
            }}
          />
        ))}
        {/* playhead (mapped back to its position in the original file) */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white"
          style={{ left: pct(sourcePlayhead) }}
        />
        {/* handles */}
        <div
          onPointerDown={dragHandle('start')}
          className="absolute inset-y-0 z-10 flex w-3 -translate-x-1/2 cursor-ew-resize items-center justify-center"
          style={{ left: pct(trimStart) }}
        >
          <div className="h-full w-1.5 rounded-full bg-fuchsia-400" />
        </div>
        <div
          onPointerDown={dragHandle('end')}
          className="absolute inset-y-0 z-10 flex w-3 -translate-x-1/2 cursor-ew-resize items-center justify-center"
          style={{ left: pct(trimEnd) }}
        >
          <div className="h-full w-1.5 rounded-full bg-fuchsia-400" />
        </div>
      </div>

      {/* Effective (final) timeline: what actually plays, cuts already skipped. Text layers live here. */}
      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-500">Final</span>
        <div ref={effectiveTrackRef} className="relative h-3 flex-1 rounded bg-zinc-800/70" onPointerDown={onScrubEffective}>
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white" style={{ left: pctEff(currentTime) }} />
        </div>
      </div>

      {textLayers.length > 0 && (
        <div className="mt-1 flex flex-col gap-1">
          {textLayers.map((layer, i) => (
            <div key={layer.id} className="relative h-6 rounded bg-zinc-900/60">
              <div
                onPointerDown={dragTextBlock(layer.id, 'move')}
                className="absolute inset-y-0 flex items-center overflow-hidden rounded px-1 text-[10px] font-medium text-black/80"
                style={{
                  left: pctEff(layer.start),
                  width: pctEff(layer.end - layer.start),
                  backgroundColor: TRACK_COLORS[i % TRACK_COLORS.length],
                  outline: selectedTextId === layer.id ? '2px solid white' : 'none',
                  cursor: 'grab',
                }}
              >
                <span className="truncate">{layer.text || 'Texto'}</span>
                <div
                  onPointerDown={dragTextBlock(layer.id, 'start')}
                  className="absolute inset-y-0 left-0 w-2 cursor-ew-resize"
                />
                <div
                  onPointerDown={dragTextBlock(layer.id, 'end')}
                  className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
