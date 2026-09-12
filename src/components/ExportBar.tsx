import { exportReel } from '../lib/ffmpegExport'
import { useEditorStore } from '../store/editorStore'

export function ExportBar() {
  const videoFile = useEditorStore((s) => s.videoFile)
  const trimStart = useEditorStore((s) => s.trimStart)
  const trimEnd = useEditorStore((s) => s.trimEnd)
  const crop = useEditorStore((s) => s.crop)
  const filter = useEditorStore((s) => s.filter)
  const textLayers = useEditorStore((s) => s.textLayers)
  const audio = useEditorStore((s) => s.audio)
  const muteOriginal = useEditorStore((s) => s.muteOriginal)
  const originalVolume = useEditorStore((s) => s.originalVolume)
  const isExporting = useEditorStore((s) => s.isExporting)
  const exportProgress = useEditorStore((s) => s.exportProgress)
  const exportError = useEditorStore((s) => s.exportError)
  const exportedUrl = useEditorStore((s) => s.exportedUrl)
  const setExporting = useEditorStore((s) => s.setExporting)
  const setExportProgress = useEditorStore((s) => s.setExportProgress)
  const setExportError = useEditorStore((s) => s.setExportError)
  const setExportedUrl = useEditorStore((s) => s.setExportedUrl)
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying)

  async function handleExport() {
    if (!videoFile) return
    setIsPlaying(false)
    setExporting(true)
    setExportError(null)
    setExportProgress(0)
    if (exportedUrl) URL.revokeObjectURL(exportedUrl)
    setExportedUrl(null)
    try {
      const blob = await exportReel({
        videoFile,
        trimStart,
        trimEnd,
        crop,
        filter,
        textLayers,
        audio,
        muteOriginal,
        originalVolume,
        onProgress: setExportProgress,
      })
      setExportedUrl(URL.createObjectURL(blob))
    } catch (err) {
      console.error(err)
      setExportError('Falha ao exportar o vídeo. Tente novamente.')
    } finally {
      setExporting(false)
    }
  }

  if (!videoFile) return null

  return (
    <div className="flex w-full flex-col gap-2 border-t border-zinc-800 p-3">
      {exportError && <p className="text-xs text-red-400">{exportError}</p>}

      {isExporting ? (
        <div className="flex flex-col gap-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 transition-all"
              style={{ width: `${Math.round(exportProgress * 100)}%` }}
            />
          </div>
          <p className="text-center text-xs text-zinc-400">Exportando… {Math.round(exportProgress * 100)}%</p>
        </div>
      ) : (
        <button
          onClick={handleExport}
          className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-900/30 hover:opacity-90"
        >
          Exportar Reel (1080×1920)
        </button>
      )}

      {exportedUrl && !isExporting && (
        <a
          href={exportedUrl}
          download="reel.mp4"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600/10 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-600/20"
        >
          ⬇ Baixar vídeo pronto
        </a>
      )}
    </div>
  )
}
