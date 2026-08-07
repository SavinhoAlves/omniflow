<template>
  <aside class="w-72 min-h-screen bg-zinc-900 border-r border-zinc-800 p-6 flex flex-col">
    <div class="mb-10">
      <h1 class="text-2xl font-bold text-white">
        Omni<span class="text-blue-500">Flow</span>
      </h1>

      <p class="text-xs text-zinc-500 mt-1">
        Central de atendimento
      </p>
    </div>

    <nav class="space-y-6 flex-1">
      <div class="space-y-1">
        <NuxtLink
          v-for="item in operationMenu"
          :key="item.name"
          :to="item.path"
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          active-class="!bg-blue-600/10 !text-blue-400"
        >
          <component :is="item.icon" :size="19" />
          <span class="text-sm font-medium">{{ item.name }}</span>
        </NuxtLink>
      </div>

      <!-- Área de plataforma — visível só pra Super Admin no futuro
           (o backend já tem o conceito de PlatformUser; a UI ainda
           não distingue papéis, então por ora fica visível pra
           qualquer usuário logado). Separada visualmente porque
           não é uma operação do dia a dia de um atendente/gestor. -->
      <div>
        <p class="px-4 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
          Plataforma
        </p>

        <div class="space-y-1">
          <NuxtLink
            v-for="item in platformMenu"
            :key="item.name"
            :to="item.path"
            class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            active-class="!bg-blue-600/10 !text-blue-400"
          >
            <component :is="item.icon" :size="19" />
            <span class="text-sm font-medium">{{ item.name }}</span>
          </NuxtLink>
        </div>
      </div>
    </nav>

    <div class="border-t border-zinc-800 pt-4 text-xs text-zinc-600">
      OmniFlow v1.0
    </div>
  </aside>
</template>

<script setup lang="ts">
import {
  LayoutDashboard,
  MessageCircle,
  Network,
  Users,
  Workflow,
  Building2,
  Settings,
} from "lucide-vue-next"

// Operação do dia a dia da empresa logada (tenant).
const operationMenu = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Canais", path: "/whatsapp", icon: MessageCircle },
  { name: "Departamentos", path: "/departments", icon: Network },
  { name: "Atendentes", path: "/users", icon: Users },
  { name: "Fluxos de atendimento", path: "/workflows", icon: Workflow },
  { name: "Configurações", path: "/settings", icon: Settings },
]

// Administração do SaaS em si (todas as empresas clientes).
const platformMenu = [
  { name: "Empresas", path: "/companies", icon: Building2 },
]
</script>
