import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { computeKeepSegments, totalDuration } from './segments'
import { REEL_HEIGHT, REEL_WIDTH } from '../types'
import type { AudioTrack, FilterSettings, TextLayer, TimeRange } from '../types'

// Self-hosted (copied from node_modules by scripts/copy-ffmpeg-core.mjs at install time)
// so the editor doesn't depend on a third-party CDN being reachable at runtime.
// Resolved against BASE_URL so this also works when the app is served from a
// sub-path (e.g. a GitHub Pages project site at /<repo>/).
const CORE_BASE_URL = `${import.meta.env.BASE_URL}ffmpeg-core`
const FONT_URL = `${import.meta.env.BASE_URL}fonts/Inter-Variable.ttf`
const FONT_FILE = 'font.ttf'

let ffmpegSingleton: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

/** Loads (once) and returns the shared FFmpeg instance. */
export async function getFFmpeg(onLog?: (message: string) => void): Promise<FFmpeg> {
  if (ffmpegSingleton) {
    // The instance may have been created by an earlier call without a logger
    // (e.g. silence detection) — still honor this caller's onLog.
    if (onLog) ffmpegSingleton.on('log', ({ message }) => onLog(message))
    return ffmpegSingleton
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg()
      if (onLog) {
        ffmpeg.on('log', ({ message }) => onLog(message))
      }
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
        toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
      ])
      await ffmpeg.load({ coreURL, wasmURL })
      ffmpegSingleton = ffmpeg
      return ffmpeg
    })()
  }
  return loadPromise
}

/** Escapes a value used inside an ffmpeg filtergraph numeric expression (commas separate filters). */
function esc(expr: string): string {
  return expr.replace(/,/g, '\\,')
}

function extensionOf(file: File): string {
  const dot = file.name.lastIndexOf('.')
  return dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : 'bin'
}

/** Detects whether the given file (already written to the FFmpeg FS) has an audio stream. */
export async function probeHasAudio(ffmpeg: FFmpeg, filename: string): Promise<boolean> {
  let sawAudioStream = false
  const handler = ({ message }: { message: string }) => {
    if (/Stream #0.*Audio:/i.test(message)) sawAudioStream = true
  }
  ffmpeg.on('log', handler)
  try {
    await ffmpeg.exec(['-i', filename])
  } catch {
    // ffmpeg exits non-zero when called without an output file; that's expected here,
    // we only care about the stream info it printed to the log.
  } finally {
    ffmpeg.off('log', handler)
  }
  return sawAudioStream
}

/**
 * Builds the filter_complex fragment that trims `inputLabel` down to the given kept
 * segments and stitches them back to back (skipping the cuts in between). With a
 * single segment (the common case: no cuts) this degrades to a plain trim, no concat.
 */
function buildTrimConcat(
  prefix: string,
  inputLabel: string,
  segments: TimeRange[],
  kind: 'v' | 'a',
): { filters: string[]; outLabel: string } {
  const trimFn = kind === 'v' ? 'trim' : 'atrim'
  const resetPts = kind === 'v' ? 'setpts=PTS-STARTPTS' : 'asetpts=PTS-STARTPTS'

  if (segments.length === 1) {
    const s = segments[0]
    return {
      filters: [`${inputLabel}${trimFn}=start=${s.start}:end=${s.end},${resetPts}[${prefix}]`],
      outLabel: prefix,
    }
  }

  const filters: string[] = []
  const partLabels: string[] = []
  segments.forEach((s, i) => {
    const label = `${prefix}${i}`
    filters.push(`${inputLabel}${trimFn}=start=${s.start}:end=${s.end},${resetPts}[${label}]`)
    partLabels.push(`[${label}]`)
  })
  filters.push(`${partLabels.join('')}concat=n=${segments.length}:v=${kind === 'v' ? 1 : 0}:a=${kind === 'v' ? 0 : 1}[${prefix}]`)
  return { filters, outLabel: prefix }
}

export interface ExportParams {
  videoFile: File
  trimStart: number
  trimEnd: number
  /** Silence/breath (or other) cuts to remove from inside the trim range, in original-video time. */
  cuts: TimeRange[]
  crop: { zoom: number; panX: number; panY: number }
  filter: FilterSettings
  textLayers: TextLayer[]
  audio: AudioTrack | null
  muteOriginal: boolean
  originalVolume: number
  onProgress?: (ratio: number) => void
  onLog?: (message: string) => void
}

export async function exportReel(params: ExportParams): Promise<Blob> {
  const {
    videoFile,
    trimStart,
    trimEnd,
    cuts,
    crop,
    filter,
    textLayers,
    audio,
    muteOriginal,
    originalVolume,
    onProgress,
    onLog,
  } = params

  const keepSegments = computeKeepSegments(trimStart, trimEnd, cuts)
  const duration = Math.max(0.1, totalDuration(keepSegments))
  const ffmpeg = await getFFmpeg(onLog)

  const progressHandler = onProgress
    ? ({ progress }: { progress: number }) => {
        if (Number.isFinite(progress)) onProgress(Math.min(1, Math.max(0, progress)))
      }
    : null
  if (progressHandler) ffmpeg.on('progress', progressHandler)

  try {
    const inputName = `input.${extensionOf(videoFile)}`
    await ffmpeg.writeFile(inputName, await fetchFile(videoFile))
    await ffmpeg.writeFile(FONT_FILE, await fetchFile(FONT_URL))

    let audioName: string | null = null
    if (audio) {
      audioName = `bgaudio.${extensionOf(audio.file)}`
      await ffmpeg.writeFile(audioName, await fetchFile(audio.file))
    }

    const activeTexts = textLayers.filter((t) => t.end > t.start)
    const textFiles: string[] = []
    for (let i = 0; i < activeTexts.length; i++) {
      const fname = `text${i}.txt`
      await ffmpeg.writeFile(fname, new TextEncoder().encode(activeTexts[i].text))
      textFiles.push(fname)
    }

    const hasOriginalAudio = !muteOriginal && (await probeHasAudio(ffmpeg, inputName))

    // --- Trim + stitch the kept segments back to back ------------------------------------
    const videoConcat = buildTrimConcat('vcat', '[0:v]', keepSegments, 'v')
    const filterParts: string[] = [...videoConcat.filters]

    // --- Crop/zoom, color filters and captions, applied once to the stitched video -------
    const zoom = Math.max(1, crop.zoom || 1)
    const panX = crop.panX || 0
    const panY = crop.panY || 0

    const scaleExpr =
      `scale=w='${esc(`trunc(iw*max(${REEL_WIDTH}/iw,${REEL_HEIGHT}/ih)*${zoom}/2)*2`)}'` +
      `:h='${esc(`trunc(ih*max(${REEL_WIDTH}/iw,${REEL_HEIGHT}/ih)*${zoom}/2)*2`)}'`

    const cropExpr =
      `crop=w=${REEL_WIDTH}:h=${REEL_HEIGHT}` +
      `:x='${esc(`min(max((in_w-${REEL_WIDTH})/2*(1+(${panX})/100),0),in_w-${REEL_WIDTH})`)}'` +
      `:y='${esc(`min(max((in_h-${REEL_HEIGHT})/2*(1+(${panY})/100),0),in_h-${REEL_HEIGHT})`)}'`

    const saturation = filter.grayscale ? 0 : Math.min(3, Math.max(0, 1 + filter.saturation))
    const contrast = Math.min(2, Math.max(0, 1 + filter.contrast))
    const brightness = Math.min(1, Math.max(-1, filter.brightness))
    const eqExpr = `eq=brightness=${brightness.toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}`

    const sepiaExpr = filter.sepia
      ? ',colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:0'
      : ''

    const drawtextParts = activeTexts.map((layer, i) => {
      const start = Math.max(0, layer.start)
      const end = Math.min(duration, layer.end)
      const fontsize = Math.max(1, Math.round(layer.fontSize))
      const xExpr = esc(`main_w*(${layer.x}/100)-text_w/2`)
      const yExpr = esc(`main_h*(${layer.y}/100)-text_h/2`)
      const boxOpt =
        layer.backgroundColor && layer.backgroundColor !== 'transparent'
          ? `:box=1:boxcolor=${layer.backgroundColor}@0.55:boxborderw=18`
          : ''
      return (
        `drawtext=fontfile=${FONT_FILE}:textfile=${textFiles[i]}` +
        `:fontsize=${fontsize}:fontcolor=${layer.color}` +
        `${boxOpt}:x='${xExpr}':y='${yExpr}'` +
        `:enable='${esc(`between(t,${start},${end})`)}'`
      )
    })

    filterParts.push(
      `[${videoConcat.outLabel}]` +
        [scaleExpr, cropExpr, eqExpr + sepiaExpr, ...drawtextParts].join(',') +
        '[vout]',
    )

    let audioLabel: string | null = null

    if (hasOriginalAudio && audio) {
      const origConcat = buildTrimConcat('origaud_raw', '[0:a]', keepSegments, 'a')
      filterParts.push(...origConcat.filters)
      filterParts.push(`[${origConcat.outLabel}]volume=${originalVolume.toFixed(2)}[origaud]`)
      filterParts.push(
        `[1:a]atrim=start=${audio.offset}:end=${audio.offset + duration},asetpts=PTS-STARTPTS,volume=${audio.volume.toFixed(2)}[bgaud]`,
      )
      filterParts.push('[origaud][bgaud]amix=inputs=2:duration=first:normalize=0[aout]')
      audioLabel = '[aout]'
    } else if (hasOriginalAudio) {
      const origConcat = buildTrimConcat('origaud_raw', '[0:a]', keepSegments, 'a')
      filterParts.push(...origConcat.filters)
      filterParts.push(`[${origConcat.outLabel}]volume=${originalVolume.toFixed(2)}[aout]`)
      audioLabel = '[aout]'
    } else if (audio) {
      filterParts.push(
        `[1:a]atrim=start=${audio.offset}:end=${audio.offset + duration},asetpts=PTS-STARTPTS,volume=${audio.volume.toFixed(2)}[aout]`,
      )
      audioLabel = '[aout]'
    }

    const args = ['-i', inputName]
    if (audioName) args.push('-i', audioName)
    args.push('-filter_complex', filterParts.join(';'))
    args.push('-map', '[vout]')
    if (audioLabel) {
      args.push('-map', audioLabel)
    } else {
      args.push('-an')
    }
    args.push(
      '-t',
      duration.toFixed(3),
      // Concatenating trimmed segments can leave slightly irregular frame timing at the
      // splice points; normalize to a constant frame rate and zero-based timestamps so
      // strict demuxers (like Chrome's) don't reject the result.
      '-vsync',
      'cfr',
      '-avoid_negative_ts',
      'make_zero',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'veryfast',
      '-crf',
      '22',
    )
    if (audioLabel) {
      args.push('-c:a', 'aac', '-b:a', '192k')
    }
    args.push('-movflags', '+faststart', 'output.mp4')

    await ffmpeg.exec(args)

    const data = await ffmpeg.readFile('output.mp4')
    const bytes = data as Uint8Array
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'video/mp4' })

    // Best-effort cleanup of the virtual filesystem.
    const cleanupNames = [inputName, FONT_FILE, 'output.mp4', ...textFiles]
    if (audioName) cleanupNames.push(audioName)
    for (const name of cleanupNames) {
      try {
        await ffmpeg.deleteFile(name)
      } catch {
        // ignore
      }
    }

    return blob
  } finally {
    if (progressHandler) ffmpeg.off('progress', progressHandler)
  }
}

/**
 * Extracts the final (trimmed + cuts applied) audio as 16kHz mono PCM samples,
 * ready to feed into a speech-to-text model. Used to auto-generate captions that
 * line up exactly with what the export will actually contain.
 */
export async function extractEffectiveAudioSamples(
  videoFile: File,
  trimStart: number,
  trimEnd: number,
  cuts: TimeRange[],
): Promise<Float32Array> {
  const keepSegments = computeKeepSegments(trimStart, trimEnd, cuts)
  const ffmpeg = await getFFmpeg()
  const inputName = `asr-input.${extensionOf(videoFile)}`
  await ffmpeg.writeFile(inputName, await fetchFile(videoFile))

  try {
    const hasAudio = await probeHasAudio(ffmpeg, inputName)
    if (!hasAudio) throw new Error('Este vídeo não tem áudio para transcrever.')

    const concat = buildTrimConcat('asrcat', '[0:a]', keepSegments, 'a')
    const filterComplex = [...concat.filters].join(';')
    await ffmpeg.exec([
      '-i',
      inputName,
      '-vn',
      '-filter_complex',
      filterComplex,
      '-map',
      `[${concat.outLabel}]`,
      '-ar',
      '16000',
      '-ac',
      '1',
      '-f',
      'wav',
      'asr-audio.wav',
    ])

    const data = await ffmpeg.readFile('asr-audio.wav')
    const bytes = data as Uint8Array
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const audioCtx = new AudioContextCtor()
    try {
      const decoded = await audioCtx.decodeAudioData(arrayBuffer)
      return decoded.getChannelData(0).slice()
    } finally {
      await audioCtx.close()
    }
  } finally {
    try {
      await ffmpeg.deleteFile(inputName)
    } catch {
      // ignore
    }
    try {
      await ffmpeg.deleteFile('asr-audio.wav')
    } catch {
      // ignore
    }
  }
}
