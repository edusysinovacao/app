import type { ReactNode } from 'react'

export function PanelSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      {description && <p className="mt-1 text-xs text-zinc-500">{description}</p>}
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </div>
  )
}

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-400">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="font-mono text-zinc-300">{format ? format(value) : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}
