import { useState } from 'react'
import { detectSilences } from '../lib/silenceDetect'
import { formatTime } from '../lib/mediaUtils'
import { nextId, useEditorStore } from '../store/editorStore'
import { PanelSection, SliderRow } from './PanelUi'

export function CutsPanel() {
  const videoFile = useEditorStore((s) => s.videoFile)
  const silenceCandidates = useEditorStore((s) => s.silenceCandidates)
  const setSilenceCandidates = useEditorStore((s) => s.setSilenceCandidates)
  const toggleSilenceCandidate = useEditorStore((s) => s.toggleSilenceCandidate)
  const clearSilences = useEditorStore((s) => s.clearSilences)
  const isDetecting = useEditorStore((s) => s.isDetectingSilences)
  const setDetecting = useEditorStore((s) => s.setDetectingSilences)
  const error = useEditorStore((s) => s.silenceError)
  const setError = useEditorStore((s) => s.setSilenceError)

  const [sensitivity, setSensitivity] = useState(-35) // dB noise floor; lower = more sensitive
  const [minDuration, setMinDuration] = useState(0.4) // seconds

  async function handleDetect() {
    if (!videoFile) return
    setDetecting(true)
    setError(null)
    try {
      const ranges = await detectSilences(videoFile, { noiseDb: sensitivity, minDurationSec: minDuration })
      setSilenceCandidates(
        ranges.map((r) => ({ ...r, id: nextId('silence'), enabled: true })),
      )
      if (ranges.length === 0) {
        setError('Nenhum silêncio ou respiração encontrado com essa sensibilidade.')
      }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Falha ao analisar o áudio.')
    } finally {
      setDetecting(false)
    }
  }

  const enabledCount = silenceCandidates.filter((c) => c.enabled).length
  const totalCutSeconds = silenceCandidates.filter((c) => c.enabled).reduce((sum, c) => sum + (c.end - c.start), 0)
  const autoRemoveOn = silenceCandidates.length > 0

  async function handleToggleAuto(on: boolean) {
    if (on) {
      await handleDetect()
    } else {
      clearSilences()
      setError(null)
    }
  }

  return (
    <PanelSection
      title="Cortar silêncios e respirações"
      description="Detecta automaticamente pausas e respirações no áudio para remover do vídeo final. Revise a lista antes de exportar — você pode desmarcar qualquer trecho."
    >
      <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 p-3">
        <div>
          <p className="text-sm font-medium text-zinc-200">Remover respirações automaticamente</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {isDetecting ? 'Analisando áudio…' : 'Um clique detecta e já ajusta o vídeo, cortando as pausas encontradas.'}
          </p>
        </div>
        <label className="relative inline-flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={autoRemoveOn}
            disabled={isDetecting}
            onChange={(e) => handleToggleAuto(e.target.checked)}
          />
          <div className="h-5 w-9 rounded-full bg-zinc-700 peer-checked:bg-fuchsia-600" />
          <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
        </label>
      </div>

      <p className="text-xs font-medium text-zinc-400">Ajuste fino (opcional)</p>
      <SliderRow
        label="Sensibilidade"
        value={sensitivity}
        min={-60}
        max={-15}
        step={1}
        format={(v) => `${v} dB`}
        onChange={setSensitivity}
      />
      <SliderRow
        label="Duração mínima da pausa"
        value={minDuration}
        min={0.15}
        max={2}
        step={0.05}
        format={(v) => `${v.toFixed(2)}s`}
        onChange={setMinDuration}
      />

      <button
        onClick={handleDetect}
        disabled={isDetecting}
        className="w-full rounded-lg border border-fuchsia-500 py-2 text-sm font-medium text-fuchsia-300 hover:bg-fuchsia-500/10 disabled:opacity-50"
      >
        {isDetecting ? 'Analisando áudio…' : autoRemoveOn ? '🔄 Detectar novamente com esses ajustes' : '✂️ Detectar silêncios e respirações'}
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {silenceCandidates.length > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>
              {enabledCount} de {silenceCandidates.length} trecho{silenceCandidates.length > 1 ? 's' : ''} selecionado
              {enabledCount !== 1 ? 's' : ''} · {formatTime(totalCutSeconds)} a remover
            </span>
            <button onClick={clearSilences} className="text-red-400 hover:underline">
              Limpar
            </button>
          </div>

          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {silenceCandidates.map((c, i) => (
              <label
                key={c.id}
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs ${
                  c.enabled ? 'bg-red-950/40' : 'bg-zinc-800/50 opacity-60'
                }`}
              >
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={c.enabled} onChange={() => toggleSilenceCandidate(c.id)} />
                  Trecho {i + 1}: {formatTime(c.start)} – {formatTime(c.end)}
                </span>
                <span className="font-mono text-zinc-500">{(c.end - c.start).toFixed(2)}s</span>
              </label>
            ))}
          </div>
        </>
      )}
    </PanelSection>
  )
}
