import { useEditorStore } from '../store/editorStore'
import { PanelSection, SliderRow } from './PanelUi'

export function CropPanel() {
  const crop = useEditorStore((s) => s.crop)
  const setCrop = useEditorStore((s) => s.setCrop)
  const resetCrop = useEditorStore((s) => s.resetCrop)

  return (
    <PanelSection
      title="Enquadramento 9:16"
      description="Ajuste o zoom e arraste o vídeo na prévia para posicionar o que aparece no quadro do Reels."
    >
      <SliderRow
        label="Zoom"
        value={crop.zoom}
        min={1}
        max={3}
        step={0.01}
        format={(v) => `${v.toFixed(2)}x`}
        onChange={(zoom) => setCrop({ zoom })}
      />
      <button
        onClick={resetCrop}
        className="mt-2 w-full rounded-lg border border-zinc-700 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
      >
        Centralizar
      </button>
    </PanelSection>
  )
}
