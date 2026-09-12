import { create } from 'zustand'
import { computeKeepSegments, totalDuration } from '../lib/segments'
import type { AudioTrack, CropSettings, FilterSettings, SilenceCandidate, TextLayer, TimeRange } from '../types'

export type ToolTab = 'media' | 'crop' | 'cuts' | 'text' | 'audio' | 'filters'

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

  // Silence/breath cuts: `silenceCandidates` is the reviewable list from the last
  // detection run, `cuts` (derived from the enabled ones) is what preview/export use.
  silenceCandidates: SilenceCandidate[]
  cuts: TimeRange[]
  isDetectingSilences: boolean
  silenceError: string | null

  isTranscribing: boolean
  transcribeStatus: string | null
  transcribeError: string | null

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
  addTextLayers: (layers: TextLayer[]) => void
  updateTextLayer: (id: string, patch: Partial<TextLayer>) => void
  removeTextLayer: (id: string) => void
  selectText: (id: string | null) => void

  setAudio: (track: AudioTrack | null) => void
  setAudioVolume: (volume: number) => void
  setAudioOffset: (offset: number) => void
  setMuteOriginal: (mute: boolean) => void
  setOriginalVolume: (volume: number) => void

  setSilenceCandidates: (candidates: SilenceCandidate[]) => void
  toggleSilenceCandidate: (id: string) => void
  clearSilences: () => void
  setDetectingSilences: (v: boolean) => void
  setSilenceError: (v: string | null) => void

  setTranscribing: (v: boolean) => void
  setTranscribeStatus: (v: string | null) => void
  setTranscribeError: (v: string | null) => void

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

function cutsFromCandidates(candidates: SilenceCandidate[]): TimeRange[] {
  return candidates.filter((c) => c.enabled).map(({ start, end }) => ({ start, end }))
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

  silenceCandidates: [],
  cuts: [],
  isDetectingSilences: false,
  silenceError: null,

  isTranscribing: false,
  transcribeStatus: null,
  transcribeError: null,

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
      silenceCandidates: [],
      cuts: [],
      silenceError: null,
      transcribeError: null,
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
    const { trimStart, trimEnd, cuts, textLayers } = get()
    const duration = Math.max(0.1, totalDuration(computeKeepSegments(trimStart, trimEnd, cuts)))
    const layer: TextLayer = {
      id: nextId('text'),
      text: 'Seu texto aqui',
      x: 50,
      y: 50,
      fontSize: 72,
      color: '#ffffff',
      backgroundColor: 'transparent',
      bold: true,
      align: 'center',
      start: 0,
      end: Math.min(duration, duration),
    }
    set({ textLayers: [...textLayers, layer], selectedTextId: layer.id, activeTab: 'text' })
  },

  addTextLayers: (layers) => set((s) => ({ textLayers: [...s.textLayers, ...layers] })),

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

  setSilenceCandidates: (candidates) => set({ silenceCandidates: candidates, cuts: cutsFromCandidates(candidates) }),
  toggleSilenceCandidate: (id) =>
    set((s) => {
      const silenceCandidates = s.silenceCandidates.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
      return { silenceCandidates, cuts: cutsFromCandidates(silenceCandidates) }
    }),
  clearSilences: () => set({ silenceCandidates: [], cuts: [] }),
  setDetectingSilences: (v) => set({ isDetectingSilences: v }),
  setSilenceError: (v) => set({ silenceError: v }),

  setTranscribing: (v) => set({ isTranscribing: v }),
  setTranscribeStatus: (v) => set({ transcribeStatus: v }),
  setTranscribeError: (v) => set({ transcribeError: v }),

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
      silenceCandidates: [],
      cuts: [],
      isDetectingSilences: false,
      silenceError: null,
      isTranscribing: false,
      transcribeStatus: null,
      transcribeError: null,
      currentTime: 0,
      isPlaying: false,
      activeTab: 'media',
      isExporting: false,
      exportProgress: 0,
      exportError: null,
      exportedUrl: null,
    }),
}))
