'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, BarChart3, CreditCard, User, LogOut,
  ChevronDown, TrendingUp, TrendingDown, Clock, AlertCircle,
  FileText, PlusCircle,
} from 'lucide-react'
import { useState } from 'react'
import { signOutAction } from '@/app/actions/dashboard'

type SubItem = { label: string; href: string; icon: React.ElementType }
type NavItem = { label: string; href: string; icon: React.ElementType; children?: SubItem[] }

const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'MI EMPRESA',
    items: [
      { label: 'Clientes', href: '/dashboard/clientes', icon: Users },
      {
        label: 'Inteligencia',
        href: '/dashboard/inteligencia',
        icon: BarChart3,
        children: [
          { label: 'Resumen', href: '/dashboard/inteligencia', icon: BarChart3 },
          { label: 'Ingresos', href: '/dashboard/inteligencia/ingresos', icon: TrendingUp },
          { label: 'Gastos', href: '/dashboard/inteligencia/gastos', icon: TrendingDown },
          { label: 'Por cobrar', href: '/dashboard/inteligencia/cxc', icon: Clock },
          { label: 'Por pagar', href: '/dashboard/inteligencia/cxp', icon: AlertCircle },
        ],
      },
    ],
  },
  {
    title: 'FINANCIAMIENTO',
    items: [
      {
        label: 'Crédito',
        href: '/dashboard/credito',
        icon: CreditCard,
        children: [
          { label: 'Mis solicitudes', href: '/dashboard/credito', icon: FileText },
          { label: 'Nuevo proyecto', href: '/credito/proyecto/nuevo', icon: PlusCircle },
          { label: 'Desc. facturas', href: '/credito/factoraje/nuevo', icon: PlusCircle },
        ],
      },
    ],
  },
  {
    items: [
      { label: 'Mi Perfil', href: '/dashboard/perfil', icon: User },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    NAV_SECTIONS.forEach(({ items }) =>
      items.forEach((item) => {
        if (item.children) {
          const active = item.children.some(
            (c) => pathname === c.href || pathname.startsWith(c.href + '/')
          )
          if (active) init[item.href] = true
        }
      })
    )
    return init
  })

  async function handleLogout() {
    await signOutAction()
    router.push('/')
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }

  function toggle(href: string) {
    setExpanded((prev) => ({ ...prev, [href]: !prev[href] }))
  }

  return (
    <aside className="fixed top-0 left-0 h-screen w-56 bg-[#1C1C1E] flex flex-col z-30">
      {/* Logo */}
      <div className="px-4 pt-6 pb-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <AccesaIcon className="h-7 w-7 shrink-0" />
          <span className="text-white font-bold text-base tracking-tight">accesa</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-1' : ''}>
            {section.title && (
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-white/30 uppercase">
                {section.title}
              </p>
            )}
            <div className="px-2 space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href)
                const open = expanded[item.href] ?? false
                const hasChildren = !!item.children

                return (
                  <div key={item.href}>
                    <button
                      onClick={() => {
                        if (hasChildren) {
                          toggle(item.href)
                          if (!open) router.push(item.href)
                        } else {
                          router.push(item.href)
                        }
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        active && !hasChildren
                          ? 'bg-[#2A2A2E] text-white'
                          : active && hasChildren
                          ? 'text-white'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#3CBEDB]' : ''}`} />
                      <span className="text-xs font-medium leading-tight flex-1">{item.label}</span>
                      {hasChildren && (
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}
                        />
                      )}
                    </button>

                    {hasChildren && open && (
                      <div className="ml-3 mt-0.5 pl-4 border-l border-white/10 space-y-0.5 mb-1">
                        {item.children!.map((child) => {
                          const childActive = pathname === child.href
                          return (
                            <button
                              key={child.href}
                              onClick={() => router.push(child.href)}
                              className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors ${
                                childActive
                                  ? 'bg-[#2A2A2E] text-white'
                                  : 'text-white/50 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <child.icon
                                className={`h-3.5 w-3.5 shrink-0 ${childActive ? 'text-[#3CBEDB]' : ''}`}
                              />
                              <span className="text-xs leading-tight">{child.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-6 border-t border-white/10 pt-3">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="text-xs font-medium">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}

function AccesaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.7 15.7L4.6 19.8L1 22.8C-.1 23.7-.3 25.2.4 26.1C1.2 27.1 2.7 27.1 3.8 26.2L18 14.6L11.8 14L9.7 15.7Z" fill="#5DAA98"/>
      <path d="M5.5 9.2C5.6 8 6.7 7.1 7.7 7.2L12.4 7.6L17.1 8.1L19.9 8.4C20.9 8.5 21.7 9.6 21.6 10.8C21.4 12 20.5 12.9 19.5 12.8L7.1 11.6C6.1 11.5 5.4 10.4 5.5 9.2Z" fill="#83C8BA"/>
      <path d="M27.6 6.5L22 3L18.1 0.5C16.9-.3 15.4-.1 14.8.9C14.1 1.9 14.5 3.4 15.7 4.2L31.1 14.1L29.8 8L27.6 6.5Z" fill="#27A3B7"/>
      <path d="M32.5.5C33.7.2 34.8 1 35 2L36 6.6L37 11.2L37.7 14C37.9 15 37.1 16 35.9 16.3C34.7 16.5 33.5 15.9 33.3 14.9L30.7 2.8C30.5 1.8 31.3.7 32.5.5Z" fill="#3FBDD9"/>
      <path d="M41.9 20.9L43.5 14.6L44.7 10C45.1 8.7 44.4 7.3 43.2 7C42 6.7 40.7 7.6 40.4 8.9L35.8 26.6L41.2 23.5L41.9 20.9Z" fill="#9965A7"/>
      <path d="M49.1 23.7C49.7 24.7 49.4 26.1 48.5 26.6L44.4 29L40.4 31.4L37.9 32.8C37 33.3 35.8 32.9 35.2 31.8C34.6 30.8 34.8 29.5 35.7 29L46.4 22.7C47.3 22.2 48.5 22.6 49.1 23.7Z" fill="#B973AE"/>
      <path d="M32.7 38.8L39.3 38.4L43.9 38.2C45.4 38.1 46.5 37 46.4 35.8C46.3 34.6 45.1 33.7 43.7 33.7L25.4 34.8L30.1 39L32.7 38.8Z" fill="#CF5B5B"/>
      <path d="M32.3 46.6C31.5 47.5 30.1 47.6 29.4 46.9L25.8 43.7L22.3 40.6L20.2 38.7C19.4 38 19.5 36.7 20.3 35.8C21.1 34.9 22.4 34.7 23.2 35.4L32.4 43.7C33.2 44.4 33.1 45.7 32.3 46.6Z" fill="#EC6169"/>
      <path d="M12.8 35.8L15.1 41.9L16.8 46.3C17.3 47.6 18.6 48.3 19.8 47.9C20.9 47.4 21.5 46 21 44.7L14.4 27.6L11.9 33.3L12.8 35.8Z" fill="#F2904A"/>
      <path d="M5.3 37.7C4.2 37.2 3.7 36 4.1 35L6 30.7L7.9 26.4L9.1 23.8C9.5 22.9 10.8 22.5 11.9 23C13 23.5 13.6 24.7 13.2 25.6L8.1 37C7.7 37.9 6.4 38.3 5.3 37.7Z" fill="#FBBC32"/>
    </svg>
  )
}
