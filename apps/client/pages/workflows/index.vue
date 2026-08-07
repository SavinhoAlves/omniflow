<template>
  <div>
    <div class="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-white">Fluxo de atendimento</h1>
        <p class="text-zinc-400 mt-2">
          Defina como o bot recebe o cliente e direciona pro departamento certo.
        </p>
      </div>

      <label class="flex shrink-0 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5">
        <span class="text-sm text-zinc-400">{{ workflow.enabled ? "Bot ativo" : "Bot desativado" }}</span>
        <button
          type="button"
          role="switch"
          :aria-checked="workflow.enabled"
          class="relative h-6 w-11 rounded-full transition"
          :class="workflow.enabled ? 'bg-blue-600' : 'bg-zinc-700'"
          @click="workflow.enabled = !workflow.enabled"
        >
          <span
            class="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
            :class="workflow.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'"
          />
        </button>
      </label>
    </div>

    <div v-if="loading" class="h-80 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />

    <div v-else class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <!-- Configuração -->
      <div class="space-y-6">
        <!-- Boas-vindas -->
        <section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 class="font-semibold text-white">Mensagem de boas-vindas</h2>
          <p class="mt-1 text-sm text-zinc-500">
            A primeira coisa que o cliente vê quando manda uma mensagem.
          </p>

          <textarea
            v-model="workflow.welcomeMessage"
            rows="3"
            placeholder="Olá! 👋 Em que podemos ajudar hoje?"
            class="mt-4 w-full resize-none rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-3 text-white outline-none transition focus:border-blue-500"
          />
        </section>

        <!-- Regras de direcionamento -->
        <section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="font-semibold text-white">Regras de direcionamento</h2>
              <p class="mt-1 text-sm text-zinc-500">
                O cliente escolhe uma opção do menu e é encaminhado pro departamento.
              </p>
            </div>

            <button
              type="button"
              class="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700"
              @click="addRule"
            >
              <Plus :size="15" />
              Regra
            </button>
          </div>

          <div v-if="departments.length === 0" class="mt-4 rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
            Você ainda não criou departamentos —
            <NuxtLink to="/departments" class="text-blue-400 hover:underline">crie os departamentos primeiro</NuxtLink>
            pra montar as regras aqui.
          </div>

          <div v-else class="mt-4 space-y-3">
            <div
              v-for="(rule, index) in workflow.rules"
              :key="rule.key"
              class="flex flex-col gap-3 rounded-xl border border-zinc-800 p-3 sm:flex-row sm:items-center"
            >
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-sm font-medium text-zinc-400">
                {{ index + 1 }}
              </span>

              <input
                v-model="rule.optionLabel"
                type="text"
                placeholder="Rótulo do menu, ex: Suporte técnico"
                class="w-full flex-1 rounded-lg border border-zinc-700 bg-neutral-900/80 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />

              <ArrowRight :size="16" class="hidden shrink-0 text-zinc-600 sm:block" />

              <select
                v-model="rule.departmentId"
                class="w-full shrink-0 rounded-lg border border-zinc-700 bg-neutral-900/80 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 sm:w-48"
              >
                <option value="" disabled>Departamento…</option>
                <option v-for="dept in departments" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
              </select>

              <button
                type="button"
                class="shrink-0 rounded-lg p-2 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                aria-label="Remover regra"
                @click="removeRule(index)"
              >
                <Trash2 :size="16" />
              </button>
            </div>

            <p v-if="workflow.rules.length === 0" class="text-sm text-zinc-600">
              Nenhuma regra ainda — o bot manda tudo direto pro departamento padrão.
            </p>
          </div>
        </section>

        <!-- Fallback -->
        <section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 class="font-semibold text-white">Departamento padrão</h2>
          <p class="mt-1 text-sm text-zinc-500">
            Usado quando o cliente não escolhe nenhuma opção do menu.
          </p>

          <select
            v-model="workflow.fallbackDepartmentId"
            class="mt-4 w-full rounded-xl border border-zinc-700 bg-neutral-900/80 px-4 py-2.5 text-white outline-none transition focus:border-blue-500 sm:w-72"
          >
            <option value="" disabled>Selecione um departamento…</option>
            <option v-for="dept in departments" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
          </select>
        </section>

        <p v-if="saveError" class="text-sm text-red-400">{{ saveError }}</p>
        <p v-if="savedAt" class="text-sm text-green-400">Fluxo salvo com sucesso.</p>

        <button
          type="button"
          :disabled="saving"
          class="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          @click="saveWorkflow"
        >
          <LoaderCircle v-if="saving" :size="16" class="animate-spin" />
          Salvar fluxo
        </button>
      </div>

      <!-- Preview -->
      <aside class="xl:sticky xl:top-6 xl:self-start">
        <p class="mb-3 text-sm font-medium text-zinc-400">Prévia da conversa</p>

        <div class="rounded-2xl border border-zinc-800 bg-[#0b141a] p-4">
          <div class="space-y-2.5">
            <div class="max-w-[85%] rounded-xl rounded-tl-sm bg-[#202c33] px-3.5 py-2.5 text-sm text-zinc-100">
              {{ workflow.welcomeMessage || "Olá! 👋 Em que podemos ajudar hoje?" }}
            </div>

            <div v-if="departments.length > 0" class="max-w-[90%] rounded-xl rounded-tl-sm bg-[#202c33] px-3.5 py-2.5 text-sm text-zinc-100">
              <p v-for="(rule, index) in previewRules" :key="rule.key">
                {{ index + 1 }}. {{ rule.optionLabel || "Opção sem nome" }}
              </p>
              <p v-if="previewRules.length === 0" class="text-zinc-500">
                Adicione regras para montar o menu.
              </p>
            </div>

            <div class="ml-auto max-w-[70%] rounded-xl rounded-tr-sm bg-[#005c4b] px-3.5 py-2.5 text-right text-sm text-zinc-100">
              {{ previewRules.length > 0 ? "1" : "Oi" }}
            </div>

            <div class="max-w-[85%] rounded-xl rounded-tl-sm bg-[#202c33] px-3.5 py-2.5 text-sm text-zinc-100">
              Perfeito, te encaminhei pra
              <span class="font-medium">{{ previewTargetDepartment }}</span>. Só um instante 🙂
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue"
import { Plus, ArrowRight, Trash2, LoaderCircle } from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ middleware: "auth" })

interface Department {
  id: string
  name: string
}

interface Rule {
  key: string
  optionLabel: string
  departmentId: string
}

const api = useApi()

const departments = ref<Department[]>([])
const loading = ref(true)

const workflow = reactive({
  enabled: false,
  welcomeMessage: "",
  fallbackDepartmentId: "",
  rules: [] as Rule[],
})

function newRuleKey() {
  return Math.random().toString(36).slice(2)
}

function addRule() {
  workflow.rules.push({ key: newRuleKey(), optionLabel: "", departmentId: "" })
}

function removeRule(index: number) {
  workflow.rules.splice(index, 1)
}

const previewRules = computed(() => workflow.rules.filter((r) => r.optionLabel.trim()))

const previewTargetDepartment = computed(() => {
  const target = previewRules.value[0]?.departmentId ?? workflow.fallbackDepartmentId
  return departments.value.find((d) => d.id === target)?.name ?? "um atendente"
})

async function loadData() {
  loading.value = true
  try {
    const [departmentsResult, workflowResult] = await Promise.allSettled([
      api<Department[]>("/departments"),
      api<typeof workflow>("/workflows/default"),
    ])

    departments.value = departmentsResult.status === "fulfilled" ? departmentsResult.value : []

    if (workflowResult.status === "fulfilled" && workflowResult.value) {
      // Defesa extra: mesmo o backend já devolvendo `key` por regra
      // (usa o id da linha — ver workflows.service.ts), garante aqui
      // que toda regra carregada tem uma key, pra nunca quebrar o
      // `:key="rule.key"` do v-for abaixo se algum dia essa garantia
      // do backend falhar ou mudar.
      const loaded = workflowResult.value
      Object.assign(workflow, {
        ...loaded,
        rules: (loaded.rules ?? []).map((rule) => ({ ...rule, key: rule.key || newRuleKey() })),
      })
    } else if (departments.value.length > 0) {
      // Nenhum fluxo salvo ainda — começa com uma regra por
      // departamento existente, pra não deixar a tela vazia à toa.
      workflow.rules = departments.value.map((dept) => ({
        key: newRuleKey(),
        optionLabel: dept.name,
        departmentId: dept.id,
      }))
      workflow.fallbackDepartmentId = departments.value[0].id
    }
  } finally {
    loading.value = false
  }
}

const saving = ref(false)
const saveError = ref("")
const savedAt = ref(false)

async function saveWorkflow() {
  saving.value = true
  saveError.value = ""
  savedAt.value = false

  try {
    await api("/workflows/default", { method: "PUT", body: workflow })
    savedAt.value = true
    setTimeout(() => (savedAt.value = false), 3000)
  } catch (err: any) {
    saveError.value = err?.data?.error ?? err?.data?.message ?? "Não foi possível salvar o fluxo."
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>
