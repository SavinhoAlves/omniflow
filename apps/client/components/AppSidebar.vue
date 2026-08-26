<template>
  <aside class="w-64 min-h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
    <div class="h-16 flex items-center px-5 border-b border-zinc-800">
      <div class="flex items-center gap-2.5">
        <div class="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-blue-500/20">
          O
        </div>
        <span class="font-semibold text-white tracking-tight">
          Omni<span class="text-blue-400">Flow</span>
        </span>
      </div>
    </div>

    <nav class="flex-1 p-3 space-y-0.5 overflow-y-auto">
      <template v-for="item in menu" :key="item.name">
        <!-- Section header -->
        <p v-if="item.type === 'section'" class="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 first:pt-1">
          {{ item.name }}
        </p>

        <!-- Nav link -->
        <div v-else class="relative">
          <span
            v-if="isActive(item.path!)"
            class="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-blue-500"
          />
          <NuxtLink
            :to="item.path!"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-400 text-sm transition-all hover:bg-zinc-800 hover:text-white"
            active-class="!bg-zinc-800 !text-white"
          >
            <component :is="item.icon" :size="18" class="shrink-0" />
            <span class="font-medium flex-1 truncate">{{ item.name }}</span>
            <!-- Unread badge for Conversas -->
            <span
              v-if="item.path === '/conversations' && inboxBadge > 0"
              class="min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white tabular-nums"
              :class="leadBadge > 0 ? 'bg-amber-500' : 'bg-blue-600'"
            >
              {{ inboxBadge > 99 ? '99+' : inboxBadge }}
            </span>
          </NuxtLink>
        </div>
      </template>
    </nav>

    <div class="px-5 py-4 border-t border-zinc-800">
      <p class="text-xs text-zinc-600">OmniFlow v1.0</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import {
  LayoutDashboard, MessageSquare, MessageCircle, Network,
  Users, Workflow, BarChart2, Settings, ClipboardList,
  Megaphone, Zap, BookUser, MessageCircleDashed, LayoutList,
} from "lucide-vue-next"
import { useApi } from "../composables/useApi"

const route = useRoute()
const api = useApi()

type NavItem =
  | { type: "section"; name: string }
  | { type?: undefined; name: string; path: string; icon: any }

const menu: NavItem[] = [
  { name: "Dashboard",            path: "/dashboard",       icon: LayoutDashboard },
  { name: "Conversas",            path: "/conversations",   icon: MessageSquare },
  { type: "section", name: "Gestão" },
  { name: "Contatos",             path: "/contacts",        icon: BookUser },
  { name: "Canais",               path: "/whatsapp",        icon: MessageCircle },
  { name: "Departamentos",        path: "/departments",     icon: Network },
  { name: "Atendentes",           path: "/users",           icon: Users },
  { name: "Fluxo de atendimento", path: "/workflows",       icon: Workflow },
  { type: "section", name: "Marketing & Automação" },
  { name: "Campanhas",            path: "/campaigns",       icon: Megaphone },
  { name: "Templates",            path: "/templates",       icon: LayoutList },
  { name: "Automações",           path: "/automations",     icon: Zap },
  { type: "section", name: "Dados" },
  { name: "Relatórios",           path: "/reports",         icon: BarChart2 },
  { name: "Log de atividade",     path: "/logs",            icon: ClipboardList },
  { type: "section", name: "Sistema" },
  { name: "Respostas Rápidas",    path: "/saved-replies",   icon: MessageCircleDashed },
  { name: "Configurações",        path: "/settings",        icon: Settings },
]

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + "/")
}

// ── Inbox badge ───────────────────────────────────────────────────────────────

const inboxBadge = ref(0)
const leadBadge  = ref(0)

async function fetchInboxCount() {
  try {
    const [leads, open] = await Promise.allSettled([
      api<any>("/conversations?status=LEAD&limit=100"),
      api<any>("/conversations?status=OPEN&limit=100"),
    ])
    const leadItems: any[] = leads.status === "fulfilled" ? (leads.value?.items ?? leads.value ?? []) : []
    const openItems: any[] = open.status === "fulfilled"  ? (open.value?.items  ?? open.value  ?? []) : []
    leadBadge.value  = leadItems.length
    inboxBadge.value = leadItems.length + openItems.length
  } catch {}
}

let badgeInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  fetchInboxCount()
  badgeInterval = setInterval(fetchInboxCount, 30_000)
})

onUnmounted(() => {
  if (badgeInterval) clearInterval(badgeInterval)
})
</script>
