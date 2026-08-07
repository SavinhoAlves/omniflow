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

    <nav class="flex-1 p-3 space-y-0.5">
      <div v-for="item in menu" :key="item.name" class="relative">
        <span
          v-if="isActive(item.path)"
          class="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-blue-500"
        />
        <NuxtLink
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-400 text-sm transition-all hover:bg-zinc-800 hover:text-white"
          active-class="!bg-zinc-800 !text-white"
        >
          <component :is="item.icon" :size="18" />
          <span class="font-medium">{{ item.name }}</span>
        </NuxtLink>
      </div>
    </nav>

    <div class="px-5 py-4 border-t border-zinc-800">
      <p class="text-xs text-zinc-600">OmniFlow v1.0</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { LayoutDashboard, MessageSquare, MessageCircle, Network, Users, Workflow, Settings } from "lucide-vue-next"

const route = useRoute()

const menu = [
  { name: "Dashboard",             path: "/dashboard",      icon: LayoutDashboard },
  { name: "Conversas",             path: "/conversations",  icon: MessageSquare },
  { name: "Canais",                path: "/whatsapp",       icon: MessageCircle },
  { name: "Departamentos",         path: "/departments",    icon: Network },
  { name: "Atendentes",            path: "/users",          icon: Users },
  { name: "Fluxos de atendimento", path: "/workflows",      icon: Workflow },
  { name: "Configurações",         path: "/settings",       icon: Settings },
]

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>
