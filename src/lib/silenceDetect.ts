import { fetchFile } from '@ffmpeg/util'
import { getFFmpeg, probeHasAudio } from './ffmpegExport'
import type { TimeRange } from '../types'

export interface DetectSilenceOptions {
  /** Noise floor (dB, negative) below which audio counts as silence/breath. Lower = more sensitive. */
  noiseDb?: number
  /** Minimum duration (seconds) for a quiet stretch to count as a cut candidate. */
  minDurationSec?: number
}

function extensionOf(file: File): string {
  const dot = file.name.lastIndexOf('.')
  return dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : 'bin'
}

/**
 * Runs ffmpeg's `silencedetect` filter over the video's audio track and returns
 * every quiet stretch found (silence and, with a lenient noise floor, breaths).
 * The caller decides which of these to actually cut.
 */
export async function detectSilences(videoFile: File, opts: DetectSilenceOptions = {}): Promise<TimeRange[]> {
  const { noiseDb = -35, minDurationSec = 0.4 } = opts
  const ffmpeg = await getFFmpeg()
  const inputName = `silence-input.${extensionOf(videoFile)}`
  await ffmpeg.writeFile(inputName, await fetchFile(videoFile))

  try {
    const hasAudio = await probeHasAudio(ffmpeg, inputName)
    if (!hasAudio) throw new Error('Este vídeo não tem áudio para analisar.')

    const ranges: TimeRange[] = []
    let pendingStart: number | null = null
    const handler = ({ message }: { message: string }) => {
      const startMatch = message.match(/silence_start:\s*(-?[\d.]+)/)
      if (startMatch) pendingStart = parseFloat(startMatch[1])
      const endMatch = message.match(/silence_end:\s*(-?[\d.]+)/)
      if (endMatch && pendingStart !== null) {
        ranges.push({ start: Math.max(0, pendingStart), end: parseFloat(endMatch[1]) })
        pendingStart = null
      }
    }

    ffmpeg.on('log', handler)
    try {
      await ffmpeg.exec([
        '-i',
        inputName,
        '-vn',
        '-af',
        `silencedetect=noise=${noiseDb}dB:d=${minDurationSec}`,
        '-f',
        'null',
        '-',
      ])
    } finally {
      ffmpeg.off('log', handler)
    }

    return ranges
  } finally {
    try {
      await ffmpeg.deleteFile(inputName)
    } catch {
      // ignore
    }
  }
}
