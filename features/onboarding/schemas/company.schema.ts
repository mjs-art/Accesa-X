import { z } from 'zod'

export const INDUSTRIAS = [
  'Manufactura',
  'Servicios',
  'Comercio',
  'Construcción',
  'Tecnología',
  'Otro',
] as const

export const TAMANOS = [
  { value: '1-10', label: '1 – 10 empleados' },
  { value: '11-50', label: '11 – 50 empleados' },
  { value: '51-200', label: '51 – 200 empleados' },
  { value: '200+', label: 'Más de 200 empleados' },
] as const

// RFC mexicano: 3-4 letras + 6 dígitos (fecha) + 3 alfanuméricos (homoclave)
// Personas morales: 12 chars | Personas físicas: 13 chars
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i

export const companySchema = z.object({
  nombreRazonSocial: z.string().min(3, 'Mínimo 3 caracteres'),
  rfc: z
    .string()
    .regex(RFC_REGEX, 'RFC inválido — 12 chars persona moral, 13 persona física'),
  industria: z.string().min(1, 'Selecciona una industria'),
  tamanoEmpresa: z.string().min(1, 'Selecciona el tamaño de empresa'),
})

export type CompanyFormData = z.infer<typeof companySchema>
