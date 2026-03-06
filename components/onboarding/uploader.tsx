'use client'

import { useRef, useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type UploaderState = 'idle' | 'uploading' | 'validating' | 'ready' | 'error'

interface UploaderProps {
  label: string
  accept?: string
  maxSizeMB?: number
  onUpload: (file: File) => Promise<{ url: string } | { error: string }>
  onClear?: () => void
  disabled?: boolean
}

export function Uploader({
  label,
  accept = 'application/pdf,image/*',
  maxSizeMB = 10,
  onUpload,
  onClear,
  disabled = false,
}: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploaderState>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleFile(file: File) {
    if (file.size > maxSizeMB * 1024 * 1024) {
      setState('error')
      setErrorMsg(`El archivo supera el límite de ${maxSizeMB} MB`)
      return
    }

    setFileName(file.name)
    setState('uploading')
    setErrorMsg(null)

    const result = await onUpload(file)

    if ('error' in result) {
      setState('error')
      setErrorMsg(result.error)
      return
    }

    setState('validating')
    // Brief validation state for UX feedback
    await new Promise((r) => setTimeout(r, 600))
    setState('ready')
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleClear() {
    setState('idle')
    setFileName(null)
    setErrorMsg(null)
    if (inputRef.current) inputRef.current.value = ''
    onClear?.()
  }

  const isProcessing = state === 'uploading' || state === 'validating'

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[#0F172A]">{label}</p>

      {/* Drop zone — shown when idle or error */}
      {(state === 'idle' || state === 'error') && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          disabled={disabled}
          className="w-full flex flex-col items-center gap-2 border-2 border-dashed border-slate-200 rounded-xl px-4 py-6 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="h-5 w-5 text-[#64748B]" />
          <span className="text-sm text-[#64748B]">
            Arrastra o <span className="text-[#0F2D5E] font-medium">selecciona un archivo</span>
          </span>
          <span className="text-xs text-slate-400">PDF o imagen · máx. {maxSizeMB} MB</span>
        </button>
      )}

      {/* Uploading / validating state */}
      {isProcessing && (
        <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 bg-white">
          <Loader2 className="h-4 w-4 animate-spin text-[#0F2D5E] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#0F172A] truncate">{fileName}</p>
            <p className="text-xs text-[#64748B]">
              {state === 'uploading' ? 'Subiendo…' : 'Validando…'}
            </p>
          </div>
        </div>
      )}

      {/* Ready state */}
      {state === 'ready' && (
        <div className="flex items-center gap-3 border border-emerald-200 rounded-xl px-4 py-3 bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-[#00C896] shrink-0" />
          <p className="text-sm text-emerald-800 flex-1 truncate">{fileName}</p>
          <button
            type="button"
            onClick={handleClear}
            className="text-[#64748B] hover:text-[#0F172A] shrink-0"
            aria-label="Quitar archivo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error message */}
      {state === 'error' && errorMsg && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-600">{errorMsg}</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
    </div>
  )
}
