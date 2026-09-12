import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { REEL_HEIGHT, REEL_WIDTH } from '../types'
import type { TextLayer } from '../types'
import { clamp, formatTime } from '../lib/mediaUtils'
import { useEditorStore } from '../store/editorStore'

interface Size {
  w: number
  h: number
}

export function PreviewStage() {
  const videoUrl = useEditorStore((s) => s.videoUrl)
  const trimStart = useEditorStore((s) => s.trimStart)
  const trimEnd = useEditorStore((s) => s.trimEnd)
  const crop = useEditorStore((s) => s.crop)
  const setCrop = useEditorStore((s) => s.setCrop)
  const filter = useEditorStore((s) => s.filter)
  const textLayers = useEditorStore((s) => s.textLayers)
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer)
  const selectedTextId = useEditorStore((s) => s.selectedTextId)
  const selectText = useEditorStore((s) => s.selectText)
  const activeTab = useEditorStore((s) => s.activeTab)
  const currentTime = useEditorStore((s) => s.currentTime)
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying)
  const audio = useEditorStore((s) => s.audio)
  const muteOriginal = useEditorStore((s) => s.muteOriginal)
  const originalVolume = useEditorStore((s) => s.originalVolume)

  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const bgAudioRef = useRef<HTMLAudioElement>(null)
  const [containerSize, setContainerSize] = useState<Size>({ w: 0, h: 0 })
  const [natural, setNatural] = useState<Size>({ w: 0, h: 0 })

  const duration = Math.max(0, trimEnd - trimStart)

  // Track container size responsively.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const box = entry.contentRect
        setContainerSize({ w: box.width, h: box.height })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Keep the video's actual playback time in sync with the trimmed timeline.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const target = trimStart + currentTime
    if (Math.abs(video.currentTime - target) > 0.08) {
      video.currentTime = target
    }
  }, [currentTime, trimStart, videoUrl])

  // Sync background audio position with the relative timeline.
  useEffect(() => {
    const bg = bgAudioRef.current
    if (!bg || !audio) return
    const target = audio.offset + currentTime
    if (Math.abs(bg.currentTime - target) > 0.08) {
      bg.currentTime = target
    }
  }, [currentTime, audio])

  // Play / pause both video and background audio together, looping within the trim window.
  useEffect(() => {
    const video = videoRef.current
    const bg = bgAudioRef.current
    if (!video) return
    if (isPlaying) {
      video.play().catch(() => {})
      bg?.play().catch(() => {})
    } else {
      video.pause()
      bg?.pause()
    }
  }, [isPlaying])

  // Drive the relative currentTime from the video's native timeupdate, looping at trimEnd.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    function onTimeUpdate() {
      if (!video) return
      const rel = video.currentTime - trimStart
      if (rel >= duration) {
        video.currentTime = trimStart
        if (bgAudioRef.current && audio) bgAudioRef.current.currentTime = audio.offset
        setCurrentTime(0)
      } else {
        setCurrentTime(Math.max(0, rel))
      }
    }
    video.addEventListener('timeupdate', onTimeUpdate)
    return () => video.removeEventListener('timeupdate', onTimeUpdate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimStart, duration, audio])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = muteOriginal || originalVolume <= 0
    video.volume = clamp(originalVolume, 0, 1)
  }, [muteOriginal, originalVolume])

  useEffect(() => {
    const bg = bgAudioRef.current
    if (bg && audio) bg.volume = clamp(audio.volume, 0, 1)
  }, [audio])

  if (!videoUrl) return null

  const zoom = Math.max(1, crop.zoom || 1)
  const cw = containerSize.w
  const ch = containerSize.h
  const vw = natural.w
  const vh = natural.h

  let videoStyle: React.CSSProperties = { display: 'none' }
  let exX = 0
  let exY = 0
  if (cw > 0 && ch > 0 && vw > 0 && vh > 0) {
    const baseScale = Math.max(cw / vw, ch / vh)
    const scale = baseScale * zoom
    const scaledW = vw * scale
    const scaledH = vh * scale
    exX = Math.max(0, scaledW - cw)
    exY = Math.max(0, scaledH - ch)
    const dx = -(exX / 2) * (1 + crop.panX / 100)
    const dy = -(exY / 2) * (1 + crop.panY / 100)
    videoStyle = {
      position: 'absolute',
      width: scaledW,
      height: scaledH,
      left: dx,
      top: dy,
      filter: cssFilter(filter),
    }
  }

  function handlePanPointerDown(e: React.PointerEvent) {
    if (activeTab !== 'crop') return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startY = e.clientY
    const startPanX = crop.panX
    const startPanY = crop.panY
    function onMove(ev: PointerEvent) {
      const deltaX = ev.clientX - startX
      const deltaY = ev.clientY - startY
      const deltaPanX = exX > 0 ? (-200 * deltaX) / exX : 0
      const deltaPanY = exY > 0 ? (-200 * deltaY) / exY : 0
      setCrop({
        panX: clamp(startPanX + deltaPanX, -100, 100),
        panY: clamp(startPanY + deltaPanY, -100, 100),
      })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const visibleLayers = textLayers.filter((l) => currentTime >= l.start && currentTime <= l.end)

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={containerRef}
        onPointerDown={handlePanPointerDown}
        className="relative w-full max-w-[min(70vh,380px)] overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-zinc-800"
        style={{
          aspectRatio: `${REEL_WIDTH} / ${REEL_HEIGHT}`,
          touchAction: 'none',
          containerType: 'inline-size',
        } as React.CSSProperties}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          style={videoStyle}
          playsInline
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            setNatural({ w: v.videoWidth, h: v.videoHeight })
            v.currentTime = trimStart
          }}
        />
        {activeTab === 'crop' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0">
            <span className="rounded-full bg-black/50 px-3 py-1 text-xs text-white/80 backdrop-blur">
              Arraste para reposicionar
            </span>
          </div>
        )}
        {visibleLayers.map((layer) => (
          <TextOverlay
            key={layer.id}
            layer={layer}
            selected={selectedTextId === layer.id}
            editable={activeTab === 'text'}
            onSelect={() => selectText(layer.id)}
            onChange={(patch) => updateTextLayer(layer.id, patch)}
            containerRef={containerRef}
          />
        ))}
      </div>

      {audio && (
        <audio ref={bgAudioRef} src={audio.url} preload="metadata" />
      )}

      <PlaybackBar
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onSeek={(t) => setCurrentTime(clamp(t, 0, duration))}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
      />
    </div>
  )
}

function cssFilter(f: { brightness: number; contrast: number; saturation: number; grayscale: boolean; sepia: boolean }) {
  const parts = [
    `brightness(${(1 + f.brightness).toFixed(2)})`,
    `contrast(${(1 + f.contrast).toFixed(2)})`,
    `saturate(${f.grayscale ? 0 : (1 + f.saturation).toFixed(2)})`,
  ]
  if (f.sepia) parts.push('sepia(0.75)')
  return parts.join(' ')
}

function PlaybackBar({
  currentTime,
  duration,
  isPlaying,
  onSeek,
  onTogglePlay,
}: {
  currentTime: number
  duration: number
  isPlaying: boolean
  onSeek: (t: number) => void
  onTogglePlay: () => void
}) {
  return (
    <div className="flex w-full max-w-[min(70vh,380px)] items-center gap-3 text-sm text-zinc-300">
      <button
        onClick={onTogglePlay}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700"
        aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(0.01, duration)}
        step={0.01}
        value={Math.min(currentTime, duration)}
        onChange={(e) => onSeek(Number(e.target.value))}
      />
      <span className="w-24 shrink-0 text-right font-mono text-xs text-zinc-400">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  )
}

function TextOverlay({
  layer,
  selected,
  editable,
  onSelect,
  onChange,
  containerRef,
}: {
  layer: TextLayer
  selected: boolean
  editable: boolean
  onSelect: () => void
  onChange: (patch: Partial<TextLayer>) => void
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  function onPointerDown(e: React.PointerEvent) {
    if (!editable) return
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    function onMove(ev: PointerEvent) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = clamp(((ev.clientX - rect.left) / rect.width) * 100, 2, 98)
      const y = clamp(((ev.clientY - rect.top) / rect.height) * 100, 2, 98)
      onChange({ x, y })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute max-w-[90%] whitespace-pre-wrap break-words"
      style={{
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        transform: 'translate(-50%, -50%)',
        fontSize: `${(layer.fontSize / REEL_WIDTH) * 100}cqw`,
        color: layer.color,
        fontWeight: layer.bold ? 700 : 400,
        textAlign: layer.align,
        backgroundColor: layer.backgroundColor === 'transparent' ? undefined : `${layer.backgroundColor}8c`,
        padding: layer.backgroundColor === 'transparent' ? 0 : '0.15em 0.35em',
        borderRadius: layer.backgroundColor === 'transparent' ? 0 : '0.15em',
        outline: selected && editable ? '2px dashed #f472b6' : 'none',
        outlineOffset: 4,
        cursor: editable ? 'move' : 'default',
        pointerEvents: editable ? 'auto' : 'none',
      }}
    >
      {layer.text || ' '}
    </div>
  )
}
