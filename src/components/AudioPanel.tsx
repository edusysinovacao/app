import type React from 'react'
import { useRef } from 'react'
import { loadAudioMetadata } from '../lib/mediaUtils'
import { useEditorStore } from '../store/editorStore'
import { PanelSection, SliderRow } from './PanelUi'
import { clamp, formatTime } from '../lib/mediaUtils'

export function AudioPanel() {
  const audio = useEditorStore((s) => s.audio)
  const setAudio = useEditorStore((s) => s.setAudio)
  const setAudioVolume = useEditorStore((s) => s.setAudioVolume)
  const setAudioOffset = useEditorStore((s) => s.setAudioOffset)
  const muteOriginal = useEditorStore((s) => s.muteOriginal)
  const setMuteOriginal = useEditorStore((s) => s.setMuteOriginal)
  const originalVolume = useEditorStore((s) => s.originalVolume)
  const setOriginalVolume = useEditorStore((s) => s.setOriginalVolume)
  const trimStart = useEditorStore((s) => s.trimStart)
  const trimEnd = useEditorStore((s) => s.trimEnd)

  const trimDuration = Math.max(0.1, trimEnd - trimStart)
  const inputRef = useRef<HTMLInputElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  async function handleFile(file: File | undefined | null) {
    if (!file) return
    const meta = await loadAudioMetadata(file)
    setAudio({ file, url: meta.url, duration: meta.duration, volume: 0.8, offset: 0 })
  }

  const maxOffset = audio ? Math.max(0, audio.duration - trimDuration) : 0

  function dragWindow(e: React.PointerEvent) {
    if (!audio) return
    e.preventDefault()
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect) return
    const startX = e.clientX
    const startOffset = audio.offset
    ;(e.target as Element).setPointerCapture(e.pointerId)
    function onMove(ev: PointerEvent) {
      const deltaTime = ((ev.clientX - startX) / rect!.width) * audio!.duration
      setAudioOffset(clamp(startOffset + deltaTime, 0, maxOffset))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <PanelSection title="Áudio" description="Controle o som original do vídeo e adicione uma trilha sonora de fundo.">
      <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-3">
        <span className="text-xs text-zinc-300">Som original do vídeo</span>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={!muteOriginal}
            onChange={(e) => setMuteOriginal(!e.target.checked)}
          />
          <div className="h-5 w-9 rounded-full bg-zinc-700 peer-checked:bg-fuchsia-600" />
          <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
        </label>
      </div>
      {!muteOriginal && (
        <SliderRow
          label="Volume original"
          value={originalVolume}
          min={0}
          max={1.5}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={setOriginalVolume}
        />
      )}

      <div className="mt-2 border-t border-zinc-800 pt-3">
        {!audio ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-600 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            + Adicionar música
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="truncate">{audio.file.name}</span>
              <button onClick={() => setAudio(null)} className="ml-2 shrink-0 text-red-400 hover:underline">
                Remover
              </button>
            </div>

            <SliderRow
              label="Volume da música"
              value={audio.volume}
              min={0}
              max={1.5}
              step={0.01}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={setAudioVolume}
            />

            {maxOffset > 0 && (
              <div>
                <p className="mb-1 text-xs text-zinc-400">
                  Trecho usado: {formatTime(audio.offset)} – {formatTime(audio.offset + trimDuration)}
                </p>
                <div ref={barRef} className="relative h-6 rounded bg-zinc-800">
                  <div
                    onPointerDown={dragWindow}
                    className="absolute inset-y-0 cursor-grab rounded bg-fuchsia-600/50 ring-1 ring-fuchsia-500"
                    style={{
                      left: `${(audio.offset / audio.duration) * 100}%`,
                      width: `${(trimDuration / audio.duration) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </PanelSection>
  )
}
