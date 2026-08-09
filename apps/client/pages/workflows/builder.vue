<template>
  <div class="flex h-full flex-col overflow-hidden bg-[#0d1117]">
    <!-- Toolbar -->
    <div class="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-2.5">
      <NuxtLink to="/workflows" class="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300">
        <ArrowLeft :size="13" />
        Voltar
      </NuxtLink>
      <div class="mx-1 h-4 w-px bg-zinc-800" />
      <span class="text-sm font-semibold text-white">Editor de fluxo</span>
      <div class="flex-1" />

      <!-- Add node buttons -->
      <button
        v-for="type in NODE_TYPES_DEF"
        :key="type.type"
        class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition"
        :class="type.btnClass"
        @click="addNode(type.type)"
      >
        <component :is="type.icon" :size="12" />
        {{ type.label }}
      </button>

      <div class="mx-1 h-4 w-px bg-zinc-800" />

      <!-- Active toggle -->
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition"
        :class="flowEnabled
          ? 'border-emerald-600/30 bg-emerald-600/10 text-emerald-400'
          : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'"
        @click="flowEnabled = !flowEnabled"
      >
        <span class="h-1.5 w-1.5 rounded-full" :class="flowEnabled ? 'bg-emerald-400' : 'bg-zinc-600'" />
        {{ flowEnabled ? 'Ativo' : 'Inativo' }}
      </button>

      <button
        class="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
        :disabled="saving"
        @click="saveFlow"
      >
        <LoaderCircle v-if="saving" :size="12" class="animate-spin" />
        <Save v-else :size="12" />
        {{ saving ? 'Salvando…' : 'Salvar' }}
      </button>
    </div>

    <!-- Canvas + Properties panel -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Vue Flow canvas -->
      <div class="relative flex-1">
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          :default-edge-options="{ type: 'smoothstep', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }"
          :connection-line-style="{ stroke: '#3b82f6', strokeWidth: 2 }"
          fit-view-on-init
          class="bg-[#0d1117]"
          @connect="onConnect"
          @node-click="onNodeClick"
          @pane-click="selectedNode = null"
        >
          <Background pattern-color="#1f2937" :gap="24" :size="1" />
          <Controls class="!bg-zinc-900 !border-zinc-800 [&_button]:!bg-zinc-900 [&_button]:!border-zinc-700 [&_button]:!text-zinc-400 [&_button:hover]:!bg-zinc-800" />
          <MiniMap
            class="!bg-zinc-900 !border-zinc-800"
            :node-color="miniMapColor"
          />

          <template #node-start="{ data }">
            <div class="flex flex-col items-center gap-2 rounded-2xl border-2 border-emerald-500 bg-emerald-500/10 px-5 py-3 shadow-lg shadow-emerald-500/10 min-w-[140px]">
              <div class="flex items-center gap-2">
                <Play :size="14" class="text-emerald-400" />
                <span class="text-sm font-semibold text-emerald-300">Início</span>
              </div>
              <p class="text-[10px] text-emerald-500/70">Ponto de entrada</p>
              <Handle type="source" position="right" class="!bg-emerald-500 !border-emerald-300 !w-3 !h-3" />
            </div>
          </template>

          <template #node-message="{ id, data }">
            <div
              class="flex flex-col gap-2 rounded-2xl border-2 bg-blue-500/10 px-4 py-3 shadow-lg min-w-[200px] max-w-[260px] cursor-default transition"
              :class="selectedNode?.id === id ? 'border-blue-400' : 'border-blue-600/50'"
            >
              <div class="flex items-center gap-2">
                <MessageSquare :size="13" class="text-blue-400 shrink-0" />
                <span class="text-xs font-semibold text-blue-300">Mensagem</span>
                <button class="ml-auto text-zinc-600 hover:text-red-400 transition" @click.stop="removeNode(id)">
                  <X :size="11" />
                </button>
              </div>
              <p class="text-[11px] leading-relaxed text-zinc-300 whitespace-pre-wrap break-words min-h-[32px]">
                {{ data.text || '(sem texto)' }}
              </p>
              <Handle type="target" position="left" class="!bg-blue-500 !w-3 !h-3" />
              <Handle type="source" position="right" class="!bg-blue-500 !w-3 !h-3" />
            </div>
          </template>

          <template #node-menu="{ id, data }">
            <div
              class="flex flex-col gap-2 rounded-2xl border-2 bg-purple-500/10 px-4 py-3 shadow-lg min-w-[220px] max-w-[280px] cursor-default transition"
              :class="selectedNode?.id === id ? 'border-purple-400' : 'border-purple-600/50'"
            >
              <div class="flex items-center gap-2">
                <ListOrdered :size="13" class="text-purple-400 shrink-0" />
                <span class="text-xs font-semibold text-purple-300">Menu de opções</span>
                <button class="ml-auto text-zinc-600 hover:text-red-400 transition" @click.stop="removeNode(id)">
                  <X :size="11" />
                </button>
              </div>
              <p class="text-[11px] text-zinc-400">{{ data.text || '(sem pergunta)' }}</p>
              <div class="space-y-1">
                <div
                  v-for="(opt, idx) in data.options ?? []"
                  :key="opt.id"
                  class="flex items-center gap-2 rounded-lg bg-purple-500/10 px-2 py-1 text-[11px]"
                >
                  <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-purple-500/30 text-[9px] font-bold text-purple-300">{{ idx + 1 }}</span>
                  <span class="text-zinc-300 truncate">{{ opt.label || '…' }}</span>
                  <Handle
                    :id="opt.id"
                    type="source"
                    position="right"
                    class="!relative !translate-y-0 !top-auto !right-auto !bg-purple-500 !w-3 !h-3 ml-auto shrink-0"
                  />
                </div>
                <p v-if="!data.options?.length" class="text-[10px] text-zinc-600">Nenhuma opção ainda</p>
              </div>
              <Handle type="target" position="left" class="!bg-purple-500 !w-3 !h-3" />
            </div>
          </template>

          <template #node-action="{ id, data }">
            <div
              class="flex flex-col gap-2 rounded-2xl border-2 bg-orange-500/10 px-4 py-3 shadow-lg min-w-[200px] max-w-[260px] cursor-default transition"
              :class="selectedNode?.id === id ? 'border-orange-400' : 'border-orange-600/50'"
            >
              <div class="flex items-center gap-2">
                <Zap :size="13" class="text-orange-400 shrink-0" />
                <span class="text-xs font-semibold text-orange-300">Ação</span>
                <button class="ml-auto text-zinc-600 hover:text-red-400 transition" @click.stop="removeNode(id)">
                  <X :size="11" />
                </button>
              </div>
              <div class="text-[11px] text-zinc-300">
                <span v-if="data.actionType === 'set_department'">
                  📂 {{ deptName(data.departmentId) || 'Departamento não escolhido' }}
                </span>
                <span v-else-if="data.actionType === 'end'">🔚 Encerrar conversa</span>
                <span v-else>— Configurar ação —</span>
              </div>
              <Handle type="target" position="left" class="!bg-orange-500 !w-3 !h-3" />
            </div>
          </template>
        </VueFlow>

        <!-- Empty state -->
        <div v-if="nodes.length === 0" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
            <Workflow :size="24" class="text-zinc-700" />
          </div>
          <p class="text-sm text-zinc-600">Adicione nós pela barra acima para começar o fluxo</p>
        </div>
      </div>

      <!-- Properties panel -->
      <div
        v-if="selectedNode"
        class="w-72 shrink-0 overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-4"
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-white">Propriedades</h3>
          <button class="text-zinc-600 hover:text-zinc-400" @click="selectedNode = null">
            <X :size="15" />
          </button>
        </div>

        <!-- Message node editor -->
        <template v-if="selectedNode.type === 'message'">
          <label class="text-xs font-medium text-zinc-400">Texto da mensagem</label>
          <textarea
            v-model="selectedNode.data.text"
            rows="5"
            placeholder="Olá! Como posso ajudar?"
            class="mt-1.5 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500"
            @input="syncNodeData"
          />
        </template>

        <!-- Menu node editor -->
        <template v-else-if="selectedNode.type === 'menu'">
          <label class="text-xs font-medium text-zinc-400">Pergunta / Texto do menu</label>
          <textarea
            v-model="selectedNode.data.text"
            rows="3"
            placeholder="Escolha uma opção:"
            class="mt-1.5 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500"
            @input="syncNodeData"
          />
          <div class="mt-4">
            <div class="mb-2 flex items-center justify-between">
              <label class="text-xs font-medium text-zinc-400">Opções</label>
              <button
                class="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition"
                @click="addMenuOption"
              >+ Opção</button>
            </div>
            <div class="space-y-2">
              <div
                v-for="(opt, idx) in selectedNode.data.options ?? []"
                :key="opt.id"
                class="flex items-center gap-2"
              >
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[10px] font-bold text-purple-400">{{ idx + 1 }}</span>
                <input
                  v-model="opt.label"
                  type="text"
                  :placeholder="`Opção ${idx + 1}`"
                  class="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                  @input="syncNodeData"
                />
                <button class="shrink-0 text-zinc-600 hover:text-red-400 transition" @click="removeMenuOption(idx)">
                  <X :size="12" />
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- Action node editor -->
        <template v-else-if="selectedNode.type === 'action'">
          <label class="text-xs font-medium text-zinc-400">Tipo de ação</label>
          <div class="mt-1.5 space-y-2">
            <button
              v-for="at in ACTION_TYPES"
              :key="at.value"
              class="flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition text-left"
              :class="selectedNode.data.actionType === at.value
                ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'"
              @click="selectedNode.data.actionType = at.value; syncNodeData()"
            >
              <span>{{ at.emoji }}</span>
              {{ at.label }}
            </button>
          </div>
          <template v-if="selectedNode.data.actionType === 'set_department'">
            <label class="mt-4 block text-xs font-medium text-zinc-400">Departamento</label>
            <select
              v-model="selectedNode.data.departmentId"
              class="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
              @change="syncNodeData"
            >
              <option value="">Selecione…</option>
              <option v-for="dept in departments" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
            </select>
          </template>
        </template>

        <!-- Start node — no editable props -->
        <template v-else-if="selectedNode.type === 'start'">
          <p class="text-xs text-zinc-500">O nó de início é o ponto de entrada do fluxo. Conecte-o ao primeiro passo do atendimento.</p>
        </template>

        <div class="mt-5 border-t border-zinc-800 pt-4">
          <p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">ID do nó</p>
          <p class="font-mono text-[10px] text-zinc-700">{{ selectedNode.id }}</p>
        </div>
      </div>
    </div>

    <!-- Save toast -->
    <Teleport to="body">
      <div
        v-if="saveToast"
        class="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-emerald-500/30 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-emerald-400 shadow-xl transition"
      >
        ✓ Fluxo salvo com sucesso
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue"
import { VueFlow, useVueFlow, Handle, type Node, type Edge, type Connection } from "@vue-flow/core"
import { Background } from "@vue-flow/background"
import { Controls } from "@vue-flow/controls"
import { MiniMap } from "@vue-flow/minimap"
import {
  ArrowLeft, Save, LoaderCircle, Play, MessageSquare, ListOrdered,
  Zap, X, Workflow,
} from "lucide-vue-next"
import { useApi } from "../../composables/useApi"

definePageMeta({ layout: "chat", middleware: "auth" })

const api = useApi()

// ── Node type definitions (for the toolbar) ───────────────────────────────────

const NODE_TYPES_DEF = [
  {
    type: "message",
    label: "Mensagem",
    icon: MessageSquare,
    btnClass: "border-blue-600/40 text-blue-400 hover:bg-blue-600/10",
  },
  {
    type: "menu",
    label: "Menu",
    icon: ListOrdered,
    btnClass: "border-purple-600/40 text-purple-400 hover:bg-purple-600/10",
  },
  {
    type: "action",
    label: "Ação",
    icon: Zap,
    btnClass: "border-orange-600/40 text-orange-400 hover:bg-orange-600/10",
  },
]

const ACTION_TYPES = [
  { value: "set_department", label: "Encaminhar para departamento", emoji: "📂" },
  { value: "end",            label: "Encerrar conversa",           emoji: "🔚" },
]

// ── State ─────────────────────────────────────────────────────────────────────

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])
const selectedNode = ref<Node | null>(null)
const flowEnabled = ref(false)
const saving = ref(false)
const saveToast = ref(false)

interface Department { id: string; name: string }
const departments = ref<Department[]>([])

// ── Vue Flow utils ────────────────────────────────────────────────────────────

const { findNode, addNodes: vfAddNodes, addEdges: vfAddEdges } = useVueFlow()

// ── Helpers ───────────────────────────────────────────────────────────────────

function deptName(id?: string) {
  return departments.value.find((d) => d.id === id)?.name ?? null
}

function miniMapColor(node: Node) {
  const map: Record<string, string> = {
    start:   "#10b981",
    message: "#3b82f6",
    menu:    "#8b5cf6",
    action:  "#f97316",
  }
  return map[node.type ?? ""] ?? "#4b5563"
}

function uid() {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ── Node operations ───────────────────────────────────────────────────────────

function addNode(type: string) {
  const id = uid()
  const base = { id, type, position: { x: 200 + Math.random() * 200, y: 100 + Math.random() * 150 } }

  const dataMap: Record<string, object> = {
    message: { text: "" },
    menu:    { text: "", options: [{ id: uid(), label: "Opção 1" }] },
    action:  { actionType: "set_department", departmentId: "" },
    start:   {},
  }

  vfAddNodes([{ ...base, data: dataMap[type] ?? {} }])
}

function removeNode(id: string) {
  nodes.value = nodes.value.filter((n) => n.id !== id)
  edges.value = edges.value.filter((e) => e.source !== id && e.target !== id)
  if (selectedNode.value?.id === id) selectedNode.value = null
}

function onConnect(params: Connection) {
  vfAddEdges([{ ...params, type: "smoothstep", animated: true, style: { stroke: "#3b82f6", strokeWidth: 2 } }])
}

function onNodeClick({ node }: { node: Node; event: MouseEvent }) {
  selectedNode.value = { ...node }
}

function syncNodeData() {
  if (!selectedNode.value) return
  const target = findNode(selectedNode.value.id)
  if (target) Object.assign(target.data, selectedNode.value.data)
}

// ── Menu option helpers ───────────────────────────────────────────────────────

function addMenuOption() {
  if (!selectedNode.value) return
  if (!selectedNode.value.data.options) selectedNode.value.data.options = []
  selectedNode.value.data.options.push({ id: uid(), label: "" })
  syncNodeData()
}

function removeMenuOption(idx: number) {
  if (!selectedNode.value) return
  selectedNode.value.data.options.splice(idx, 1)
  syncNodeData()
}

// ── Load & save ───────────────────────────────────────────────────────────────

async function loadFlow() {
  try {
    const [workflowRes, deptsRes] = await Promise.allSettled([
      api<{ flowNodes: Node[] | null; flowEdges: Edge[] | null; enabled: boolean }>("/workflows/default"),
      api<Department[]>("/departments"),
    ])
    departments.value = deptsRes.status === "fulfilled" ? deptsRes.value : []

    if (workflowRes.status === "fulfilled" && workflowRes.value) {
      flowEnabled.value = workflowRes.value.enabled
      if (workflowRes.value.flowNodes?.length) {
        nodes.value = workflowRes.value.flowNodes as Node[]
        edges.value = (workflowRes.value.flowEdges ?? []) as Edge[]
        return
      }
    }

    // Default: start node only
    nodes.value = [{ id: "start", type: "start", position: { x: 80, y: 180 }, data: {} }]
  } catch {
    nodes.value = [{ id: "start", type: "start", position: { x: 80, y: 180 }, data: {} }]
  }
}

async function saveFlow() {
  saving.value = true
  try {
    // Fetch current workflow for existing fields
    const current = await api<any>("/workflows/default").catch(() => null)
    await api("/workflows/default", {
      method: "PUT",
      body: {
        enabled: flowEnabled.value,
        welcomeMessage: current?.welcomeMessage ?? "",
        fallbackDepartmentId: current?.fallbackDepartmentId ?? null,
        rules: current?.rules?.map((r: any) => ({ optionLabel: r.optionLabel, departmentId: r.departmentId })) ?? [],
        flowNodes: nodes.value,
        flowEdges: edges.value,
      },
    })
    saveToast.value = true
    setTimeout(() => (saveToast.value = false), 2500)
  } catch {} finally {
    saving.value = false
  }
}

onMounted(loadFlow)
</script>

<style>
/* Vue Flow canvas dark theme overrides */
.vue-flow__edge-path { stroke: #3b82f6 !important; }
.vue-flow__connection-path { stroke: #3b82f6 !important; }
.vue-flow__handle { border-color: #1f2937 !important; }
.vue-flow__controls button { color: #9ca3af; }
.vue-flow__minimap { border-radius: 12px; overflow: hidden; }
</style>
