import { AudioPanel } from './components/AudioPanel'
import { CropPanel } from './components/CropPanel'
import { ExportBar } from './components/ExportBar'
import { FilterPanel } from './components/FilterPanel'
import { MediaUpload } from './components/MediaUpload'
import { PreviewStage } from './components/PreviewStage'
import { TextPanel } from './components/TextPanel'
import { Timeline } from './components/Timeline'
import { Toolbar } from './components/Toolbar'
import { useEditorStore } from './store/editorStore'

function App() {
  const videoUrl = useEditorStore((s) => s.videoUrl)
  const activeTab = useEditorStore((s) => s.activeTab)
  const reset = useEditorStore((s) => s.reset)

  return (
    <div className="flex h-screen flex-col bg-[#0b0b0f]">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎬</span>
          <h1 className="text-base font-semibold text-zinc-100">Reels Editor</h1>
        </div>
        {videoUrl && (
          <button onClick={reset} className="text-xs text-zinc-500 hover:text-zinc-300">
            Novo vídeo
          </button>
        )}
      </header>

      {!videoUrl ? (
        <div className="flex-1">
          <MediaUpload />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <Toolbar />

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="flex flex-1 items-center justify-center p-4">
              <PreviewStage />
            </div>
            <Timeline />
          </div>

          <div className="flex w-full shrink-0 flex-col border-t border-zinc-800 md:h-full md:w-80 md:border-l md:border-t-0">
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'crop' && <CropPanel />}
              {activeTab === 'text' && <TextPanel />}
              {activeTab === 'audio' && <AudioPanel />}
              {activeTab === 'filters' && <FilterPanel />}
            </div>
            <ExportBar />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
