'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Users, UserPlus, Mail, Trash2, Clock, CheckCircle2, Shield, Eye, Loader2 } from 'lucide-react'
import {
  getTeamMembersAction,
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
  type TeamMember,
  type MemberRole,
} from '@/app/actions/equipo'

const ROLE_LABELS: Record<MemberRole, string> = {
  admin: 'Administrador',
  viewer: 'Solo lectura',
}

const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  admin: 'Puede ver toda la inteligencia y crear solicitudes de crédito',
  viewer: 'Solo puede ver la inteligencia de negocio',
}

function RoleBadge({ role }: { role: MemberRole }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
        <Shield className="h-3 w-3" /> Administrador
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
      <Eye className="h-3 w-3" /> Solo lectura
    </span>
  )
}

function StatusBadge({ status }: { status: 'pending' | 'active' }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <CheckCircle2 className="h-3 w-3" /> Activo
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
      <Clock className="h-3 w-3" /> Pendiente
    </span>
  )
}

export default function EquipoPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invite form
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('viewer')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  // Remove dialog
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getTeamMembersAction()
    if ('error' in res) {
      setError(res.error)
    } else {
      setMembers(res.members)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(false)
    if (!email.trim()) return
    setInviting(true)
    const res = await inviteMemberAction(email.trim().toLowerCase(), role)
    if ('error' in res) {
      setInviteError(res.error)
    } else {
      setInviteSuccess(true)
      setEmail('')
      await load()
    }
    setInviting(false)
  }

  async function handleRemove() {
    if (!removeTarget) return
    setRemoving(true)
    await removeMemberAction(removeTarget.id)
    setRemoveTarget(null)
    setRemoving(false)
    await load()
  }

  async function handleRoleChange(member: TeamMember, newRole: MemberRole) {
    await updateMemberRoleAction(member.id, newRole)
    await load()
  }

  const active  = members.filter((m) => m.status === 'active')
  const pending = members.filter((m) => m.status === 'pending')

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#0F2D5E] flex items-center justify-center">
          <Users className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Equipo</h1>
          <p className="text-sm text-slate-500">Invita colaboradores y gestiona sus permisos</p>
        </div>
      </div>

      {/* Roles info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(Object.entries(ROLE_DESCRIPTIONS) as [MemberRole, string][]).map(([r, desc]) => (
          <div key={r} className="flex gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
            <div className="mt-0.5">
              {r === 'admin' ? <Shield className="h-4 w-4 text-blue-600" /> : <Eye className="h-4 w-4 text-slate-500" />}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{ROLE_LABELS[r]}</p>
              <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Invite form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-[#00C896]" />
            Invitar persona
          </CardTitle>
          <CardDescription>
            El invitado recibirá un correo para crear su cuenta y unirse al equipo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="email"
                placeholder="correo@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                required
              />
            </div>
            <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Solo lectura</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="submit"
              disabled={inviting}
              className="bg-[#00C896] hover:bg-[#00b386] text-white shrink-0"
            >
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar invitación'}
            </Button>
          </form>
          {inviteError && (
            <p className="mt-2 text-sm text-red-600">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="mt-2 text-sm text-green-600">Invitación enviada correctamente.</p>
          )}
        </CardContent>
      </Card>

      {/* Members list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="space-y-4">
          {/* Active */}
          {active.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600 font-medium">
                  Miembros activos ({active.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100">
                {active.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    onRemove={() => setRemoveTarget(m)}
                    onRoleChange={(r) => handleRoleChange(m, r)}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pending */}
          {pending.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600 font-medium">
                  Invitaciones pendientes ({pending.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100">
                {pending.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    onRemove={() => setRemoveTarget(m)}
                    onRoleChange={(r) => handleRoleChange(m, r)}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {members.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aún no has invitado a nadie</p>
            </div>
          )}
        </div>
      )}

      {/* Remove dialog */}
      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar miembro</DialogTitle>
            <DialogDescription>
              ¿Eliminar a <strong>{removeTarget?.invitedEmail}</strong> del equipo?
              {removeTarget?.status === 'pending'
                ? ' La invitación quedará cancelada.'
                : ' Ya no tendrá acceso al dashboard.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancelar</Button>
            <Button
              onClick={handleRemove}
              disabled={removing}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MemberRow({
  member,
  onRemove,
  onRoleChange,
}: {
  member: TeamMember
  onRemove: () => void
  onRoleChange: (role: MemberRole) => void
}) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      {/* Avatar */}
      <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
        <span className="text-sm font-medium text-slate-600 uppercase">
          {member.invitedEmail[0]}
        </span>
      </div>

      {/* Email + status */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{member.invitedEmail}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <StatusBadge status={member.status} />
        </div>
      </div>

      {/* Role selector */}
      <Select value={member.role} onValueChange={(v) => onRoleChange(v as MemberRole)}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="viewer">Solo lectura</SelectItem>
          <SelectItem value="admin">Administrador</SelectItem>
        </SelectContent>
      </Select>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        title="Eliminar"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
