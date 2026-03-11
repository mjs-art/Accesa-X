'use client'

import { useRouter } from 'next/navigation'
import { FileText, Receipt, ChevronRight, ArrowLeft } from 'lucide-react'

const PRODUCTOS = [
  {
    id: 'proyecto',
    titulo: 'Crédito por proyecto',
    descripcion: 'Financia contratos u órdenes de compra. AccesaX adelanta hasta el 90% del valor al proveedor, tú liquidas cuando el pagador final te paga.',
    casos: ['Tienes un contrato firmado con un cliente', 'Necesitas pagar a tu proveedor antes de cobrar', 'Tu cliente es gobierno, corporativo o empresa grande'],
    icon: FileText,
    href: '/credito/proyecto/nuevo',
    color: 'sky',
  },
  {
    id: 'factoraje',
    titulo: 'Factoraje',
    descripcion: 'Descuenta facturas emitidas (CFDIs) que ya están registradas ante el SAT. Recibe liquidez inmediata sobre cuentas por cobrar vigentes.',
    casos: ['Ya emitiste facturas y están pendientes de pago', 'Quieres convertir CxC en efectivo hoy', 'Tus clientes pagan a 30–90 días y necesitas capital'],
    icon: Receipt,
    href: '/credito/factoraje/nuevo',
    color: 'violet',
  },
]

const COLOR_MAP: Record<string, { bg: string; border: string; iconBg: string; iconText: string; btn: string; bullet: string }> = {
  sky: {
    bg: 'hover:bg-sky-50/50',
    border: 'hover:border-sky-300',
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-600',
    btn: 'bg-sky-600 hover:bg-sky-700',
    bullet: 'bg-sky-400',
  },
  violet: {
    bg: 'hover:bg-violet-50/50',
    border: 'hover:border-violet-300',
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-600',
    btn: 'bg-violet-600 hover:bg-violet-700',
    bullet: 'bg-violet-400',
  },
}

export default function NuevaSolicitudPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/credito')}
          className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#1A1A1A] transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Mis solicitudes
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#1A1A1A]">¿Qué tipo de financiamiento necesitas?</h1>
          <p className="text-sm text-[#6B7280] mt-2">
            Selecciona el producto que mejor se adapta a tu situación actual
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {PRODUCTOS.map(p => {
            const c = COLOR_MAP[p.color]
            const Icon = p.icon
            return (
              <button
                key={p.id}
                onClick={() => router.push(p.href)}
                className={`group relative flex flex-col text-left bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm transition-all duration-150 ${c.bg} ${c.border} cursor-pointer`}
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 ${c.iconBg}`}>
                  <Icon className={`h-5 w-5 ${c.iconText}`} />
                </div>

                <h2 className="text-base font-bold text-[#1A1A1A] mb-2">{p.titulo}</h2>
                <p className="text-xs text-[#6B7280] leading-relaxed mb-5">{p.descripcion}</p>

                <div className="space-y-1.5 mb-6 flex-1">
                  <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Ideal si…</p>
                  {p.casos.map((caso, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${c.bullet}`} />
                      <span className="text-xs text-[#6B7280]">{caso}</span>
                    </div>
                  ))}
                </div>

                <div className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-white text-sm font-medium transition-colors ${c.btn}`}>
                  Iniciar solicitud
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            )
          })}
        </div>

        <p className="text-center text-xs text-[#6B7280]">
          ¿Dudas? Escríbenos a{' '}
          <span className="text-[#3CBEDB]">hola@accesa.mx</span>
        </p>
      </div>
    </div>
  )
}
