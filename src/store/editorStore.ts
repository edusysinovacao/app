import { create } from 'zustand'
import type { AudioTrack, CropSettings, FilterSettings, TextLayer } from '../types'

export type ToolTab = 'media' | 'crop' | 'text' | 'audio' | 'filters'

interface EditorState {
  videoFile: File | null
  videoUrl: string | null
  videoDuration: number

  trimStart: number
  trimEnd: number

  crop: CropSettings
  filter: FilterSettings

  textLayers: TextLayer[]
  selectedTextId: string | null

  audio: AudioTrack | null
  muteOriginal: boolean
  originalVolume: number

  currentTime: number
  isPlaying: boolean

  activeTab: ToolTab

  isExporting: boolean
  exportProgress: number
  exportError: string | null
  exportedUrl: string | null

  setVideo: (file: File, url: string, duration: number) => void
  setTrim: (start: number, end: number) => void
  setCrop: (crop: Partial<CropSettings>) => void
  resetCrop: () => void
  setFilter: (filter: Partial<FilterSettings>) => void
  applyFilterPreset: (preset: FilterSettings) => void

  addTextLayer: () => void
  updateTextLayer: (id: string, patch: Partial<TextLayer>) => void
  removeTextLayer: (id: string) => void
  selectText: (id: string | null) => void

  setAudio: (track: AudioTrack | null) => void
  setAudioVolume: (volume: number) => void
  setAudioOffset: (offset: number) => void
  setMuteOriginal: (mute: boolean) => void
  setOriginalVolume: (volume: number) => void

  setCurrentTime: (t: number) => void
  setIsPlaying: (p: boolean) => void
  setActiveTab: (tab: ToolTab) => void

  setExporting: (v: boolean) => void
  setExportProgress: (v: number) => void
  setExportError: (v: string | null) => void
  setExportedUrl: (v: string | null) => void

  reset: () => void
}

const defaultCrop: CropSettings = { zoom: 1, panX: 0, panY: 0 }
const defaultFilter: FilterSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  grayscale: false,
  sepia: false,
}

let idCounter = 0
export function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}

export const useEditorStore = create<EditorState>((set, get) => ({
  videoFile: null,
  videoUrl: null,
  videoDuration: 0,

  trimStart: 0,
  trimEnd: 0,

  crop: defaultCrop,
  filter: defaultFilter,

  textLayers: [],
  selectedTextId: null,

  audio: null,
  muteOriginal: false,
  originalVolume: 1,

  currentTime: 0,
  isPlaying: false,

  activeTab: 'media',

  isExporting: false,
  exportProgress: 0,
  exportError: null,
  exportedUrl: null,

  setVideo: (file, url, duration) =>
    set({
      videoFile: file,
      videoUrl: url,
      videoDuration: duration,
      trimStart: 0,
      trimEnd: duration,
      currentTime: 0,
      crop: defaultCrop,
      filter: defaultFilter,
      textLayers: [],
      selectedTextId: null,
      exportedUrl: null,
      exportError: null,
      activeTab: 'crop',
    }),

  setTrim: (start, end) =>
    set((s) => ({
      trimStart: Math.max(0, Math.min(start, s.videoDuration)),
      trimEnd: Math.max(0, Math.min(end, s.videoDuration)),
    })),

  setCrop: (crop) => set((s) => ({ crop: { ...s.crop, ...crop } })),
  resetCrop: () => set({ crop: defaultCrop }),

  setFilter: (filter) => set((s) => ({ filter: { ...s.filter, ...filter } })),
  applyFilterPreset: (preset) => set({ filter: preset }),

  addTextLayer: () => {
    const { trimStart, trimEnd, textLayers } = get()
    const duration = Math.max(0.1, trimEnd - trimStart)
    const layer: TextLayer = {
      id: nextId('text'),
      text: 'Seu texto aqui',
      x: 50,
      y: 50,
      fontSize: 48,
      color: '#ffffff',
      backgroundColor: 'transparent',
      bold: true,
      align: 'center',
      start: 0,
      end: Math.min(duration, duration),
    }
    set({ textLayers: [...textLayers, layer], selectedTextId: layer.id, activeTab: 'text' })
  },

  updateTextLayer: (id, patch) =>
    set((s) => ({
      textLayers: s.textLayers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    })),

  removeTextLayer: (id) =>
    set((s) => ({
      textLayers: s.textLayers.filter((l) => l.id !== id),
      selectedTextId: s.selectedTextId === id ? null : s.selectedTextId,
    })),

  selectText: (id) => set({ selectedTextId: id }),

  setAudio: (track) => set({ audio: track }),
  setAudioVolume: (volume) =>
    set((s) => (s.audio ? { audio: { ...s.audio, volume } } : {})),
  setAudioOffset: (offset) =>
    set((s) => (s.audio ? { audio: { ...s.audio, offset } } : {})),
  setMuteOriginal: (mute) => set({ muteOriginal: mute }),
  setOriginalVolume: (volume) => set({ originalVolume: volume }),

  setCurrentTime: (t) => set({ currentTime: t }),
  setIsPlaying: (p) => set({ isPlaying: p }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  setExporting: (v) => set({ isExporting: v }),
  setExportProgress: (v) => set({ exportProgress: v }),
  setExportError: (v) => set({ exportError: v }),
  setExportedUrl: (v) => set({ exportedUrl: v }),

  reset: () =>
    set({
      videoFile: null,
      videoUrl: null,
      videoDuration: 0,
      trimStart: 0,
      trimEnd: 0,
      crop: defaultCrop,
      filter: defaultFilter,
      textLayers: [],
      selectedTextId: null,
      audio: null,
      muteOriginal: false,
      originalVolume: 1,
      currentTime: 0,
      isPlaying: false,
      activeTab: 'media',
      isExporting: false,
      exportProgress: 0,
      exportError: null,
      exportedUrl: null,
    }),
}))
