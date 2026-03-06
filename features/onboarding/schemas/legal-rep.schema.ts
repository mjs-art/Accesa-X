import { z } from 'zod'

// CURP: 4 letras + 6 dígitos + sexo (H/M) + 2 letras estado + 3 letras apellido/nombre + 1 alfanumerico + 1 dígito
const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/

// RFC persona física: 4 letras + 6 dígitos + 3 alfanuméricos = 13 chars
const RFC_PERSONA_FISICA_REGEX = /^[A-ZÑ&]{4}\d{6}[A-Z\d]{3}$/i

// Teléfono: 10 dígitos
const TELEFONO_REGEX = /^\d{10}$/

export const legalRepSchema = z
  .object({
    esElUsuario: z.boolean(),
    nombres: z.string().optional().or(z.literal('')),
    apellidoPaterno: z.string().optional().or(z.literal('')),
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
  .superRefine((data, ctx) => {
    function requireName(field: 'nombres' | 'apellidoPaterno', value: string | undefined, label: string) {
      if (!value || value.trim().length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} es requerido (mínimo 2 caracteres)`, path: [field] })
      }
    }
    function requireField(field: keyof typeof data, value: string | undefined, label: string) {
      if (!value || value.trim() === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} es requerido`, path: [field] })
      }
    }

    if (data.esElUsuario) {
      // When user IS the legal rep, all personal fields are required
      requireName('nombres', data.nombres, 'Nombre')
      requireName('apellidoPaterno', data.apellidoPaterno, 'Apellido paterno')
      requireField('curp', data.curp, 'CURP')
      requireField('rfcPersonal', data.rfcPersonal, 'RFC personal')
      requireField('email', data.email, 'Correo electrónico')
      requireField('telefono', data.telefono, 'Teléfono')
    } else {
      // When a third party is the legal rep, at least their name is required
      requireName('nombres', data.nombres, 'Nombre')
      requireName('apellidoPaterno', data.apellidoPaterno, 'Apellido paterno')
    }
  })

export type LegalRepFormData = z.infer<typeof legalRepSchema>
