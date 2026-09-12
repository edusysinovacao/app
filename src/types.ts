export interface TextLayer {
  id: string
  text: string
  /** Horizontal position as a percentage (0-100) of the frame width, anchored at center. */
  x: number
  /** Vertical position as a percentage (0-100) of the frame height, anchored at center. */
  y: number
  fontSize: number
  color: string
  backgroundColor: string
  bold: boolean
  align: 'left' | 'center' | 'right'
  /** Seconds from the start of the final (trimmed + cuts applied) timeline when the text appears. */
  start: number
  /** Seconds from the start of the final (trimmed + cuts applied) timeline when the text disappears. */
  end: number
}

/** A time span in the ORIGINAL video's own timeline (seconds), start inclusive, end exclusive. */
export interface TimeRange {
  start: number
  end: number
}

/** A detected silence/breath, kept around so the user can review and toggle it before it's cut. */
export interface SilenceCandidate extends TimeRange {
  id: string
  enabled: boolean
}

export interface FilterSettings {
  brightness: number // -1 .. 1 (0 = neutral)
  contrast: number // -1 .. 1 (0 = neutral)
  saturation: number // -1 .. 1 (0 = neutral)
  grayscale: boolean
  sepia: boolean
}

export interface CropSettings {
  /** Zoom factor applied to the source video inside the 9:16 frame (1 = fit, >1 = zoomed in). */
  zoom: number
  /** Horizontal pan as a percentage (-100..100) of the extra zoomed area. */
  panX: number
  /** Vertical pan as a percentage (-100..100) of the extra zoomed area. */
  panY: number
}

export interface AudioTrack {
  file: File
  url: string
  duration: number
  volume: number // 0..1.5
  /** Offset into the audio file (seconds) where playback should start. */
  offset: number
}

export const REEL_WIDTH = 1080
export const REEL_HEIGHT = 1920
export const REEL_ASPECT = REEL_WIDTH / REEL_HEIGHT
