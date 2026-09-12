import { useRef, useState } from 'react'
import { loadVideoMetadata } from '../lib/mediaUtils'
import { useEditorStore } from '../store/editorStore'

export function MediaUpload() {
  const setVideo = useEditorStore((s) => s.setVideo)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined | null) {
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setError('Selecione um arquivo de vídeo válido (mp4, mov, webm...).')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const meta = await loadVideoMetadata(file)
      setVideo(file, meta.url, meta.duration)
    } catch {
      setError('Não foi possível carregar esse vídeo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFile(e.dataTransfer.files?.[0])
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex w-full max-w-md cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          isDragging ? 'border-fuchsia-400 bg-fuchsia-500/10' : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-500'
        }`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 text-3xl">
          🎬
        </div>
        <div>
          <p className="text-lg font-semibold text-zinc-100">Envie o seu vídeo</p>
          <p className="mt-1 text-sm text-zinc-400">
            Arraste um arquivo aqui ou clique para escolher. Ele será cortado no formato 9:16 do
            Reels.
          </p>
        </div>
        {loading && <p className="text-sm text-fuchsia-400">Carregando vídeo…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  )
}
