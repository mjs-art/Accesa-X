'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { Sidebar } from '@/components/layout/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/')
      else setChecking(false)
    })
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#3CBEDB]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex">
      <Sidebar />
      <main className="flex-1 ml-40 min-h-screen">
        {children}
      </main>
    </div>
  )
}
