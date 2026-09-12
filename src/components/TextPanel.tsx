import { useState } from 'react'
import { useEditorStore, nextId } from '../store/editorStore'
import { PanelSection, SliderRow } from './PanelUi'
import { formatTime } from '../lib/mediaUtils'
import { computeKeepSegments, totalDuration } from '../lib/segments'
import { extractEffectiveAudioSamples } from '../lib/ffmpegExport'
import type { TextLayer } from '../types'

const COLORS = ['#ffffff', '#000000', '#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa']

const LANGUAGES: { value: 'auto' | 'portuguese' | 'english' | 'spanish'; label: string }[] = [
  { value: 'portuguese', label: 'Português' },
  { value: 'english', label: 'Inglês' },
  { value: 'spanish', label: 'Espanhol' },
  { value: 'auto', label: 'Detectar automaticamente' },
]

export function TextPanel() {
  const videoFile = useEditorStore((s) => s.videoFile)
  const textLayers = useEditorStore((s) => s.textLayers)
  const addTextLayer = useEditorStore((s) => s.addTextLayer)
  const addTextLayers = useEditorStore((s) => s.addTextLayers)
  const removeTextLayer = useEditorStore((s) => s.removeTextLayer)
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer)
  const selectedTextId = useEditorStore((s) => s.selectedTextId)
  const selectText = useEditorStore((s) => s.selectText)
  const trimStart = useEditorStore((s) => s.trimStart)
  const trimEnd = useEditorStore((s) => s.trimEnd)
  const cuts = useEditorStore((s) => s.cuts)
  const isTranscribing = useEditorStore((s) => s.isTranscribing)
  const setTranscribing = useEditorStore((s) => s.setTranscribing)
  const transcribeStatus = useEditorStore((s) => s.transcribeStatus)
  const setTranscribeStatus = useEditorStore((s) => s.setTranscribeStatus)
  const transcribeError = useEditorStore((s) => s.transcribeError)
  const setTranscribeError = useEditorStore((s) => s.setTranscribeError)

  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]['value']>('portuguese')

  const effectiveDuration = Math.max(0.1, totalDuration(computeKeepSegments(trimStart, trimEnd, cuts)))
  const selected = textLayers.find((l) => l.id === selectedTextId)

  async function handleGenerateCaptions() {
    if (!videoFile) return
    setTranscribing(true)
    setTranscribeError(null)
    setTranscribeStatus('Extraindo áudio do vídeo…')
    try {
      const samples = await extractEffectiveAudioSamples(videoFile, trimStart, trimEnd, cuts)
      // Loaded on demand: the speech-recognition library (and its ~24MB WASM runtime)
      // should only be fetched when someone actually uses this feature.
      const { transcribeSamples } = await import('../lib/transcribe')
      const segments = await transcribeSamples(samples, {
        language,
        onProgress: (p) => {
          if (p.status === 'progress' && typeof p.progress === 'number') {
            setTranscribeStatus(`Baixando modelo de transcrição… ${Math.round(p.progress)}%`)
          } else if (p.status === 'ready' || p.status === 'done') {
            setTranscribeStatus('Transcrevendo áudio…')
          }
        },
      })
      if (segments.length === 0) {
        setTranscribeError('Não foi possível identificar fala nesse áudio.')
      } else {
        const layers: TextLayer[] = segments.map((seg) => ({
          id: nextId('text'),
          text: seg.text,
          x: 50,
          y: 82,
          fontSize: 56,
          color: '#ffffff',
          backgroundColor: '#000000',
          bold: true,
          align: 'center',
          start: seg.start,
          end: Math.min(seg.end, effectiveDuration),
        }))
        addTextLayers(layers)
      }
    } catch (err) {
      console.error(err)
      setTranscribeError(err instanceof Error ? err.message : 'Falha ao gerar as legendas.')
    } finally {
      setTranscribing(false)
      setTranscribeStatus(null)
    }
  }

  return (
    <PanelSection title="Texto" description="Adicione legendas ou textos que aparecem em momentos específicos do vídeo.">
      <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 p-3">
        <p className="text-xs font-medium text-zinc-300">🪄 Legendas automáticas</p>
        <p className="text-xs text-zinc-500">
          Transcreve a fala do vídeo (roda no seu navegador) e cria uma legenda para cada trecho falado.
        </p>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as (typeof LANGUAGES)[number]['value'])}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleGenerateCaptions}
          disabled={isTranscribing}
          className="w-full rounded-lg border border-fuchsia-500 py-2 text-sm font-medium text-fuchsia-300 hover:bg-fuchsia-500/10 disabled:opacity-50"
        >
          {isTranscribing ? transcribeStatus || 'Gerando…' : 'Gerar legendas automáticas'}
        </button>
        {transcribeError && <p className="text-xs text-red-400">{transcribeError}</p>}
        {isTranscribing && (
          <p className="text-[11px] text-zinc-500">
            A primeira vez baixa um modelo de reconhecimento de fala (alguns MB) — as próximas são mais rápidas.
          </p>
        )}
      </div>

      <button
        onClick={addTextLayer}
        className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-600 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        + Adicionar texto manualmente
      </button>

      {textLayers.length > 0 && (
        <div className="flex flex-col gap-1">
          {textLayers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => selectText(layer.id)}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs ${
                selectedTextId === layer.id ? 'bg-fuchsia-600/30 ring-1 ring-fuchsia-500' : 'bg-zinc-800/70 hover:bg-zinc-800'
              }`}
            >
              <span className="truncate">{layer.text || 'Texto sem conteúdo'}</span>
              <span className="ml-2 shrink-0 font-mono text-zinc-500">
                {formatTime(layer.start)}–{formatTime(layer.end)}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 p-3">
          <textarea
            value={selected.text}
            onChange={(e) => updateTextLayer(selected.id, { text: e.target.value })}
            rows={2}
            className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-100 outline-none focus:border-fuchsia-500"
            placeholder="Digite o texto"
          />

          <SliderRow
            label="Tamanho"
            value={selected.fontSize}
            min={16}
            max={200}
            step={1}
            format={(v) => `${Math.round(v)}px`}
            onChange={(fontSize) => updateTextLayer(selected.id, { fontSize })}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400">Cor</span>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => updateTextLayer(selected.id, { color: c })}
                className={`h-6 w-6 rounded-full border-2 ${selected.color === c ? 'border-fuchsia-400' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Fundo</span>
            <button
              onClick={() => updateTextLayer(selected.id, { backgroundColor: 'transparent' })}
              className={`rounded-md border px-2 py-1 text-xs ${selected.backgroundColor === 'transparent' ? 'border-fuchsia-400 text-fuchsia-300' : 'border-zinc-700 text-zinc-400'}`}
            >
              Nenhum
            </button>
            <button
              onClick={() => updateTextLayer(selected.id, { backgroundColor: '#000000' })}
              className={`rounded-md border px-2 py-1 text-xs ${selected.backgroundColor === '#000000' ? 'border-fuchsia-400 text-fuchsia-300' : 'border-zinc-700 text-zinc-400'}`}
            >
              Caixa preta
            </button>
            <button
              onClick={() => updateTextLayer(selected.id, { backgroundColor: '#ffffff' })}
              className={`rounded-md border px-2 py-1 text-xs ${selected.backgroundColor === '#ffffff' ? 'border-fuchsia-400 text-fuchsia-300' : 'border-zinc-700 text-zinc-400'}`}
            >
              Caixa branca
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={selected.bold}
                onChange={(e) => updateTextLayer(selected.id, { bold: e.target.checked })}
              />
              Negrito
            </label>
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  onClick={() => updateTextLayer(selected.id, { align })}
                  className={`rounded-md border px-2 py-1 text-xs ${selected.align === align ? 'border-fuchsia-400 text-fuchsia-300' : 'border-zinc-700 text-zinc-400'}`}
                >
                  {align === 'left' ? '⇤' : align === 'center' ? '↔' : '⇥'}
                </button>
              ))}
            </div>
          </div>

          <SliderRow
            label="Início (s)"
            value={selected.start}
            min={0}
            max={Math.max(0, selected.end - 0.1)}
            step={0.1}
            onChange={(start) => updateTextLayer(selected.id, { start })}
          />
          <SliderRow
            label="Fim (s)"
            value={selected.end}
            min={selected.start + 0.1}
            max={effectiveDuration}
            step={0.1}
            onChange={(end) => updateTextLayer(selected.id, { end })}
          />

          <button
            onClick={() => removeTextLayer(selected.id)}
            className="mt-1 w-full rounded-lg border border-red-900 py-1.5 text-xs text-red-400 hover:bg-red-950/50"
          >
            Remover texto
          </button>
        </div>
      )}
    </PanelSection>
  )
}
