'use server'

import { Resend } from 'resend'

function getResend() { return new Resend(process.env.RESEND_API_KEY!) }
const FROM = 'AccesaX <noreply@accesa.mx>'

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// ── Templates ─────────────────────────────────────────────────────────────────

function baseLayout(content: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AccesaX</title>
</head>
<body style="margin:0;padding:0;background:#F5F7FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FA;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">
        <!-- Header -->
        <tr>
          <td style="background:#0F2D5E;padding:24px 32px;">
            <span style="color:#3CBEDB;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Accesa<span style="color:#ffffff;">X</span></span>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:32px;">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #F1F5F9;background:#FAFAFA;">
            <p style="margin:0;font-size:11px;color:#94A3B8;text-align:center;">
              AccesaX · Financiamiento inteligente para empresas mexicanas<br/>
              <a href="https://accesa.mx" style="color:#3CBEDB;text-decoration:none;">accesa.mx</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function btnPrimary(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#3CBEDB;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">${label}</a>`
}

function mxnFormat(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

// ── Email senders ─────────────────────────────────────────────────────────────

export async function sendSolicitudRecibidaEmail(
  to: string,
  empresa: string,
  monto: number,
  tipo: 'proyecto' | 'factoraje',
  solicitudId: string
) {
  if (!process.env.RESEND_API_KEY) return

  const tipoLabel = tipo === 'factoraje' ? 'factoraje' : 'crédito por proyecto'
  const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://accesa.mx'}/dashboard/credito/${solicitudId}`
  const safeEmpresa = escapeHtml(empresa)

  const html = baseLayout(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1A1A1A;">Solicitud recibida</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#64748B;line-height:1.6;">
      Hola <strong>${safeEmpresa}</strong>, hemos recibido tu solicitud de <strong>${tipoLabel}</strong> por
      <strong>${mxnFormat(monto)}</strong>. Nuestro equipo la revisará en las próximas 24–48 horas hábiles.
    </p>
    <table cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:10px;padding:16px;width:100%;box-sizing:border-box;">
      <tr><td style="font-size:12px;color:#94A3B8;padding-bottom:4px;">Tipo de financiamiento</td></tr>
      <tr><td style="font-size:14px;font-weight:600;color:#1A1A1A;padding-bottom:12px;">${tipoLabel.charAt(0).toUpperCase() + tipoLabel.slice(1)}</td></tr>
      <tr><td style="font-size:12px;color:#94A3B8;padding-bottom:4px;">Monto solicitado</td></tr>
      <tr><td style="font-size:18px;font-weight:700;color:#1A1A1A;">${mxnFormat(monto)}</td></tr>
    </table>
    ${btnPrimary(dashUrl, 'Ver mi solicitud →')}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Solicitud recibida — ${mxnFormat(monto)}`,
    html,
  })
}

export async function sendSolicitudAprobadaEmail(
  to: string,
  empresa: string,
  monto: number,
  tipo: 'proyecto' | 'factoraje',
  solicitudId: string
) {
  if (!process.env.RESEND_API_KEY) return

  const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://accesa.mx'}/dashboard/credito/${solicitudId}`
  const safeEmpresa = escapeHtml(empresa)

  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:#ECFDF5;border-radius:50%;margin-bottom:12px;">
        <span style="font-size:28px;">✓</span>
      </div>
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1A1A1A;">¡Tu solicitud fue aprobada!</h2>
      <p style="margin:0;font-size:14px;color:#64748B;">Estamos coordinando la dispersión de fondos</p>
    </div>
    <table cellpadding="0" cellspacing="0" style="background:#ECFDF5;border-radius:10px;padding:16px;width:100%;box-sizing:border-box;margin-bottom:20px;">
      <tr><td style="font-size:12px;color:#059669;padding-bottom:4px;">Monto aprobado</td></tr>
      <tr><td style="font-size:24px;font-weight:800;color:#047857;">${mxnFormat(monto)}</td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#64748B;line-height:1.7;">
      Hola <strong>${safeEmpresa}</strong>, tu solicitud de financiamiento fue aprobada.
      Nuestro equipo se pondrá en contacto contigo a la brevedad para coordinar los siguientes pasos y la dispersión de fondos.
    </p>
    ${btnPrimary(dashUrl, 'Ver detalle de mi solicitud →')}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `✓ Solicitud aprobada — ${mxnFormat(monto)}`,
    html,
  })
}

export async function sendSolicitudRechazadaEmail(
  to: string,
  empresa: string,
  monto: number,
  motivo: string,
  solicitudId: string
) {
  if (!process.env.RESEND_API_KEY) return

  const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://accesa.mx'}/dashboard/credito/${solicitudId}`
  const safeEmpresa = escapeHtml(empresa)
  const safeMotivo = escapeHtml(motivo)

  const html = baseLayout(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1A1A1A;">Actualización sobre tu solicitud</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#64748B;line-height:1.6;">
      Hola <strong>${safeEmpresa}</strong>, luego de revisar tu solicitud por <strong>${mxnFormat(monto)}</strong>,
      en esta ocasión no podemos continuar con el proceso.
    </p>
    ${safeMotivo ? `
    <div style="background:#FFF7ED;border-left:3px solid #F97316;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#9A3412;"><strong>Motivo:</strong> ${safeMotivo}</p>
    </div>` : ''}
    <p style="margin:0;font-size:13px;color:#64748B;line-height:1.7;">
      Si tienes preguntas o crees que hubo un error, no dudes en contactarnos respondiendo este correo.
    </p>
    ${btnPrimary(dashUrl, 'Ver mi solicitud →')}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Resolución sobre tu solicitud AccesaX`,
    html,
  })
}

export async function sendDocsPendientesEmail(
  to: string,
  empresa: string,
  notas: string,
  solicitudId: string
) {
  if (!process.env.RESEND_API_KEY) return

  const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://accesa.mx'}/dashboard/credito/${solicitudId}`
  const safeEmpresa = escapeHtml(empresa)
  const safeNotas = escapeHtml(notas)

  const html = baseLayout(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1A1A1A;">Documentos adicionales requeridos</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#64748B;line-height:1.6;">
      Hola <strong>${safeEmpresa}</strong>, estamos revisando tu solicitud y necesitamos que nos hagas llegar información adicional para continuar.
    </p>
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#92400E;text-transform:uppercase;letter-spacing:0.05em;">Lo que necesitamos</p>
      <p style="margin:0;font-size:14px;color:#78350F;line-height:1.6;">${safeNotas}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#64748B;">
      Ingresa a tu portal para subir los documentos desde la sección de tu solicitud.
    </p>
    ${btnPrimary(dashUrl, 'Subir documentos →')}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Acción requerida — Documentos pendientes`,
    html,
  })
}

export async function sendFondosLiberadosEmail(
  to: string,
  empresa: string,
  monto: number,
  solicitudId: string
) {
  if (!process.env.RESEND_API_KEY) return

  const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://accesa.mx'}/dashboard/credito/${solicitudId}`
  const safeEmpresa = escapeHtml(empresa)

  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:24px;">
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1A1A1A;">Fondos liberados 🎉</h2>
      <p style="margin:0;font-size:14px;color:#64748B;">Los recursos están en camino</p>
    </div>
    <table cellpadding="0" cellspacing="0" style="background:#EFF6FF;border-radius:10px;padding:16px;width:100%;box-sizing:border-box;margin-bottom:20px;">
      <tr><td style="font-size:12px;color:#1D4ED8;padding-bottom:4px;">Monto dispersado</td></tr>
      <tr><td style="font-size:24px;font-weight:800;color:#1E40AF;">${mxnFormat(monto)}</td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#64748B;line-height:1.7;">
      Hola <strong>${safeEmpresa}</strong>, los fondos para tu solicitud han sido liberados.
      La transferencia puede tomar 1–2 días hábiles dependiendo del banco receptor.
    </p>
    ${btnPrimary(dashUrl, 'Ver detalle →')}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Fondos liberados — ${mxnFormat(monto)}`,
    html,
  })
}
