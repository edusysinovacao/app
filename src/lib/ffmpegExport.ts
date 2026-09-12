import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { REEL_HEIGHT, REEL_WIDTH } from '../types'
import type { AudioTrack, FilterSettings, TextLayer } from '../types'

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
  if (ffmpegSingleton) return ffmpegSingleton
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

/** Detects whether the given file (already written to the FFmpeg FS) has an audio stream. */
async function probeHasAudio(ffmpeg: FFmpeg, filename: string): Promise<boolean> {
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

function extensionOf(file: File): string {
  const dot = file.name.lastIndexOf('.')
  return dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : 'bin'
}

export interface ExportParams {
  videoFile: File
  trimStart: number
  trimEnd: number
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
    crop,
    filter,
    textLayers,
    audio,
    muteOriginal,
    originalVolume,
    onProgress,
    onLog,
  } = params

  const duration = Math.max(0.1, trimEnd - trimStart)
  const ffmpeg = await getFFmpeg(onLog)

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      if (Number.isFinite(progress)) onProgress(Math.min(1, Math.max(0, progress)))
    })
  }

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

  // --- Build the video filter chain -----------------------------------------------------
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

  const videoChain = [
    `[0:v]trim=start=${trimStart}:end=${trimEnd}`,
    'setpts=PTS-STARTPTS',
    scaleExpr,
    cropExpr,
    eqExpr + sepiaExpr,
    ...drawtextParts,
  ].join(',') + '[vout]'

  const filterParts = [videoChain]
  let audioLabel: string | null = null

  if (hasOriginalAudio && audio) {
    filterParts.push(
      `[0:a]atrim=start=${trimStart}:end=${trimEnd},asetpts=PTS-STARTPTS,volume=${originalVolume.toFixed(2)}[origaud]`,
    )
    filterParts.push(
      `[1:a]atrim=start=${audio.offset}:end=${audio.offset + duration},asetpts=PTS-STARTPTS,volume=${audio.volume.toFixed(2)}[bgaud]`,
    )
    filterParts.push('[origaud][bgaud]amix=inputs=2:duration=first:normalize=0[aout]')
    audioLabel = '[aout]'
  } else if (hasOriginalAudio) {
    filterParts.push(
      `[0:a]atrim=start=${trimStart}:end=${trimEnd},asetpts=PTS-STARTPTS,volume=${originalVolume.toFixed(2)}[aout]`,
    )
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
}
