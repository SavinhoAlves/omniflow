<template>
  <header class="h-16 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-6 shrink-0">
    <div>
      <h2 class="font-semibold text-white leading-tight">{{ pageInfo.title }}</h2>
      <p class="text-xs text-zinc-500">{{ pageInfo.subtitle }}</p>
    </div>

    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2.5">
        <div class="h-8 w-8 rounded-full bg-gradient-to-br from-amber-600/30 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-xs font-semibold text-amber-300 shrink-0">
          {{ initials }}
        </div>
        <div class="hidden sm:block text-right">
          <p class="text-sm font-medium text-white leading-tight">{{ userName }}</p>
          <p class="text-xs text-zinc-500 leading-tight">{{ roleLabel }}</p>
        </div>
      </div>

      <div class="h-5 w-px bg-zinc-800 mx-1" />

      <button
        class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
        @click="logout"
      >
        <LogOut :size="15" />
        <span class="hidden sm:inline">Sair</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { LogOut } from "lucide-vue-next"
import { useApi } from "../composables/useApi"

const api = useApi()
const route = useRoute()

const cookie = useCookie("platform_access_token")

const jwtPayload = computed(() => {
  if (!cookie.value) return null
  try {
    const base64 = cookie.value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
})

const userName = computed<string>(() => jwtPayload.value?.name ?? "Admin")

const roleLabel = computed<string>(() => {
  const map: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    SUPPORT: "Suporte",
  }
  return map[jwtPayload.value?.role ?? ""] ?? "Equipe OmniFlow"
})

const initials = computed<string>(() => {
  return userName.value
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "A"
})

const PAGE_MAP: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard",  subtitle: "Visão geral de todas as empresas" },
  "/companies": { title: "Empresas",   subtitle: "Gestão de empresas clientes" },
}

const pageInfo = computed(() => {
  for (const [prefix, info] of Object.entries(PAGE_MAP)) {
    if (route.path === prefix || route.path.startsWith(prefix + "/")) return info
  }
  return { title: "OmniFlow", subtitle: "Painel interno" }
})

async function logout() {
  try {
    await api("/platform-auth/logout", { method: "POST" })
  } catch {}
  finally {
    useCookie("platform_access_token").value = null
    await navigateTo("/login")
  }
}
</script>
