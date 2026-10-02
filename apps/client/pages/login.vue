<template>
  <div class="flex min-h-screen w-full bg-zinc-950 font-['Geist',system-ui,sans-serif] text-sm text-zinc-50">
    <!-- ============================================================
         Painel de marca — some abaixo de lg: no celular quem abre o
         login já conhece o produto e quer entrar rápido. Fica fixo e
         na altura da tela para nunca empurrar o título para baixo da
         dobra em notebooks de 768 px.
    ============================================================ -->
    <section
      aria-label="Sobre o OmniFlow"
      class="brand-grid hidden flex-col justify-between gap-8 border-r border-zinc-900 bg-surface-brand px-12 py-12 lg:sticky lg:top-0 lg:flex lg:h-screen lg:basis-[52%] xl:px-14"
    >
      <div class="flex items-center gap-2.5">
        <div class="flex h-8 w-8 items-center justify-center rounded-[9px] bg-blue-600 font-bold text-white">O</div>
        <span class="text-lg font-semibold tracking-tight">Omni<span class="text-blue-400">Flow</span></span>
      </div>

      <!-- Miniatura do produto: uma conversa que vira negócio no funil.
           Conteúdo fixo e fictício — não vem da API. -->
      <div class="flex w-full max-w-[440px] flex-col gap-3.5 self-center">
        <div class="rounded-2xl border border-zinc-800 bg-surface-card p-4">
          <div class="mb-3 flex items-center gap-2 text-xs text-zinc-400">
            <span class="h-2 w-2 rounded-full bg-green-500" />
            WhatsApp · Juliana Souza
            <span class="ml-auto text-ink-muted">agora</span>
          </div>
          <div class="flex flex-col gap-2 text-[13px] leading-relaxed">
            <p class="max-w-[82%] self-start rounded-xl rounded-bl-[4px] bg-zinc-900 px-3 py-2">
              Oi! Quanto fica um sistema solar para a minha padaria?
            </p>
            <p class="max-w-[82%] self-end rounded-xl rounded-br-[4px] bg-blue-900 px-3 py-2">
              Te envio a proposta ainda hoje, Juliana.
            </p>
          </div>
        </div>

        <div aria-hidden="true" class="flex items-center gap-2.5 pl-6 text-xs text-ink-muted">
          <svg width="16" height="28" viewBox="0 0 16 28" fill="none" stroke="#3b82f6" stroke-width="1.6" stroke-linecap="round"><path d="M8 2v22M3 19l5 5 5-5" /></svg>
          vira um negócio no funil
        </div>

        <div class="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-surface-card p-4">
          <div class="flex items-start gap-3">
            <div class="flex-1">
              <p class="text-sm font-semibold">Padaria Bom Grão — Sistema 12 kWp</p>
              <p class="mt-0.5 text-xs text-zinc-400">Juliana Souza · responsável Rafael</p>
            </div>
            <span class="text-[15px] font-semibold tabular-nums">R$ 64.500</span>
          </div>
          <div class="flex items-center gap-2 text-xs">
            <span class="flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-0.5 text-zinc-200">
              <span class="h-[7px] w-[7px] rounded-full bg-violet-400" />Proposta enviada
            </span>
            <span class="text-ink-muted">Follow-up amanhã, 9h</span>
          </div>
        </div>
      </div>

      <div class="flex max-w-[460px] flex-col gap-4">
        <h2 class="text-3xl font-semibold leading-tight tracking-tight">Atendimento e vendas no mesmo lugar.</h2>
        <p class="text-[15px] leading-relaxed text-zinc-400">
          Cada conversa do WhatsApp, Instagram ou Messenger pode virar um negócio, com etapa, valor e próxima tarefa.
        </p>
        <ul aria-label="Canais suportados" class="flex flex-wrap gap-2">
          <li v-for="c in CHANNELS" :key="c" class="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300">{{ c }}</li>
        </ul>
      </div>
    </section>

    <!-- ============================================================
         Formulário
    ============================================================ -->
    <main class="flex flex-1 items-start justify-center px-6 pb-6 pt-8 lg:items-center lg:py-12">
      <!-- No mobile ocupa a altura útil (100dvh menos o padding de 3.5rem) para o rodapé encostar embaixo -->
      <div class="flex min-h-[calc(100dvh-3.5rem)] w-full max-w-[400px] flex-col gap-6 lg:min-h-0 lg:gap-7">
        <!-- Logo + frase: só quando o painel de marca está escondido -->
        <div class="flex flex-col items-center gap-2 lg:hidden">
          <div class="flex items-center gap-2.5">
            <div class="flex h-8 w-8 items-center justify-center rounded-[9px] bg-blue-600 font-bold text-white">O</div>
            <span class="text-lg font-semibold tracking-tight">Omni<span class="text-blue-400">Flow</span></span>
          </div>
          <p class="text-xs text-ink-muted">Atendimento e vendas no mesmo lugar</p>
        </div>

        <div>
          <h1 class="text-2xl font-semibold tracking-tight lg:text-[26px]">Entrar no OmniFlow</h1>
          <p class="mt-1.5 text-sm leading-relaxed text-zinc-400">Use o acesso que o administrador da sua empresa criou para você.</p>
        </div>

        <!-- Avisos: sessão expirada (status) e erros do servidor (alert) -->
        <Transition name="banner">
          <div
            v-if="showExpired"
            role="status"
            class="flex gap-2.5 rounded-xl border border-amber-900 bg-amber-950/60 px-3.5 py-3 text-[13px] leading-snug text-amber-300"
          >
            <Clock class="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Sua sessão expirou. Entre de novo para continuar de onde parou.</span>
          </div>
        </Transition>
        <Transition name="banner">
          <div
            v-if="serverError"
            role="alert"
            class="flex gap-2.5 rounded-xl border border-red-900 bg-red-950/60 px-3.5 py-3 text-[13px] leading-snug text-red-300"
          >
            <CircleAlert class="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{{ serverError }}</span>
          </div>
        </Transition>

        <form class="flex flex-col gap-[18px]" novalidate @submit.prevent="submit">
          <AuthField
            id="company"
            ref="companyField"
            v-model="company"
            label="Empresa"
            autocomplete="organization"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            maxlength="64"
            placeholder="sua-empresa"
            :disabled="busy"
            :error="companyError"
            hint="O identificador da sua empresa, por exemplo empresa-demo."
            @input="onEdit"
            @blur="onBlurCompany"
          />

          <AuthField
            id="email"
            ref="emailField"
            v-model="email"
            label="E-mail"
            type="email"
            inputmode="email"
            autocomplete="username"
            maxlength="254"
            placeholder="voce@empresa.com"
            :disabled="busy"
            :error="emailError"
            :invalid="credentialsRejected"
            @input="onEdit"
            @blur="touched.email = true"
          />

          <AuthField
            id="password"
            ref="passwordField"
            v-model="password"
            label="Senha"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            maxlength="128"
            placeholder="Sua senha"
            :disabled="busy"
            :error="passwordError"
            :invalid="credentialsRejected"
            :warning="capsLock ? 'Caps Lock está ativado.' : ''"
            @input="onEdit"
            @keydown="detectCaps"
            @keyup="detectCaps"
            @blur="touched.password = true; capsLock = false"
          >
            <template #trailing>
              <button
                type="button"
                :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
                :aria-pressed="showPassword"
                class="flex h-11 w-11 items-center justify-center rounded-[10px] text-zinc-400 transition-colors duration-150 hover:text-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 lg:h-[38px] lg:w-[38px] lg:rounded-[9px]"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" class="h-[18px] w-[18px]" aria-hidden="true" />
                <Eye v-else class="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </template>
          </AuthField>

          <label class="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm text-zinc-300 lg:min-h-8 lg:text-[13px]">
            <input
              v-model="remember"
              type="checkbox"
              :disabled="busy"
              class="h-5 w-5 accent-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 lg:h-[18px] lg:w-[18px]"
            >
            Lembrar a empresa neste dispositivo
          </label>

          <button
            type="submit"
            :disabled="busy"
            :aria-busy="phase === 'loading'"
            class="flex h-[52px] items-center justify-center gap-2.5 rounded-xl text-base font-semibold text-white transition-[background-color,transform] duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 enabled:hover:bg-blue-700 enabled:active:scale-[0.99] motion-reduce:transition-none lg:h-12 lg:text-[15px]"
            :class="buttonClass"
          >
            <Loader2 v-if="phase === 'loading'" class="h-[18px] w-[18px] animate-spin motion-reduce:animate-[spin_2.4s_linear_infinite]" aria-hidden="true" />
            <Check v-else-if="phase === 'success'" class="h-[18px] w-[18px]" aria-hidden="true" />
            {{ buttonLabel }}
          </button>

          <!-- Anúncio ao fim do bloqueio por excesso de tentativas -->
          <p class="sr-only" aria-live="polite">{{ announcement }}</p>
        </form>

        <div class="mt-auto flex flex-col gap-3.5 border-t border-zinc-900 pt-5 text-[13px] leading-relaxed text-zinc-400 lg:mt-0">
          <p>Esqueceu a senha ou não sabe o identificador da empresa? Peça ao administrador do OmniFlow na sua empresa.</p>
          <div class="flex justify-between text-xs text-ink-muted">
            <span>OmniFlow © {{ year }}</span>
            <a href="#" class="text-blue-300 hover:text-blue-200 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">Privacidade e LGPD</a>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { Check, CircleAlert, Clock, Eye, EyeOff, Loader2 } from "lucide-vue-next"

definePageMeta({ layout: "auth" })

// Geist só nesta tela (o resto do app segue a fonte do sistema)
useHead({
  title: "Entrar",
  link: [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
    { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" },
  ],
})

const CHANNELS = ["WhatsApp", "Instagram", "Messenger"]
const REMEMBER_KEY = "omniflow:last-company"
const REQUEST_TIMEOUT_MS = 15_000
const SUCCESS_DELAY_MS = 600

const MSG = {
  credentials: "Empresa, e-mail ou senha incorretos. Confira os dados e tente de novo.",
  rateLimit: "Muitas tentativas de login. Aguarde 1 minuto e tente de novo.",
  server: "O OmniFlow está com instabilidade. Tente de novo em alguns minutos.",
  network: "Não foi possível conectar. Verifique sua internet e tente de novo.",
}

const config = useRuntimeConfig()
const route = useRoute()
const year = new Date().getFullYear()

type Phase = "idle" | "loading" | "success" | "blocked"

const company = ref("")
const email = ref("")
const password = ref("")
const showPassword = ref(false)
const remember = ref(true)
const capsLock = ref(false)
const phase = ref<Phase>("idle")
const serverError = ref("")
const credentialsRejected = ref(false)
const submitted = ref(false)
const touched = reactive({ company: false, email: false, password: false })
const expiredDismissed = ref(false)
const retryIn = ref(0)
const announcement = ref("")

const companyField = ref<{ focus: () => void } | null>(null)
const emailField = ref<{ focus: () => void } | null>(null)
const passwordField = ref<{ focus: () => void } | null>(null)

let retryTimer: ReturnType<typeof setInterval> | null = null
let redirectTimer: ReturnType<typeof setTimeout> | null = null

// ── Validação ────────────────────────────────────────────────────────────────
// Erros só aparecem depois de sair do campo ou tentar enviar.

const slugValid = computed(() => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(company.value))
const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))

const companyError = computed(() => {
  if (!(touched.company || submitted.value)) return ""
  if (!company.value) return "Informe o identificador da sua empresa."
  if (!slugValid.value) return "Use só letras minúsculas, números e hífen."
  return ""
})
const emailError = computed(() =>
  (touched.email || submitted.value) && !emailValid.value ? "Digite um e-mail válido, como voce@empresa.com." : ""
)
const passwordError = computed(() =>
  (touched.password || submitted.value) && !password.value ? "Digite sua senha." : ""
)

const busy = computed(() => phase.value !== "idle")
const showExpired = computed(() => route.query.expired === "1" && !expiredDismissed.value && phase.value !== "success")

const buttonLabel = computed(() => {
  if (phase.value === "loading") return "Entrando…"
  if (phase.value === "success") return "Abrindo o painel…"
  if (phase.value === "blocked") {
    const m = Math.floor(retryIn.value / 60)
    const s = String(retryIn.value % 60).padStart(2, "0")
    return `Aguarde ${m}:${s}`
  }
  return "Entrar"
})

const buttonClass = computed(() => {
  if (phase.value === "success") return "bg-emerald-700"
  if (phase.value === "blocked") return "bg-zinc-800 text-zinc-400"
  if (phase.value === "loading") return "bg-blue-700"
  return "bg-blue-600"
})

// Só caminhos internos: evita usar o login como redirecionador aberto
const redirectTarget = computed(() => {
  const r = route.query.redirect
  return typeof r === "string" && r.startsWith("/") && !r.startsWith("//") && !r.startsWith("/login")
    ? r
    : "/dashboard"
})

// ── Interações ───────────────────────────────────────────────────────────────

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function onBlurCompany() {
  company.value = slugify(company.value)
  touched.company = true
}

/** Qualquer edição tira o aviso de credenciais (o bloqueio por 429 segue até zerar) */
function onEdit() {
  if (phase.value !== "blocked") serverError.value = ""
  credentialsRejected.value = false
}

function detectCaps(e: KeyboardEvent) {
  if (typeof e.getModifierState === "function") capsLock.value = e.getModifierState("CapsLock")
}

function rememberCompany() {
  try {
    if (remember.value) localStorage.setItem(REMEMBER_KEY, company.value)
    else localStorage.removeItem(REMEMBER_KEY)
  } catch {
    // aba anônima ou armazenamento bloqueado: só não lembra
  }
}

function startCooldown(seconds: number) {
  phase.value = "blocked"
  retryIn.value = seconds
  announcement.value = ""
  if (retryTimer) clearInterval(retryTimer)
  retryTimer = setInterval(() => {
    retryIn.value -= 1
    if (retryIn.value <= 0) {
      clearInterval(retryTimer!)
      retryTimer = null
      phase.value = "idle"
      serverError.value = ""
      announcement.value = "Você já pode tentar de novo."
    }
  }, 1000)
}

async function submit() {
  if (busy.value) return
  submitted.value = true
  expiredDismissed.value = true
  serverError.value = ""
  credentialsRejected.value = false
  company.value = slugify(company.value)

  // Foco no primeiro campo inválido
  if (companyError.value) return companyField.value?.focus()
  if (emailError.value) return emailField.value?.focus()
  if (passwordError.value) return passwordField.value?.focus()

  phase.value = "loading"
  try {
    const response = await $fetch<{ accessToken: string }>(`${config.public.apiUrl}/auth/login`, {
      method: "POST",
      credentials: "include",
      timeout: REQUEST_TIMEOUT_MS,
      body: {
        companySlug: company.value,
        email: email.value.trim().toLowerCase(),
        password: password.value, // nunca trim: espaços fazem parte da senha
      },
    })

    useCookie("access_token", { sameSite: "lax", httpOnly: false }).value = response.accessToken
    rememberCompany()
    phase.value = "success"
    redirectTimer = setTimeout(() => navigateTo(redirectTarget.value), SUCCESS_DELAY_MS)
  } catch (err: any) {
    // Decide pelo status HTTP, não pelo formato do corpo: no 429 o `error`
    // da API é um objeto, e a tela antiga mostrava "[object Object]".
    const status: number | undefined = err?.response?.status ?? err?.statusCode
    phase.value = "idle"

    if (status === 429) {
      const retryAfter = Number(err?.response?.headers?.get?.("retry-after"))
      serverError.value = MSG.rateLimit
      startCooldown(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 60)
    } else if (status === 400 || status === 401) {
      // Texto fixo: não revela se a empresa ou o e-mail existem
      serverError.value = MSG.credentials
      credentialsRejected.value = true
      password.value = ""
      submitted.value = false
      touched.password = false
      await nextTick()
      passwordField.value?.focus()
    } else if (status && status >= 500) {
      serverError.value = MSG.server
    } else {
      serverError.value = MSG.network // timeout (15 s) ou sem conexão
    }
  }
}

// ── Ciclo de vida ────────────────────────────────────────────────────────────

onMounted(() => {
  // Já autenticado: não faz sentido mostrar o formulário
  if (useCookie("access_token").value) {
    navigateTo(redirectTarget.value, { replace: true })
    return
  }

  try {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) company.value = saved
  } catch {
    // armazenamento indisponível
  }

  nextTick(() => (company.value ? emailField.value?.focus() : companyField.value?.focus()))
})

onBeforeUnmount(() => {
  if (retryTimer) clearInterval(retryTimer)
  if (redirectTimer) clearTimeout(redirectTimer)
})
</script>

<style scoped>
/* Grade de pontos do painel de marca: 1 px a cada 24 px */
.brand-grid {
  background-image: radial-gradient(#1f1f23 1px, transparent 1px);
  background-size: 24px 24px;
}

.banner-enter-active {
  transition: opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.banner-leave-active {
  transition: opacity 150ms ease-in;
}
.banner-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.banner-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .banner-enter-active,
  .banner-leave-active {
    transition: none;
  }
}
</style>
