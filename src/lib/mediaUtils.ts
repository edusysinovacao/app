export interface VideoMeta {
  url: string
  duration: number
  width: number
  height: number
}

export function loadVideoMetadata(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      resolve({ url, duration: video.duration, width: video.videoWidth, height: video.videoHeight })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler o arquivo de vídeo.'))
    }
    video.src = url
  })
}

export interface AudioMeta {
  url: string
  duration: number
}

export function loadAudioMetadata(file: File): Promise<AudioMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      resolve({ url, duration: audio.duration })
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler o arquivo de áudio.'))
    }
    audio.src = url
  })
}

export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const tenths = Math.floor((totalSeconds * 10) % 10)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
