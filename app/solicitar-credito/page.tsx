'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SolicitarCreditoRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/credito/nuevo') }, [router])
  return null
}
