import type { ToolTab } from '../store/editorStore'
import { useEditorStore } from '../store/editorStore'

const TABS: { id: ToolTab; label: string; icon: string }[] = [
  { id: 'crop', label: 'Enquadrar', icon: '⬛' },
  { id: 'cuts', label: 'Cortes', icon: '✂️' },
  { id: 'text', label: 'Texto', icon: '🅣' },
  { id: 'audio', label: 'Áudio', icon: '🎵' },
  { id: 'filters', label: 'Filtros', icon: '✨' },
]

export function Toolbar() {
  const activeTab = useEditorStore((s) => s.activeTab)
  const setActiveTab = useEditorStore((s) => s.setActiveTab)

  return (
    <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-800 px-2 pb-2 pt-1 md:flex-col md:border-b-0 md:border-r md:px-2 md:py-2">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-2 text-[11px] transition-colors md:w-20 ${
            activeTab === tab.id ? 'bg-fuchsia-600/20 text-fuchsia-300' : 'text-zinc-400 hover:bg-zinc-800/70'
          }`}
        >
          <span className="text-lg">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  )
}
