import type { FilterSettings } from '../types'
import { useEditorStore } from '../store/editorStore'
import { PanelSection, SliderRow } from './PanelUi'

const PRESETS: { name: string; value: FilterSettings }[] = [
  { name: 'Original', value: { brightness: 0, contrast: 0, saturation: 0, grayscale: false, sepia: false } },
  { name: 'Vívido', value: { brightness: 0.03, contrast: 0.15, saturation: 0.35, grayscale: false, sepia: false } },
  { name: 'P&B', value: { brightness: 0, contrast: 0.1, saturation: 0, grayscale: true, sepia: false } },
  { name: 'Sépia', value: { brightness: 0, contrast: 0, saturation: -0.1, grayscale: false, sepia: true } },
  { name: 'Contraste+', value: { brightness: -0.03, contrast: 0.3, saturation: 0.1, grayscale: false, sepia: false } },
  { name: 'Suave', value: { brightness: 0.08, contrast: -0.1, saturation: -0.15, grayscale: false, sepia: false } },
]

export function FilterPanel() {
  const filter = useEditorStore((s) => s.filter)
  const setFilter = useEditorStore((s) => s.setFilter)
  const applyFilterPreset = useEditorStore((s) => s.applyFilterPreset)

  return (
    <PanelSection title="Filtros" description="Ajuste a cor do vídeo ou escolha um preset rápido.">
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => applyFilterPreset(preset.value)}
            className="rounded-lg border border-zinc-700 py-2 text-xs text-zinc-300 hover:border-fuchsia-500 hover:text-fuchsia-300"
          >
            {preset.name}
          </button>
        ))}
      </div>

      <SliderRow
        label="Brilho"
        value={filter.brightness}
        min={-0.5}
        max={0.5}
        step={0.01}
        onChange={(brightness) => setFilter({ brightness })}
      />
      <SliderRow
        label="Contraste"
        value={filter.contrast}
        min={-0.5}
        max={0.5}
        step={0.01}
        onChange={(contrast) => setFilter({ contrast })}
      />
      <SliderRow
        label="Saturação"
        value={filter.saturation}
        min={-1}
        max={1}
        step={0.01}
        onChange={(saturation) => setFilter({ saturation })}
      />

      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={filter.grayscale}
            onChange={(e) => setFilter({ grayscale: e.target.checked, sepia: e.target.checked ? false : filter.sepia })}
          />
          Preto e branco
        </label>
        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={filter.sepia}
            onChange={(e) => setFilter({ sepia: e.target.checked, grayscale: e.target.checked ? false : filter.grayscale })}
          />
          Sépia
        </label>
      </div>
    </PanelSection>
  )
}
