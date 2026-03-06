import { z } from 'zod'

// CURP: 4 letras + 6 dígitos + sexo (H/M) + 2 letras estado + 3 letras apellido/nombre + 1 alfanumerico + 1 dígito
const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/

// RFC persona física: 4 letras + 6 dígitos + 3 alfanuméricos = 13 chars
const RFC_PERSONA_FISICA_REGEX = /^[A-ZÑ&]{4}\d{6}[A-Z\d]{3}$/i

// Teléfono: 10 dígitos
const TELEFONO_REGEX = /^\d{10}$/

export const legalRepSchema = z.object({
  esElUsuario: z.boolean(),
  nombres: z.string().min(2, 'Ingresa el nombre').optional().or(z.literal('')),
  apellidoPaterno: z.string().min(2, 'Ingresa el apellido paterno').optional().or(z.literal('')),
  apellidoMaterno: z.string().optional().or(z.literal('')),
  curp: z
    .string()
    .regex(CURP_REGEX, 'CURP inválida — 18 caracteres')
    .optional()
    .or(z.literal('')),
  rfcPersonal: z
    .string()
    .regex(RFC_PERSONA_FISICA_REGEX, 'RFC inválido — 13 caracteres (persona física)')
    .optional()
    .or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefono: z
    .string()
    .regex(TELEFONO_REGEX, 'Teléfono inválido — 10 dígitos sin espacios ni guiones')
    .optional()
    .or(z.literal('')),
})

export type LegalRepFormData = z.infer<typeof legalRepSchema>
