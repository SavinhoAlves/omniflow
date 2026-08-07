<template>
  <div class="min-h-screen w-full flex items-center justify-center bg-zinc-950 px-6 relative overflow-hidden">
    <!-- Background glow -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div class="absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-amber-500/5 blur-3xl" />
    </div>

    <div class="relative w-full max-w-sm">
      <!-- Logo / branding -->
      <div class="mb-8 flex flex-col items-center text-center">
        <div class="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center text-xl font-bold text-white shadow-xl shadow-amber-500/20 mb-4">
          O
        </div>
        <h1 class="text-xl font-semibold text-white">
          Omni<span class="text-amber-400">Flow</span>
        </h1>
        <div class="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
          <ShieldCheck :size="11" />
          Acesso restrito — equipe interna
        </div>
      </div>

      <!-- Form card -->
      <div class="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm p-8">
        <form class="space-y-4" novalidate @submit.prevent="login">
          <div>
            <label for="email" class="block text-sm font-medium text-zinc-400 mb-1.5">Email</label>
            <input
              id="email"
              ref="emailInput"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="voce@omniflow.com"
              class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-zinc-400 mb-1.5">Senha</label>
            <div class="relative">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="••••••••"
                class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 pr-11 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
              />
              <button
                type="button"
                class="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                @click="showPassword = !showPassword"
              >
                <Eye v-if="!showPassword" :size="16" />
                <EyeOff v-else :size="16" />
              </button>
            </div>
          </div>

          <div
            v-if="error"
            role="alert"
            class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="loading || !canSubmit"
            class="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LoaderCircle v-if="loading" :size="16" class="animate-spin" />
            {{ loading ? "Verificando…" : "Entrar" }}
          </button>
        </form>
      </div>

      <p class="mt-6 text-center text-xs text-zinc-600">
        Procurando o painel do seu estabelecimento?<br />
        <span class="text-zinc-500">Fale com o time comercial.</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import { LoaderCircle, ShieldCheck, Eye, EyeOff } from "lucide-vue-next"

definePageMeta({ layout: "auth" })

const config = useRuntimeConfig()

const emailInput = ref<HTMLInputElement | null>(null)
const email = ref("")
const password = ref("")
const showPassword = ref(false)
const loading = ref(false)
const error = ref("")

const canSubmit = computed(() => {
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)
  return emailLooksValid && password.value.length > 0
})

onMounted(() => emailInput.value?.focus())

async function login() {
  if (loading.value || !canSubmit.value) return

  try {
    loading.value = true
    error.value = ""

    const response: any = await $fetch(`${config.public.apiUrl}/platform-auth/login`, {
      method: "POST",
      credentials: "include",
      body: { email: email.value.trim().toLowerCase(), password: password.value },
    })

    useCookie("platform_access_token", { sameSite: "lax", httpOnly: false }).value = response.accessToken

    await navigateTo("/dashboard")
  } catch (err: any) {
    error.value = err?.data?.error ?? "Falha ao entrar. Verifique suas credenciais."
  } finally {
    loading.value = false
  }
}
</script>
