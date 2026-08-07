<template>
  <div class="min-h-screen w-full flex bg-neutral-950">
    <!-- ============================================================
         Painel esquerdo — contexto de marca. Some abaixo de lg:
         em telas pequenas o produto ainda não é o foco (o form é),
         então não vale a pena espremer essa peça.
    ============================================================ -->
    <div
      class="hidden lg:flex lg:w-[58%] relative overflow-hidden flex-col justify-between p-14 xl:p-20"
    >
      <!-- Gradiente de fundo -->
      <div class="absolute inset-0 bg-gradient-to-br from-neutral-950 via-[#0a1730] to-neutral-950" />
      <div class="absolute -top-32 -left-24 w-[600px] h-[600px] bg-blue-600/20 blur-[160px] rounded-full" />
      <div class="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 blur-[150px] rounded-full" />

      <!-- Wordmark -->
      <div class="relative flex items-center gap-2.5">
        <div class="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-sm font-bold text-white">
          O
        </div>
        <span class="text-lg font-semibold text-white tracking-tight">
          Omni<span class="text-blue-400">Flow</span>
        </span>
      </div>

      <!-- Peça visual autoral: canais convergindo pra uma caixa única -->
      <div class="relative flex-1 flex items-center justify-center py-10">
        <svg
          viewBox="0 0 480 480"
          class="w-full max-w-md"
          role="img"
          aria-label="Ilustração de várias conversas convergindo para uma caixa de entrada única"
        >
          <defs>
            <linearGradient id="flowLine" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#60a5fa" />
              <stop offset="100%" stop-color="#22d3ee" />
            </linearGradient>
            <linearGradient id="inboxFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#3b82f6" />
              <stop offset="100%" stop-color="#22d3ee" />
            </linearGradient>
          </defs>

          <!-- Linhas de fluxo dos canais até a caixa central -->
          <g fill="none" stroke="url(#flowLine)" stroke-width="1.5" stroke-linecap="round" opacity="0.55">
            <path class="flow-path" d="M 84 92 Q 160 130 240 240" style="animation-delay:0s" />
            <path class="flow-path" d="M 396 92 Q 320 130 240 240" style="animation-delay:.4s" />
            <path class="flow-path" d="M 84 388 Q 160 350 240 240" style="animation-delay:.8s" />
            <path class="flow-path" d="M 396 388 Q 320 350 240 240" style="animation-delay:1.2s" />
          </g>

          <!-- Nó: mensagem de texto -->
          <g transform="translate(84 92)">
            <circle r="36" fill="#0f1b2e" stroke="#1e3a5f" stroke-width="1" />
            <path d="M-13,-9 h26 a4,4 0 0 1 4,4 v11 a4,4 0 0 1 -4,4 h-15 l-7,6 v-6 h-4 a4,4 0 0 1 -4,-4 v-11 a4,4 0 0 1 4,-4 z"
                  fill="none" stroke="#7dd3fc" stroke-width="1.6" stroke-linejoin="round" />
          </g>

          <!-- Nó: e-mail -->
          <g transform="translate(396 92)">
            <circle r="36" fill="#0f1b2e" stroke="#1e3a5f" stroke-width="1" />
            <path d="M-14,-9 h28 a2,2 0 0 1 2,2 v14 a2,2 0 0 1 -2,2 h-28 a2,2 0 0 1 -2,-2 v-14 a2,2 0 0 1 2,-2 z M-14,-8 L0,3 14,-8"
                  fill="none" stroke="#7dd3fc" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
          </g>

          <!-- Nó: chamada -->
          <g transform="translate(84 388)">
            <circle r="36" fill="#0f1b2e" stroke="#1e3a5f" stroke-width="1" />
            <path d="M-11,-14 c-4,3 -5,7 -3,11 c3,6 9,12 15,15 c4,2 8,1 11,-3 l3,-4 c1,-2 1,-4 -1,-5 l-6,-4 c-2,-1 -3,-1 -5,1 l-2,2 c-3,-2 -6,-5 -8,-8 l2,-2 c2,-2 2,-3 1,-5 l-4,-6 c-1,-2 -3,-2 -5,-1 z"
                  fill="none" stroke="#7dd3fc" stroke-width="1.5" stroke-linejoin="round" />
          </g>

          <!-- Nó: câmera / mídia -->
          <g transform="translate(396 388)">
            <circle r="36" fill="#0f1b2e" stroke="#1e3a5f" stroke-width="1" />
            <path d="M-14,-6 h6 l2,-3 h12 l2,3 h6 a2,2 0 0 1 2,2 v14 a2,2 0 0 1 -2,2 h-28 a2,2 0 0 1 -2,-2 v-14 a2,2 0 0 1 2,-2 z"
                  fill="none" stroke="#7dd3fc" stroke-width="1.6" stroke-linejoin="round" />
            <circle cx="0" cy="4" r="5.5" fill="none" stroke="#7dd3fc" stroke-width="1.6" />
          </g>

          <!-- Caixa central (destino) -->
          <g transform="translate(240 240)">
            <circle class="pulse-ring" r="40" fill="none" stroke="#22d3ee" stroke-width="1" />
            <rect x="-34" y="-34" width="68" height="68" rx="18" fill="url(#inboxFill)" />
            <path d="M-16,-6 h32 v18 a4,4 0 0 1 -4,4 h-24 a4,4 0 0 1 -4,-4 z M-16,-6 l6,10 h20 l6,-10"
                  fill="none" stroke="white" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" />
          </g>
        </svg>
      </div>

      <!-- Copy + destaques -->
      <div class="relative space-y-6">
        <div class="space-y-3 max-w-sm">
          <h2 class="text-2xl xl:text-[1.75rem] font-semibold tracking-tight text-white leading-snug">
            Todos os canais do seu cliente, numa única conversa.
          </h2>
          <p class="text-sm text-zinc-400 leading-relaxed">
            WhatsApp, e-mail e mais chegam no mesmo painel — sua equipe atende sem trocar de tela.
          </p>
        </div>

        <ul class="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-500">
          <li class="flex items-center gap-1.5">
            <Check class="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
            Múltiplos atendentes por número
          </li>
          <li class="flex items-center gap-1.5">
            <Check class="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
            Departamentos e transferência
          </li>
          <li class="flex items-center gap-1.5">
            <Check class="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
            Histórico unificado do cliente
          </li>
        </ul>
      </div>
    </div>

    <!-- ============================================================
         Painel direito — formulário. É o painel inteiro que rola,
         não um cartão flutuando: em telas grandes ocupa 42%, em
         telas pequenas ocupa 100% (fallback simples, não é o alvo
         principal do design por enquanto).
    ============================================================ -->
    <div class="w-full lg:w-[42%] flex items-center justify-center px-6 py-12 sm:px-12 bg-[radial-gradient(circle,#ffffff06_1px,transparent_1px)] [background-size:28px_28px]">
      <div class="w-full max-w-sm">
        <!-- Wordmark (visível só quando o painel de marca está escondido) -->
        <div class="flex lg:hidden items-center gap-2.5 mb-10 justify-center">
          <div class="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-sm font-bold text-white">
            O
          </div>
          <span class="text-lg font-semibold text-white tracking-tight">
            Omni<span class="text-blue-400">Flow</span>
          </span>
        </div>

        <h1 class="text-2xl font-semibold tracking-tight text-white">
          Entrar
        </h1>
        <p class="text-sm text-zinc-500 mt-1.5 mb-9">
          Acesse o painel de atendimento da sua empresa.
        </p>

        <form class="space-y-5" novalidate @submit.prevent="login">
          <!-- Empresa -->
          <div>
            <label for="companySlug" class="text-sm text-zinc-400">
              Empresa
            </label>

            <div class="relative mt-2">
              <Building2
                class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
                aria-hidden="true"
              />

              <input
                id="companySlug"
                ref="companySlugInput"
                v-model="companySlug"
                name="companySlug"
                type="text"
                autocomplete="organization"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                placeholder="omniflow"
                class="w-full rounded-xl border border-zinc-700 bg-neutral-900/80 pl-11 pr-4 py-3 text-white outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                @blur="companySlug = slugify(companySlug)"
              />
            </div>

            <p class="mt-1.5 text-xs text-zinc-500">
              Identificador sem espaços — ex: <span class="text-zinc-400">empresa-demo</span>
            </p>
          </div>

          <!-- Email -->
          <div>
            <label for="email" class="text-sm text-zinc-400">
              Email
            </label>

            <div class="relative mt-2">
              <Mail
                class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
                aria-hidden="true"
              />

              <input
                id="email"
                v-model="email"
                name="email"
                type="email"
                autocomplete="email"
                placeholder="admin@empresa.com"
                class="w-full rounded-xl border border-zinc-700 bg-neutral-900/80 pl-11 pr-4 py-3 text-white outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
          </div>

          <!-- Senha -->
          <div>
            <label for="password" class="text-sm text-zinc-400">
              Senha
            </label>

            <div class="relative mt-2">
              <Lock
                class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
                aria-hidden="true"
              />

              <input
                id="password"
                v-model="password"
                name="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="••••••••"
                class="w-full rounded-xl border border-zinc-700 bg-neutral-900/80 pl-11 pr-11 py-3 text-white outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
              />

              <button
                type="button"
                :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
                class="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 transition hover:text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" class="h-4 w-4" aria-hidden="true" />
                <Eye v-else class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <!-- Error -->
          <Transition name="fade">
            <div
              v-if="error"
              role="alert"
              aria-live="polite"
              class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {{ error }}
            </div>
          </Transition>

          <!-- Button -->
          <button
            type="submit"
            :disabled="loading || !canSubmit"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 font-semibold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
          >
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
            {{ loading ? "Entrando..." : "Entrar" }}
          </button>
        </form>

        <div class="mt-10 border-t border-zinc-900 pt-6 text-center text-xs text-zinc-700">
          OmniFlow © {{ new Date().getFullYear() }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Building2, Mail, Lock, Eye, EyeOff, Loader2, Check } from "lucide-vue-next"

definePageMeta({
  layout: "auth",
})

const config = useRuntimeConfig()

const companySlugInput = ref<HTMLInputElement | null>(null)
const companySlug = ref("")
const email = ref("")
const password = ref("")
const showPassword = ref(false)

const loading = ref(false)
const error = ref("")

// Validação leve no cliente — evita uma ida ao servidor pra dizer o
// óbvio (campo vazio, email mal formado), mas não substitui a
// validação real que já acontece na API.
const canSubmit = computed(() => {
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)
  return companySlug.value.trim().length > 0 && emailLooksValid && password.value.length > 0
})

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

onMounted(() => {
  companySlugInput.value?.focus()
})

async function login() {
  if (loading.value) return // evita duplo envio (ex: Enter + clique quase simultâneos)

  if (!canSubmit.value) {
    error.value = "Preencha empresa, email e senha corretamente."
    return
  }

  try {
    loading.value = true
    error.value = ""

    const response: any = await $fetch(
      `${config.public.apiUrl}/auth/login`,
      {
        method: "POST",
        credentials: "include",
        body: {
          companySlug: slugify(companySlug.value),
          email: email.value.trim().toLowerCase(),
          password: password.value,
        },
      }
    )

    const cookie = useCookie("access_token", {
      sameSite: "lax",
      httpOnly: false,
    })

    cookie.value = response.accessToken

    await navigateTo("/dashboard")
  } catch (err: any) {
    error.value =
      err?.data?.error ??
      err?.data?.message ??
      "Falha ao realizar login. Verifique suas credenciais."
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.25s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.flow-path {
  stroke-dasharray: 5 9;
  animation: dash-flow 2.4s linear infinite;
}

@keyframes dash-flow {
  to {
    stroke-dashoffset: -140;
  }
}

.pulse-ring {
  transform-origin: center;
  animation: pulse-ring 2.6s ease-out infinite;
}

@keyframes pulse-ring {
  0% {
    opacity: 0.6;
    transform: scale(0.85);
  }
  100% {
    opacity: 0;
    transform: scale(1.35);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fade-enter-active,
  .fade-leave-active,
  .flow-path,
  .pulse-ring {
    animation: none;
    transition: none;
  }
}
</style>
