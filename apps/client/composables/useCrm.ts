// composables/useCrm.ts — tipos e formatação compartilhados pelas telas do CRM
import {
  Phone, MessageSquare, MapPin, CheckSquare, CalendarDays, StickyNote, Bot,
} from "lucide-vue-next"

export interface PipelineStage {
  id: string
  name: string
  color: string
  probability: number
  position: number
  rottenDays?: number | null
  isWon: boolean
}

export interface Pipeline {
  id: string
  name: string
  color: string
  isDefault: boolean
  stages: PipelineStage[]
  _count?: { deals: number }
}

export interface DealTask {
  id: string
  type: string
  title?: string | null
  dueAt?: string | null
}

export interface Deal {
  id: string
  title: string
  value: number
  status: "OPEN" | "WON" | "LOST"
  pipelineId: string
  stageId: string
  source?: string | null
  tags: string[]
  products: { name: string; qty: number; price: number }[]
  expectedCloseDate?: string | null
  stageChangedAt: string
  createdAt: string
  updatedAt: string
  wonAt?: string | null
  lostAt?: string | null
  lostReason?: string | null
  lostNote?: string | null
  contactId?: string | null
  conversationId?: string | null
  ownerId?: string | null
  contact?: { id: string; name?: string | null; phoneNumber: string } | null
  owner?: { id: string; name: string } | null
  conversation?: { id: string; unreadCount?: number; status?: string } | null
  stage?: { id: string; name: string; color: string; probability: number; isWon: boolean }
  channel?: string | null
  nextTask?: DealTask | null
}

export interface DealActivity {
  id: string
  type: string
  title?: string | null
  content?: string | null
  dueAt?: string | null
  doneAt?: string | null
  createdAt: string
  meta?: Record<string, any>
  user?: { id: string; name: string } | null
  assignee?: { id: string; name: string } | null
}

export interface Member {
  id: string
  name: string
}

export const ACTIVITY_TYPES: Record<string, { label: string; icon: any; bg: string; fg: string }> = {
  NOTE:     { label: "Nota",     icon: StickyNote,    bg: "bg-zinc-800",       fg: "text-zinc-200" },
  TASK:     { label: "Tarefa",   icon: CheckSquare,   bg: "bg-zinc-800",       fg: "text-zinc-200" },
  CALL:     { label: "Ligação",  icon: Phone,         bg: "bg-blue-900/60",    fg: "text-blue-200" },
  WHATSAPP: { label: "WhatsApp", icon: MessageSquare, bg: "bg-emerald-950",    fg: "text-emerald-300" },
  VISIT:    { label: "Visita",   icon: MapPin,        bg: "bg-amber-950",      fg: "text-amber-300" },
  MEETING:  { label: "Reunião",  icon: CalendarDays,  bg: "bg-violet-950",     fg: "text-violet-200" },
  SYSTEM:   { label: "Sistema",  icon: Bot,           bg: "bg-zinc-800",       fg: "text-zinc-300" },
}

export const CHANNELS: Record<string, { label: string; dot: string }> = {
  BAILEYS:            { label: "WhatsApp",  dot: "bg-green-500" },
  META_CLOUD_API:     { label: "WhatsApp",  dot: "bg-green-500" },
  EVOLUTION_API:      { label: "WhatsApp",  dot: "bg-green-500" },
  INSTAGRAM:          { label: "Instagram", dot: "bg-pink-400" },
  FACEBOOK_MESSENGER: { label: "Messenger", dot: "bg-blue-400" },
}

// Paleta oferecida no editor de etapas — todas com contraste ≥ 3:1 sobre zinc-900
export const STAGE_COLORS = ["#a1a1aa", "#60a5fa", "#a78bfa", "#f472b6", "#fbbf24", "#fb923c", "#2dd4bf", "#34d399"]

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
const brlCompact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 })

export function formatBRL(value: number | null | undefined) {
  return brl.format(value ?? 0)
}

export function formatBRLCompact(value: number | null | undefined) {
  return brlCompact.format(value ?? 0)
}

export function personInitials(name?: string | null) {
  return (name ?? "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"
}

const OWNER_TONES = [
  "bg-blue-900 text-blue-200",
  "bg-violet-900 text-violet-200",
  "bg-emerald-900 text-emerald-200",
  "bg-amber-900 text-amber-200",
  "bg-pink-900 text-pink-200",
  "bg-cyan-900 text-cyan-200",
]

export function personTone(id?: string | null) {
  if (!id) return "bg-zinc-800 text-zinc-300"
  const idx = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0) % OWNER_TONES.length
  return OWNER_TONES[idx]
}

export function isOverdue(iso?: string | null) {
  return !!iso && new Date(iso).getTime() < Date.now()
}

export function isToday(iso?: string | null) {
  if (!iso) return false
  const d = new Date(iso)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

/** "hoje 14:00", "amanhã", "03/10 14:00", "atrasada há 2 dias" */
export function formatDue(iso?: string | null, { done = false } = {}) {
  if (!iso) return ""
  const d = new Date(iso)
  const now = new Date()
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dayDiff = Math.round((startOf(d) - startOf(now)) / 86400000)
  if (!done && d.getTime() < now.getTime()) {
    if (dayDiff === 0) return `atrasada · hoje ${time}`
    const days = -dayDiff
    return `atrasada há ${days} dia${days > 1 ? "s" : ""}`
  }
  if (dayDiff === 0) return `hoje ${time}`
  if (dayDiff === 1) return `amanhã ${time}`
  if (dayDiff === -1) return `ontem ${time}`
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${time}`
}

export function formatDate(iso?: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isToday(iso)) return `Hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export function daysSince(iso?: string | null) {
  if (!iso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
}

/** Converte "YYYY-MM-DDTHH:mm" (input datetime-local) em ISO, ou null */
export function localInputToIso(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function isoToLocalInput(iso?: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function apiErrorMessage(err: any, fallback: string) {
  return err?.data?.error ?? err?.response?._data?.error ?? fallback
}
