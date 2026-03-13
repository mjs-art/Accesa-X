// Helpers de API Syntage reutilizables
// Extraído de sync-cfdis para compartir lógica en sync-sat-full

export interface SyntageInvoice {
  id: string
  uuid?: string
  type: string
  status: string
  total: number
  subtotal?: number
  issuedAt: string
  expiresAt?: string | null
  paidAmount?: number
  dueAmount?: number
  fullyPaidAt?: string | null
  receiver: { rfc: string; name?: string | null }
  issuer:   { rfc: string; name?: string | null }
  blacklistStatus?: string | null
  concepts?: {
    claveProdServ?: string
    description?:  string
    quantity?:     number
    unit?:         string
    unitValue?:    number
    amount?:       number
  }[]
}

export interface SyntageAnnualReturn {
  id:                   string
  ejercicio?:           number
  periodo?:             string
  tipoDeclaracion?:     string
  ingresosAcumulables?: number
  deduccionesTotales?:  number
  utilidadFiscal?:      number
  isrCausado?:          number
  isrACargo?:           number
  rawData?:             Record<string, unknown>
}

interface SyntageListResponse<T> {
  'hydra:member':     T[]
  'hydra:totalItems': number
  'hydra:view'?: {
    'hydra:next'?: string
  }
}

// Obtiene todas las páginas de un endpoint de Syntage.
// Soporta cursor pagination (hydra:view → hydra:next) y offset pagination.
export async function fetchAllPages<T>(
  baseUrl: URL,
  apiKey: string,
): Promise<T[]> {
  const all: T[] = []
  const itemsPerPage = 300

  // Primera petición sin número de página (cursor pagination lo requiere)
  const firstUrl = new URL(baseUrl.toString())
  firstUrl.searchParams.set('itemsPerPage', String(itemsPerPage))
  firstUrl.searchParams.delete('page')

  let nextUrl: string | null = firstUrl.toString()

  while (nextUrl) {
    console.log(`Syntage fetchAllPages GET ${nextUrl}`)
    const res = await fetch(nextUrl, {
      headers: { 'X-API-Key': apiKey },
    })

    if (!res.ok) {
      console.error(`Syntage fetchAllPages ${res.status}:`, await res.text())
      break
    }

    const data: SyntageListResponse<T> = await res.json()
    const items = data['hydra:member'] ?? []
    console.log(`Syntage fetchAllPages OK — totalItems:${data['hydra:totalItems']} items:${items.length}`)
    all.push(...items)

    if (items.length === 0) break

    const nextPath = data['hydra:view']?.['hydra:next']
    if (!nextPath) break

    nextUrl = nextPath.startsWith('http')
      ? nextPath
      : `${baseUrl.protocol}//${baseUrl.host}${nextPath}`
  }

  return all
}

// Resuelve el entity UUID de Syntage a partir del RFC
export async function fetchEntityId(
  rfc: string,
  apiKey: string,
  baseUrl: string,
): Promise<string | null> {
  const res = await fetch(
    `${baseUrl}/entities?taxpayer.id=${encodeURIComponent(rfc)}`,
    { headers: { 'X-API-Key': apiKey } },
  )
  if (!res.ok) return null

  const data = await res.json()
  const entities: { id: string }[] = data['hydra:member'] ?? []
  return entities.length > 0 ? entities[0].id : null
}

// Dispara extracciones de invoice y annual_tax_return en Syntage
export async function triggerExtractions(
  entityIri: string,
  apiKey: string,
  baseUrl: string,
): Promise<void> {
  const headers = { 'X-API-Key': apiKey, 'Content-Type': 'application/json' }
  await Promise.allSettled([
    fetch(`${baseUrl}/extractions`, {
      method:  'POST',
      headers,
      body: JSON.stringify({ entity: entityIri, extractor: 'invoice' }),
    }),
    fetch(`${baseUrl}/extractions`, {
      method:  'POST',
      headers,
      body: JSON.stringify({ entity: entityIri, extractor: 'annual_tax_return' }),
    }),
  ])
}

// Verifica que la credencial sigue en estado 'valid'
export async function checkCredential(
  credentialId: string,
  apiKey: string,
  baseUrl: string,
): Promise<'valid' | 'invalid' | 'error'> {
  const res = await fetch(`${baseUrl}/credentials/${credentialId}`, {
    headers: { 'X-API-Key': apiKey },
  })
  if (!res.ok) return 'error'
  const data = await res.json()
  const status = data.status as string
  if (status === 'valid') return 'valid'
  if (status === 'invalid' || status === 'deactivated') return 'invalid'
  return 'error'
}

// Obtiene declaraciones anuales de un contribuyente
export async function fetchAnnualReturns(
  entityId: string,
  apiKey: string,
  baseUrl: string,
): Promise<SyntageAnnualReturn[]> {
  const url = new URL(`${baseUrl}/entities/${entityId}/annual_tax_returns`)
  return fetchAllPages<SyntageAnnualReturn>(url, apiKey)
}
