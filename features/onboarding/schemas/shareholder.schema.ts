import { z } from 'zod'

const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/

export const shareholderSchema = z.object({
  esPersonaMoral: z.boolean().default(false),
  poseeMas25Porciento: z.boolean(),
  porcentajeParticipacion: z
    .number()
    .min(0.01, 'El porcentaje debe ser mayor a 0')
    .max(100, 'El porcentaje no puede ser mayor a 100')
    .optional(),
  // Campos requeridos solo si posee_mas_25_porciento = true
  nombres: z.string().min(2, 'Ingresa el nombre').optional().or(z.literal('')),
  apellidoPaterno: z.string().min(2, 'Ingresa el apellido paterno').optional().or(z.literal('')),
  apellidoMaterno: z.string().optional().or(z.literal('')),
  curp: z
    .string()
    .regex(CURP_REGEX, 'CURP inválida — 18 caracteres')
    .optional()
    .or(z.literal('')),
  fechaNacimiento: z.string().optional().or(z.literal('')),
  ocupacion: z.string().optional().or(z.literal('')),
  telefono: z
    .string()
    .regex(/^\d{10}$/, 'Teléfono inválido — 10 dígitos')
    .optional()
    .or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
})

export type ShareholderFormData = z.infer<typeof shareholderSchema>
