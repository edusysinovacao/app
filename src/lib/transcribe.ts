import { pipeline, env } from '@huggingface/transformers'
import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

// Models are fetched from the Hugging Face Hub CDN on first use and then cached
// by the browser (transformers.js uses the Cache Storage API), so this only
// costs a real download once per device.
env.allowLocalModels = false
// Force the single-threaded onnxruntime-web WASM build: the multi-threaded one needs
// SharedArrayBuffer, which requires cross-origin-isolation (COOP/COEP) response headers —
// unavailable on static hosts like GitHub Pages, where this app is deployed.
env.backends.onnx.wasm!.numThreads = 1

const MODEL_ID = 'Xenova/whisper-tiny'

let asrPipelinePromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null

export interface ModelLoadProgress {
  status: string
  file?: string
  progress?: number
}

/** Loads (once) and returns the shared speech-to-text pipeline. */
export async function getAsrPipeline(
  onProgress?: (p: ModelLoadProgress) => void,
): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!asrPipelinePromise) {
    asrPipelinePromise = pipeline('automatic-speech-recognition', MODEL_ID, {
      device: 'wasm',
      // Unquantized weights: some of this model's quantized (q8/q4) ONNX exports hit a
      // known onnxruntime-web bug ("Missing required scale... MatMulNBits") on the
      // decoder's embedding layer. fp32 is larger to download but always well-formed.
      dtype: 'fp32',
      progress_callback: onProgress as (p: unknown) => void,
    }) as Promise<AutomaticSpeechRecognitionPipeline>
  }
  return asrPipelinePromise
}

export interface TranscriptSegment {
  start: number
  end: number
  text: string
}

const LANGUAGE_NAMES: Record<string, string> = {
  auto: '',
  portuguese: 'portuguese',
  english: 'english',
  spanish: 'spanish',
}

export async function transcribeSamples(
  samples: Float32Array,
  options: { language?: keyof typeof LANGUAGE_NAMES; onProgress?: (p: ModelLoadProgress) => void } = {},
): Promise<TranscriptSegment[]> {
  const { language = 'auto', onProgress } = options
  const asr = await getAsrPipeline(onProgress)

  const langOption = LANGUAGE_NAMES[language] || undefined
  const result = await asr(samples, {
    language: langOption,
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
  })

  const output = Array.isArray(result) ? result[0] : result
  const chunks: { text: string; timestamp: [number | null, number | null] }[] = output?.chunks?.length
    ? output.chunks
    : [{ text: output?.text ?? '', timestamp: [0, samples.length / 16000] }]

  return chunks
    .map((c): TranscriptSegment => {
      const [start, end] = c.timestamp ?? [0, 0]
      return { start: start ?? 0, end: end ?? (start ?? 0) + 2, text: (c.text ?? '').trim() }
    })
    .filter((s) => s.text.length > 0)
}
