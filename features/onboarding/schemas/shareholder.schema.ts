import { z } from 'zod'

const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/

export const shareholderSchema = z
  .object({
    esPersonaMoral: z.boolean().default(false),
    poseeMas25Porciento: z.boolean(),
    porcentajeParticipacion: z
      .number()
      .min(0.01, 'El porcentaje debe ser mayor a 0')
      .max(100, 'El porcentaje no puede ser mayor a 100')
      .optional(),
    nombres: z.string().optional().or(z.literal('')),
    apellidoPaterno: z.string().optional().or(z.literal('')),
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
  .superRefine((data, ctx) => {
    // Porcentaje always required
    if (!data.porcentajeParticipacion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El porcentaje de participación es requerido',
        path: ['porcentajeParticipacion'],
      })
    }
    // When shareholder owns >25% and is a natural person, personal fields are required
    if (data.poseeMas25Porciento && !data.esPersonaMoral) {
      if (!data.nombres || data.nombres.trim().length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Nombre es requerido (mínimo 2 caracteres)', path: ['nombres'] })
      }
      if (!data.apellidoPaterno || data.apellidoPaterno.trim().length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Apellido paterno es requerido (mínimo 2 caracteres)', path: ['apellidoPaterno'] })
      }
      if (!data.curp || data.curp.trim() === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CURP es requerida', path: ['curp'] })
      }
      if (!data.email || data.email.trim() === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Correo electrónico es requerido', path: ['email'] })
      }
      if (!data.ocupacion || data.ocupacion.trim() === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ocupación es requerida', path: ['ocupacion'] })
      }
    }
  })

export type ShareholderFormData = z.infer<typeof shareholderSchema>
