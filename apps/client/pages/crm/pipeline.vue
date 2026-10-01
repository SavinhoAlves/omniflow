<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2.5 border-b border-zinc-800/80 px-6 py-4">
      <label class="relative flex items-center">
        <span class="sr-only">Funil</span>
        <span class="pointer-events-none absolute left-3 h-2 w-2 rounded-full" :style="{ background: pipeline?.color ?? '#34d399' }" />
        <select
          v-model="pipelineId"
          class="h-10 appearance-none rounded-xl border border-zinc-800 bg-zinc-900 pl-7 pr-9 text-sm font-medium text-white outline-none [color-scheme:dark] focus:border-blue-500"
        >
          <option v-for="p in pipelines" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <ChevronDown :size="14" class="pointer-events-none absolute right-3 text-zinc-400" />
      </label>

      <div role="group" aria-label="Visualização" class="flex gap-0.5 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
        <button
          v-for="v in VIEWS"
          :key="v.value"
          type="button"
          :aria-pressed="view === v.value"
          class="flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition"
          :class="view === v.value ? 'bg-zinc-800 font-medium text-white' : 'text-zinc-400 hover:text-white'"
          @click="setView(v.value)"
        >
          <component :is="v.icon" :size="14" />
          {{ v.label }}
        </button>
      </div>

      <label class="relative flex min-w-[200px] max-w-xs flex-1 items-center">
        <span class="sr-only">Buscar negócios</span>
        <Search :size="14" class="pointer-events-none absolute left-3 text-zinc-500" />
        <input
          v-model="search"
          type="search"
          placeholder="Buscar negócio ou contato…"
          class="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
        >
      </label>

      <div role="group" aria-label="Responsável" class="flex items-center gap-1">
        <button
          type="button"
          :aria-pressed="ownerFilter === ''"
          class="h-9 rounded-full border px-3 text-xs font-semibold transition"
          :class="ownerFilter === '' ? 'border-blue-500 bg-zinc-800 text-white' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'"
          @click="ownerFilter = ''"
        >
          Todos
        </button>
        <button
          v-for="m in ownersWithDeals"
          :key="m.id"
          type="button"
          :title="m.name"
          :aria-pressed="ownerFilter === m.id"
          :aria-label="`Filtrar por ${m.name}`"
          class="flex h-9 w-9 items-center justify-center rounded-full border text-[11px] font-bold transition"
          :class="[ownerFilter === m.id ? 'border-blue-500' : 'border-transparent opacity-70 hover:opacity-100', personTone(m.id)]"
          @click="ownerFilter = ownerFilter === m.id ? '' : m.id"
        >
          {{ personInitials(m.name) }}
        </button>
      </div>

      <button
        type="button"
        :aria-pressed="attentionOnly"
        class="flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition"
        :class="attentionOnly ? 'border-red-400 bg-red-950/50 text-red-200' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'"
        @click="attentionOnly = !attentionOnly"
      >
        <AlertCircle :size="13" />
        Precisam de atenção
      </button>

      <div class="flex-1" />

      <NuxtLink
        to="/crm/settings"
        class="flex h-10 items-center gap-1.5 rounded-xl border border-zinc-800 px-3 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
      >
        <Settings2 :size="14" />
        <span class="hidden xl:inline">Configurar funil</span>
      </NuxtLink>
      <button
        type="button"
        class="flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
        @click="openNewDeal()"
      >
        <Plus :size="16" />
        Novo negócio
      </button>
    </div>

    <!-- Resumo -->
    <div class="grid grid-cols-2 gap-3 px-6 pt-4 lg:grid-cols-4">
      <div class="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p class="text-xs text-zinc-400">Em aberto</p>
        <p class="mt-0.5 text-xl font-semibold tracking-tight text-white">{{ formatBRL(summary.open) }}</p>
        <p class="text-xs text-zinc-400">{{ summary.openCount }} negócio{{ summary.openCount === 1 ? '' : 's' }}</p>
      </div>
      <div class="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p class="text-xs text-zinc-400">Previsão ponderada</p>
        <p class="mt-0.5 text-xl font-semibold tracking-tight text-white">{{ formatBRL(summary.weighted) }}</p>
        <p class="text-xs text-zinc-400">valor × probabilidade da etapa</p>
      </div>
      <div class="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p class="text-xs text-zinc-400">Ganhos no mês</p>
        <p class="mt-0.5 text-xl font-semibold tracking-tight text-emerald-300">{{ formatBRL(summary.won) }}</p>
        <p class="text-xs text-zinc-400">{{ summary.wonCount }} negócio{{ summary.wonCount === 1 ? '' : 's' }} fechado{{ summary.wonCount === 1 ? '' : 's' }}</p>
      </div>
      <div class="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p class="text-xs text-zinc-400">Precisam de atenção</p>
        <p class="mt-0.5 text-xl font-semibold tracking-tight text-red-300">{{ summary.attention }}</p>
        <p class="text-xs text-zinc-400">atrasados, parados ou sem próxima atividade</p>
      </div>
    </div>

    <div v-if="loadError" class="mx-6 mt-4 rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
      {{ loadError }}
    </div>

    <div class="flex min-h-0 flex-1">
      <!-- ── Kanban ── -->
      <div v-if="view === 'kanban'" class="min-w-0 flex-1 overflow-x-auto px-6 pb-6 pt-4">
        <div class="flex h-full items-start gap-3">
          <section
            v-for="col in columns"
            :key="col.stage.id"
            :aria-label="col.stage.name"
            class="flex max-h-full w-[280px] shrink-0 flex-col rounded-2xl border bg-zinc-900/40 transition"
            :class="dragOverStage === col.stage.id ? 'border-blue-500 bg-blue-950/20' : 'border-zinc-800/80'"
            @dragover.prevent="dragOverStage = col.stage.id"
            @dragleave="onDragLeave($event, col.stage.id)"
            @drop.prevent="onDrop(col.stage.id)"
          >
            <div class="px-3 pt-3">
              <div class="h-[3px] rounded-full" :style="{ background: col.stage.color }" />
              <div class="flex items-center justify-between gap-2 px-1 pb-0.5 pt-2.5">
                <div class="flex min-w-0 items-center gap-2">
                  <h2 class="truncate text-[13px] font-semibold text-white">{{ col.stage.name }}</h2>
                  <span class="rounded-full bg-zinc-800 px-1.5 text-[11px] font-semibold text-zinc-300">{{ col.deals.length }}</span>
                </div>
                <span class="shrink-0 text-xs tabular-nums text-zinc-400">{{ formatBRLCompact(col.total) }}</span>
              </div>
              <p class="px-1 pb-2 text-[11px] text-zinc-500">
                {{ col.stage.isWon ? 'Ganhos neste mês' : `Probabilidade ${col.stage.probability}%` }}
              </p>
            </div>

            <div class="flex-1 space-y-2 overflow-y-auto px-3 pb-2">
              <template v-if="loading">
                <div v-for="i in 2" :key="i" class="h-32 animate-pulse rounded-xl bg-zinc-900" />
              </template>
              <button
                v-for="d in col.deals"
                v-else
                :key="d.id"
                type="button"
                draggable="true"
                :aria-pressed="selectedId === d.id"
                class="flex w-full cursor-grab flex-col gap-2.5 rounded-xl border bg-zinc-900 p-3 text-left transition hover:bg-zinc-800/70 active:cursor-grabbing"
                :class="[selectedId === d.id ? 'border-blue-500' : 'border-zinc-800', draggingId === d.id ? 'opacity-40' : '']"
                @click="selectedId = d.id"
                @dragstart="onDragStart($event, d)"
                @dragend="draggingId = null; dragOverStage = null"
              >
                <div class="flex items-start gap-2">
                  <span class="flex-1 text-[13.5px] font-semibold leading-snug text-white">{{ d.title }}</span>
                  <span
                    v-if="d.conversation?.unreadCount"
                    class="flex shrink-0 items-center gap-1 rounded-full bg-blue-900 px-1.5 py-0.5 text-[11px] font-semibold text-blue-100"
                    title="Mensagens não lidas"
                  >
                    <MessageSquare :size="10" />{{ d.conversation.unreadCount }}
                  </span>
                </div>
                <p class="-mt-1 truncate text-xs text-zinc-400">{{ d.contact?.name || d.contact?.phoneNumber || 'Sem contato' }}</p>
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold tabular-nums text-white">{{ formatBRL(d.value) }}</span>
                  <span v-if="d.channel" class="flex items-center gap-1.5 text-[11px] text-zinc-300">
                    <span class="h-1.5 w-1.5 rounded-full" :class="CHANNELS[d.channel]?.dot ?? 'bg-zinc-500'" />
                    {{ CHANNELS[d.channel]?.label ?? 'Canal' }}
                  </span>
                </div>
                <div class="flex items-center gap-2 border-t border-zinc-800 pt-2.5">
                  <component :is="nextInfo(d).icon" :size="13" class="shrink-0" :class="nextInfo(d).tone" />
                  <span class="flex-1 truncate text-xs" :class="nextInfo(d).tone">{{ nextInfo(d).label }}</span>
                  <span
                    v-if="d.owner"
                    :title="d.owner.name"
                    class="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    :class="personTone(d.owner.id)"
                  >
                    {{ personInitials(d.owner.name) }}
                  </span>
                </div>
              </button>
              <p
                v-if="!loading && col.deals.length === 0"
                class="rounded-xl border border-dashed border-zinc-800 px-2 py-5 text-center text-xs text-zinc-500"
              >
                {{ col.stage.isWon ? 'Arraste aqui para marcar como ganho' : 'Nenhum negócio nesta etapa' }}
              </p>
            </div>

            <button
              v-if="!col.stage.isWon"
              type="button"
              class="mx-3 mb-3 flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              @click="openNewDeal(col.stage.id)"
            >
              <Plus :size="13" /> Adicionar
            </button>
          </section>

          <!-- Perdidos -->
          <section
            aria-label="Perdidos no mês"
            class="w-[200px] shrink-0 rounded-2xl border border-dashed p-4 transition"
            :class="dragOverStage === 'lost' ? 'border-red-400 bg-red-950/20' : 'border-zinc-800'"
            @dragover.prevent="dragOverStage = 'lost'"
            @dragleave="onDragLeave($event, 'lost')"
            @drop.prevent="onDropLost"
          >
            <p class="text-[13px] font-semibold text-zinc-200">Perdidos no mês</p>
            <p class="mt-1.5 text-xl font-semibold text-white">{{ lostThisMonth.length }}</p>
            <p v-if="topLostReason" class="mt-0.5 text-xs text-zinc-400">Principal motivo: {{ topLostReason }}</p>
            <p class="mt-3 text-[11px] text-zinc-500">Arraste um card para cá para registrar a perda</p>
          </section>
        </div>
      </div>

      <!-- ── Lista ── -->
      <div v-else class="min-w-0 flex-1 overflow-auto px-6 pb-6 pt-4">
        <div
          v-if="selectedRows.length"
          role="region"
          aria-label="Ações em massa"
          class="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-blue-800 bg-blue-950/60 py-2 pl-4 pr-2"
        >
          <span class="text-sm font-semibold text-blue-100">
            {{ selectedRows.length }} selecionado{{ selectedRows.length > 1 ? 's' : '' }}
          </span>
          <span class="text-xs text-blue-200">{{ formatBRL(selectedRows.reduce((a, d) => a + d.value, 0)) }}</span>
          <div class="flex-1" />
          <label class="flex items-center gap-1.5 text-xs text-blue-100">
            Mover para
            <select
              class="h-8 rounded-lg border border-blue-800 bg-blue-950 px-2 text-xs text-white outline-none [color-scheme:dark]"
              @change="bulkMove(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''"
            >
              <option value="">Etapa…</option>
              <option v-for="s in pipeline?.stages ?? []" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="flex items-center gap-1.5 text-xs text-blue-100">
            Atribuir
            <select
              class="h-8 rounded-lg border border-blue-800 bg-blue-950 px-2 text-xs text-white outline-none [color-scheme:dark]"
              @change="bulkAssign(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''"
            >
              <option value="">Responsável…</option>
              <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </label>
          <button type="button" aria-label="Limpar seleção" class="flex h-8 w-8 items-center justify-center rounded-lg text-blue-100 hover:bg-blue-900" @click="selectedRows = []">
            <X :size="15" />
          </button>
        </div>

        <div class="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
          <table class="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr class="text-left text-xs text-zinc-400">
                <th scope="col" class="w-11 border-b border-zinc-800 pl-4">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos"
                    class="h-4 w-4 accent-blue-600"
                    :checked="listDeals.length > 0 && selectedRows.length === listDeals.length"
                    @change="selectedRows = selectedRows.length === listDeals.length ? [] : [...listDeals]"
                  >
                </th>
                <th
                  v-for="c in COLUMNS"
                  :key="c.key"
                  scope="col"
                  :aria-sort="sortKey === c.key ? (sortDir === 1 ? 'ascending' : 'descending') : undefined"
                  class="whitespace-nowrap border-b border-zinc-800 px-3 py-3 font-medium"
                  :class="c.align === 'right' ? 'text-right' : ''"
                >
                  <button
                    v-if="c.sortable"
                    type="button"
                    class="inline-flex items-center gap-1 hover:text-white"
                    :class="sortKey === c.key ? 'text-white' : ''"
                    @click="toggleSort(c.key)"
                  >
                    {{ c.label }}
                    <span aria-hidden="true">{{ sortKey === c.key ? (sortDir === 1 ? '↑' : '↓') : '↕' }}</span>
                  </button>
                  <template v-else>{{ c.label }}</template>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!loading && listDeals.length === 0">
                <td colspan="9" class="px-4 py-12 text-center text-sm text-zinc-500">Nenhum negócio encontrado</td>
              </tr>
              <tr
                v-for="d in listDeals"
                :key="d.id"
                class="transition hover:bg-zinc-800/40"
                :class="selectedRows.includes(d) ? 'bg-blue-950/30' : ''"
              >
                <td class="border-b border-zinc-800/70 pl-4">
                  <input
                    type="checkbox"
                    :aria-label="`Selecionar ${d.title}`"
                    class="h-4 w-4 accent-blue-600"
                    :checked="selectedRows.includes(d)"
                    @change="toggleRow(d)"
                  >
                </td>
                <td class="border-b border-zinc-800/70 px-3 py-3">
                  <NuxtLink :to="`/crm/deals/${d.id}`" class="font-medium text-white hover:text-blue-200">{{ d.title }}</NuxtLink>
                  <p class="text-xs text-zinc-400">{{ d.contact?.name || d.contact?.phoneNumber || 'Sem contato' }}</p>
                </td>
                <td class="border-b border-zinc-800/70 px-3 py-3">
                  <span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-200">
                    <span class="h-1.5 w-1.5 rounded-full" :style="{ background: stageOf(d)?.color }" />
                    {{ d.status === 'LOST' ? 'Perdido' : stageOf(d)?.name }}
                  </span>
                </td>
                <td class="border-b border-zinc-800/70 px-3 py-3 text-right font-semibold tabular-nums text-white">{{ formatBRL(d.value) }}</td>
                <td class="border-b border-zinc-800/70 px-3 py-3 text-right tabular-nums text-zinc-300">{{ stageOf(d)?.probability ?? 0 }}%</td>
                <td class="border-b border-zinc-800/70 px-3 py-3">
                  <span v-if="d.owner" class="inline-flex items-center gap-2 whitespace-nowrap text-zinc-200">
                    <span class="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold" :class="personTone(d.owner.id)">{{ personInitials(d.owner.name) }}</span>
                    {{ d.owner.name }}
                  </span>
                  <span v-else class="text-zinc-500">—</span>
                </td>
                <td class="border-b border-zinc-800/70 px-3 py-3 text-xs" :class="nextInfo(d).tone">{{ nextInfo(d).label }}</td>
                <td class="border-b border-zinc-800/70 px-3 py-3 tabular-nums text-zinc-300">{{ formatDate(d.expectedCloseDate) }}</td>
                <td class="border-b border-zinc-800/70 px-3 py-3">
                  <span v-if="d.channel" class="inline-flex items-center gap-1.5 text-xs text-zinc-300">
                    <span class="h-1.5 w-1.5 rounded-full" :class="CHANNELS[d.channel]?.dot" />
                    {{ CHANNELS[d.channel]?.label }}
                  </span>
                  <span v-else class="text-xs text-zinc-500">—</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p class="px-4 py-3 text-xs text-zinc-400">
            {{ listDeals.length }} negócio{{ listDeals.length === 1 ? '' : 's' }} ·
            {{ formatBRL(listDeals.reduce((a, d) => a + d.value, 0)) }}
          </p>
        </div>
      </div>

      <!-- ── Drawer ── -->
      <aside
        v-if="selected && view === 'kanban'"
        aria-label="Resumo do negócio"
        class="flex w-[360px] shrink-0 flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950"
      >
        <div class="flex items-start gap-3 border-b border-zinc-800 p-5">
          <div class="min-w-0 flex-1">
            <p class="text-xs text-zinc-400">
              {{ selected.status === 'WON' ? 'Ganho' : stageOf(selected)?.name }} · há {{ daysSince(selected.stageChangedAt) }} dia{{ daysSince(selected.stageChangedAt) === 1 ? '' : 's' }} nesta etapa
            </p>
            <h2 class="mt-1 text-lg font-semibold leading-snug text-white">{{ selected.title }}</h2>
            <p class="mt-1.5 text-2xl font-semibold tabular-nums text-white">{{ formatBRL(selected.value) }}</p>
          </div>
          <button
            type="button"
            aria-label="Fechar resumo"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            @click="selectedId = null"
          >
            <X :size="18" />
          </button>
        </div>

        <div class="space-y-2.5 border-b border-zinc-800 p-5">
          <p class="text-xs font-semibold text-zinc-300">Mover para etapa</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="s in pipeline?.stages ?? []"
              :key="s.id"
              type="button"
              :aria-pressed="s.id === selected.stageId"
              class="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition"
              :class="s.id === selected.stageId ? 'border-zinc-500 bg-zinc-800 font-medium text-white' : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'"
              @click="moveDeal(selected, s.id)"
            >
              <span class="h-1.5 w-1.5 rounded-full" :style="{ background: s.color }" />
              {{ s.name }}
            </button>
          </div>
          <p class="flex justify-between text-xs text-zinc-400">
            <span>Probabilidade {{ stageOf(selected)?.probability ?? 0 }}%</span>
            <span>Ponderado {{ formatBRL(selected.value * (stageOf(selected)?.probability ?? 0) / 100) }}</span>
          </p>
        </div>

        <dl class="grid grid-cols-[120px_1fr] gap-y-2.5 border-b border-zinc-800 p-5 text-sm">
          <dt class="text-zinc-400">Contato</dt>
          <dd class="font-medium text-white">{{ selected.contact?.name || selected.contact?.phoneNumber || '—' }}</dd>
          <dt class="text-zinc-400">Canal</dt>
          <dd class="text-zinc-200">{{ selected.channel ? CHANNELS[selected.channel]?.label : '—' }}</dd>
          <dt class="text-zinc-400">Responsável</dt>
          <dd class="text-zinc-200">{{ selected.owner?.name ?? '—' }}</dd>
          <dt class="text-zinc-400">Origem</dt>
          <dd class="text-zinc-200">{{ selected.source || '—' }}</dd>
          <dt class="text-zinc-400">Previsão</dt>
          <dd class="text-zinc-200">{{ formatDate(selected.expectedCloseDate) }}</dd>
          <dt class="text-zinc-400">Próxima atividade</dt>
          <dd :class="nextInfo(selected).tone">{{ nextInfo(selected).label }}</dd>
        </dl>

        <div class="mt-auto space-y-2 p-5">
          <NuxtLink
            v-if="selected.conversationId"
            :to="`/conversations?id=${selected.conversationId}`"
            class="flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-800 text-sm font-medium text-white transition hover:bg-zinc-900"
          >
            <MessageSquare :size="15" />
            Abrir conversa
          </NuxtLink>
          <NuxtLink
            :to="`/crm/deals/${selected.id}`"
            class="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Abrir ficha completa
            <ArrowRight :size="15" />
          </NuxtLink>
          <div v-if="selected.status === 'OPEN'" class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="h-10 rounded-xl border border-emerald-800 bg-emerald-950 text-sm font-medium text-emerald-300 transition hover:bg-emerald-900"
              @click="markWon(selected)"
            >
              Marcar ganho
            </button>
            <button
              type="button"
              class="h-10 rounded-xl border border-red-900 bg-red-950/60 text-sm font-medium text-red-300 transition hover:bg-red-950"
              @click="lostDeal = selected"
            >
              Marcar perdido
            </button>
          </div>
        </div>
      </aside>
    </div>

    <CrmNewDealModal
      :open="showNewDeal"
      :pipeline-id="pipelineId"
      :stage-id="newDealStageId"
      @close="showNewDeal = false"
      @created="onDealCreated"
    />
    <CrmLostDealModal :deal="lostDeal" @close="lostDeal = null" @lost="onDealLost" />
  </div>
</template>

<script setup lang="ts">
import {
  AlertCircle, ArrowRight, ChevronDown, Clock, Kanban, List, MessageSquare,
  Plus, Search, Settings2, X,
} from "lucide-vue-next"
import { useApi } from "../../composables/useApi"
import {
  CHANNELS, daysSince, formatBRL, formatBRLCompact, formatDate, formatDue, isOverdue,
  personInitials, personTone, apiErrorMessage,
  type Deal, type Member, type Pipeline,
} from "../../composables/useCrm"

definePageMeta({ layout: "chat", middleware: "auth" })
useHead({ title: "Funil de vendas" })

const api = useApi()
const route = useRoute()
const router = useRouter()

const VIEWS = [
  { value: "kanban", label: "Kanban", icon: Kanban },
  { value: "list",   label: "Lista",  icon: List },
] as const

const COLUMNS = [
  { key: "title",    label: "Negócio",           sortable: true },
  { key: "stage",    label: "Etapa" },
  { key: "value",    label: "Valor",             sortable: true, align: "right" },
  { key: "prob",     label: "Prob.",             align: "right" },
  { key: "owner",    label: "Responsável" },
  { key: "next",     label: "Próxima atividade" },
  { key: "close",    label: "Previsão",          sortable: true },
  { key: "channel",  label: "Canal" },
]

// ── State ─────────────────────────────────────────────────────────────────────

const pipelines = ref<Pipeline[]>([])
const members = ref<Member[]>([])
const deals = ref<Deal[]>([])
const loading = ref(true)
const loadError = ref("")

const pipelineId = ref("")
const view = ref<"kanban" | "list">(route.query.view === "list" ? "list" : "kanban")
const search = ref("")
const ownerFilter = ref("")
const attentionOnly = ref(false)
const selectedId = ref<string | null>(null)

const showNewDeal = ref(false)
const newDealStageId = ref<string | null>(null)
const lostDeal = ref<Deal | null>(null)

const draggingId = ref<string | null>(null)
const dragOverStage = ref<string | null>(null)

const sortKey = ref("value")
const sortDir = ref<1 | -1>(-1)
const selectedRows = ref<Deal[]>([])

// ── Derived ───────────────────────────────────────────────────────────────────

const pipeline = computed(() => pipelines.value.find((p) => p.id === pipelineId.value))
const monthStart = computed(() => {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), 1).getTime()
})

function stageOf(d: Deal) {
  return pipeline.value?.stages.find((s) => s.id === d.stageId)
}

function isStale(d: Deal) {
  const stage = stageOf(d)
  return d.status === "OPEN" && !!stage?.rottenDays && daysSince(d.stageChangedAt) >= stage.rottenDays
}

function needsAttention(d: Deal) {
  return d.status === "OPEN" && (!d.nextTask || isOverdue(d.nextTask.dueAt) || isStale(d))
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return deals.value.filter((d) =>
    (!ownerFilter.value || d.ownerId === ownerFilter.value) &&
    (!attentionOnly.value || needsAttention(d)) &&
    (!q || `${d.title} ${d.contact?.name ?? ""} ${d.contact?.phoneNumber ?? ""}`.toLowerCase().includes(q))
  )
})

const wonThisMonth = (d: Deal) => d.status === "WON" && !!d.wonAt && new Date(d.wonAt).getTime() >= monthStart.value

const columns = computed(() =>
  (pipeline.value?.stages ?? []).map((stage) => {
    const list = filtered.value.filter((d) =>
      d.stageId === stage.id && (stage.isWon ? wonThisMonth(d) : d.status === "OPEN")
    )
    return { stage, deals: list, total: list.reduce((a, d) => a + d.value, 0) }
  })
)

const lostThisMonth = computed(() =>
  deals.value.filter((d) => d.status === "LOST" && !!d.lostAt && new Date(d.lostAt).getTime() >= monthStart.value)
)
const topLostReason = computed(() => {
  const counts = new Map<string, number>()
  for (const d of lostThisMonth.value) if (d.lostReason) counts.set(d.lostReason, (counts.get(d.lostReason) ?? 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return top ? `${top[0]} (${top[1]})` : ""
})

const summary = computed(() => {
  const open = filtered.value.filter((d) => d.status === "OPEN")
  const won = filtered.value.filter(wonThisMonth)
  return {
    open: open.reduce((a, d) => a + d.value, 0),
    openCount: open.length,
    weighted: open.reduce((a, d) => a + d.value * (stageOf(d)?.probability ?? 0) / 100, 0),
    won: won.reduce((a, d) => a + d.value, 0),
    wonCount: won.length,
    attention: open.filter(needsAttention).length,
  }
})

const ownersWithDeals = computed(() => {
  const ids = new Set(deals.value.map((d) => d.ownerId).filter(Boolean))
  return members.value.filter((m) => ids.has(m.id))
})

const selected = computed(() => deals.value.find((d) => d.id === selectedId.value) ?? null)

const listDeals = computed(() => {
  const list = filtered.value.filter((d) => d.status !== "LOST")
  const key = sortKey.value
  return [...list].sort((a, b) => {
    const va = key === "title" ? a.title.toLowerCase() : key === "close" ? (a.expectedCloseDate ?? "9999") : a.value
    const vb = key === "title" ? b.title.toLowerCase() : key === "close" ? (b.expectedCloseDate ?? "9999") : b.value
    return (va > vb ? 1 : va < vb ? -1 : 0) * sortDir.value
  })
})

function nextInfo(d: Deal) {
  if (d.status === "WON") return { label: `Ganho em ${formatDate(d.wonAt)}`, tone: "text-emerald-300", icon: Clock }
  if (!d.nextTask) return { label: "Sem próxima atividade", tone: "text-red-300", icon: AlertCircle }
  const label = `${d.nextTask.title || "Tarefa"} · ${formatDue(d.nextTask.dueAt)}`
  if (isOverdue(d.nextTask.dueAt)) return { label, tone: "text-red-300", icon: AlertCircle }
  if (isStale(d)) return { label: `Parado há ${daysSince(d.stageChangedAt)} dias · ${label}`, tone: "text-amber-300", icon: AlertCircle }
  const today = new Date(d.nextTask.dueAt!).toDateString() === new Date().toDateString()
  return { label, tone: today ? "text-amber-300" : "text-zinc-400", icon: Clock }
}

// ── Load ──────────────────────────────────────────────────────────────────────

async function loadMeta() {
  const [p, m] = await Promise.all([api<Pipeline[]>("/crm/pipelines"), api<Member[]>("/crm/members")])
  pipelines.value = p
  members.value = m
  const fromQuery = typeof route.query.pipeline === "string" ? route.query.pipeline : ""
  pipelineId.value = p.find((x) => x.id === fromQuery)?.id ?? p.find((x) => x.isDefault)?.id ?? p[0]?.id ?? ""
}

async function loadDeals() {
  if (!pipelineId.value) return
  loading.value = true
  try {
    deals.value = await api<Deal[]>(`/crm/deals?pipelineId=${pipelineId.value}`)
    loadError.value = ""
  } catch (err) {
    loadError.value = apiErrorMessage(err, "Não foi possível carregar os negócios.")
  } finally {
    loading.value = false
  }
}

watch(pipelineId, (id, prev) => {
  if (prev !== undefined && prev !== "") selectedId.value = null
  selectedRows.value = []
  router.replace({ query: { ...route.query, pipeline: id || undefined } })
  loadDeals()
})

function setView(v: "kanban" | "list") {
  view.value = v
  router.replace({ query: { ...route.query, view: v === "list" ? "list" : undefined } })
}

// ── Actions ───────────────────────────────────────────────────────────────────

function replaceDeal(updated: Partial<Deal> & { id: string }) {
  const idx = deals.value.findIndex((d) => d.id === updated.id)
  if (idx !== -1) deals.value[idx] = { ...deals.value[idx], ...updated } as Deal
}

async function moveDeal(d: Deal, stageId: string) {
  if (d.stageId === stageId && d.status === "OPEN") return
  const target = pipeline.value?.stages.find((s) => s.id === stageId)
  const before = { ...d }
  // Otimista: o card muda de coluna na hora
  replaceDeal({
    id: d.id, stageId, stageChangedAt: new Date().toISOString(),
    status: target?.isWon ? "WON" : "OPEN", wonAt: target?.isWon ? new Date().toISOString() : null,
  })
  try {
    const updated = await api<Deal>(`/crm/deals/${d.id}/move`, { method: "POST", body: { stageId } })
    replaceDeal(updated)
  } catch (err) {
    replaceDeal(before)
    alert(apiErrorMessage(err, "Não foi possível mover o negócio."))
  }
}

async function markWon(d: Deal) {
  const won = pipeline.value?.stages.find((s) => s.isWon)
  if (won) await moveDeal(d, won.id)
}

function onDragStart(e: DragEvent, d: Deal) {
  draggingId.value = d.id
  e.dataTransfer?.setData("text/plain", d.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"
}

function onDragLeave(e: DragEvent, stageId: string) {
  // Só limpa quando o cursor sai da coluna, não ao passar sobre um card filho
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node) && dragOverStage.value === stageId) {
    dragOverStage.value = null
  }
}

function onDrop(stageId: string) {
  const d = deals.value.find((x) => x.id === draggingId.value)
  dragOverStage.value = null
  draggingId.value = null
  if (d) moveDeal(d, stageId)
}

function onDropLost() {
  const d = deals.value.find((x) => x.id === draggingId.value)
  dragOverStage.value = null
  draggingId.value = null
  if (d && d.status === "OPEN") lostDeal.value = d
}

function openNewDeal(stageId?: string) {
  newDealStageId.value = stageId ?? null
  showNewDeal.value = true
}

function onDealCreated() {
  showNewDeal.value = false
  loadDeals()
}

function onDealLost(updated: Deal) {
  lostDeal.value = null
  replaceDeal(updated)
  if (selectedId.value === updated.id) selectedId.value = null
}

function toggleSort(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 1 ? -1 : 1
  else { sortKey.value = key; sortDir.value = key === "title" ? 1 : -1 }
}

function toggleRow(d: Deal) {
  selectedRows.value = selectedRows.value.includes(d)
    ? selectedRows.value.filter((x) => x !== d)
    : [...selectedRows.value, d]
}

async function bulkMove(stageId: string) {
  if (!stageId) return
  const rows = [...selectedRows.value]
  await Promise.allSettled(rows.map((d) => api(`/crm/deals/${d.id}/move`, { method: "POST", body: { stageId } })))
  selectedRows.value = []
  await loadDeals()
}

async function bulkAssign(ownerId: string) {
  if (!ownerId) return
  const rows = [...selectedRows.value]
  await Promise.allSettled(rows.map((d) => api(`/crm/deals/${d.id}`, { method: "PATCH", body: { ownerId } })))
  selectedRows.value = []
  await loadDeals()
}

onMounted(async () => {
  try {
    await loadMeta()
  } catch (err) {
    loadError.value = apiErrorMessage(err, "Não foi possível carregar o CRM.")
    loading.value = false
  }
})
</script>
