'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ClipboardList, Building2 } from 'lucide-react'

const NAV = [
  { href: '/admin', label: 'Solicitudes', icon: ClipboardList, exact: true },
  { href: '/admin/empresas', label: 'Empresas', icon: Building2, exact: false },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-[#1C1C1E] flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <span className="text-xl font-bold text-white">accesa</span>
          <span className="ml-2 text-[10px] font-semibold tracking-widest text-white/40 uppercase">
            Admin
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact)
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:bg-white/8 hover:text-white/90'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            )
          })}
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-[11px] text-white/30">Portal interno AccesaX</p>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 bg-[#F5F5F5] min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}
