import { useEditorStore } from '../store/editorStore'
import { PanelSection, SliderRow } from './PanelUi'
import { formatTime } from '../lib/mediaUtils'

const COLORS = ['#ffffff', '#000000', '#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa']

export function TextPanel() {
  const textLayers = useEditorStore((s) => s.textLayers)
  const addTextLayer = useEditorStore((s) => s.addTextLayer)
  const removeTextLayer = useEditorStore((s) => s.removeTextLayer)
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer)
  const selectedTextId = useEditorStore((s) => s.selectedTextId)
  const selectText = useEditorStore((s) => s.selectText)
  const trimStart = useEditorStore((s) => s.trimStart)
  const trimEnd = useEditorStore((s) => s.trimEnd)

  const trimDuration = Math.max(0.1, trimEnd - trimStart)
  const selected = textLayers.find((l) => l.id === selectedTextId)

  return (
    <PanelSection title="Texto" description="Adicione legendas ou textos que aparecem em momentos específicos do vídeo.">
      <button
        onClick={addTextLayer}
        className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-600 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        + Adicionar texto
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
            max={trimDuration}
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
