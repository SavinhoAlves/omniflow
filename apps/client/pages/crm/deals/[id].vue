<template>
  <div class="mx-auto max-w-[1280px] space-y-5">
    <nav aria-label="Navegação estrutural" class="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
      <NuxtLink :to="deal ? `/crm/pipeline?pipeline=${deal.pipelineId}` : '/crm/pipeline'" class="flex min-h-[32px] items-center gap-1.5 text-blue-300 hover:text-blue-200">
        <ArrowLeft :size="14" /> Funil de vendas
      </NuxtLink>
      <template v-if="deal">
        <span aria-hidden="true">/</span>
        <span>{{ pipelineName }}</span>
        <span aria-hidden="true">/</span>
        <span class="text-white">{{ statusLabel }}</span>
      </template>
    </nav>

    <div v-if="loading" class="space-y-4">
      <div class="h-48 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
      <div class="h-96 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
    </div>

    <div v-else-if="!deal" class="flex flex-col items-center py-20 text-center">
      <p class="text-sm text-zinc-400">{{ loadError || 'Negócio não encontrado.' }}</p>
      <NuxtLink to="/crm/pipeline" class="mt-4 text-sm text-blue-300 hover:text-blue-200">Voltar ao funil</NuxtLink>
    </div>

    <template v-else>
      <!-- Cabeçalho -->
      <section class="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div
          v-if="deal.status !== 'OPEN'"
          class="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm"
          :class="deal.status === 'WON' ? 'border-emerald-800 bg-emerald-950/60 text-emerald-200' : 'border-red-900 bg-red-950/50 text-red-200'"
        >
          <Trophy v-if="deal.status === 'WON'" :size="16" />
          <XCircle v-else :size="16" />
          <span class="flex-1">
            <template v-if="deal.status === 'WON'">Negócio ganho em {{ formatDate(deal.wonAt) }}</template>
            <template v-else>Perdido em {{ formatDate(deal.lostAt) }} · {{ deal.lostReason }}<span v-if="deal.lostNote" class="text-red-300"> — {{ deal.lostNote }}</span></template>
          </span>
          <button type="button" class="flex h-8 items-center gap-1.5 rounded-lg border border-current/30 px-3 text-xs font-medium hover:bg-white/5" @click="reopen">
            <RotateCcw :size="13" /> Reabrir
          </button>
        </div>

        <div class="flex flex-wrap items-start gap-5">
          <div class="min-w-[260px] flex-1">
            <input
              v-if="editingTitle"
              ref="titleInput"
              v-model="titleDraft"
              aria-label="Título do negócio"
              maxlength="200"
              class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-2xl font-semibold text-white outline-none focus:border-blue-500"
              @keydown.enter="saveTitle"
              @keydown.escape="editingTitle = false"
              @blur="saveTitle"
            >
            <h1 v-else class="group flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
              {{ deal.title }}
              <button type="button" aria-label="Editar título" class="rounded-md p-1 text-zinc-500 opacity-0 transition hover:text-white group-hover:opacity-100 focus:opacity-100" @click="startEditTitle">
                <Pencil :size="15" />
              </button>
            </h1>
            <div class="mt-2.5 flex flex-wrap gap-2 text-xs">
              <span v-if="deal.channel" class="flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-zinc-200">
                <span class="h-1.5 w-1.5 rounded-full" :class="CHANNELS[deal.channel]?.dot" />{{ CHANNELS[deal.channel]?.label }}
              </span>
              <label class="flex items-center gap-1.5 rounded-full bg-zinc-800 py-0.5 pl-2.5 pr-1 text-zinc-200">
                Responsável:
                <select
                  :value="deal.ownerId ?? ''"
                  class="rounded-full bg-transparent py-0.5 pr-1 text-xs text-white outline-none [color-scheme:dark]"
                  @change="patch({ ownerId: ($event.target as HTMLSelectElement).value || null })"
                >
                  <option value="">Ninguém</option>
                  <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
                </select>
              </label>
              <span class="rounded-full bg-zinc-800 px-2.5 py-1 text-zinc-200">Criado em {{ formatDate(deal.createdAt) }}</span>
            </div>
          </div>

          <div class="text-right">
            <p class="text-xs text-zinc-400">Valor do negócio</p>
            <div v-if="editingValue" class="mt-1 flex items-center gap-1">
              <span class="text-zinc-500">R$</span>
              <input
                ref="valueInput"
                v-model.number="valueDraft"
                type="number"
                min="0"
                step="0.01"
                aria-label="Valor do negócio"
                class="w-40 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-right text-2xl font-semibold tabular-nums text-white outline-none focus:border-blue-500"
                @keydown.enter="saveValue"
                @keydown.escape="editingValue = false"
                @blur="saveValue"
              >
            </div>
            <button v-else type="button" class="text-3xl font-semibold tabular-nums tracking-tight text-white hover:text-blue-200" title="Editar valor" @click="startEditValue">
              {{ formatBRL(deal.value) }}
            </button>
            <p class="text-xs text-zinc-400">Ponderado {{ formatBRL(deal.value * (currentStage?.probability ?? 0) / 100) }} · {{ currentStage?.probability ?? 0 }}%</p>
          </div>

          <div v-if="deal.status === 'OPEN'" class="flex gap-2 self-center">
            <button type="button" class="h-10 rounded-xl border border-red-900 bg-red-950/60 px-4 text-sm font-medium text-red-300 transition hover:bg-red-950" @click="showLost = true">
              Perdido
            </button>
            <button type="button" class="flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600" @click="markWon">
              <Check :size="16" /> Ganho
            </button>
          </div>
        </div>

        <ol aria-label="Etapas do funil" class="grid gap-1" :style="{ gridTemplateColumns: `repeat(${stages.length || 1}, minmax(0, 1fr))` }">
          <li v-for="(s, i) in stages" :key="s.id">
            <button
              type="button"
              :aria-current="s.id === deal.stageId ? 'step' : undefined"
              class="flex min-h-[52px] w-full flex-col justify-center gap-0.5 rounded-lg px-3 py-2 text-left transition"
              :class="i === currentIndex ? 'text-zinc-950' : i < currentIndex ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-zinc-950 text-zinc-400 hover:bg-zinc-800'"
              :style="i === currentIndex ? { background: s.color } : undefined"
              @click="move(s.id)"
            >
              <span class="truncate text-xs font-semibold">{{ s.name }}</span>
              <span class="text-[11px] opacity-85">
                {{ i === currentIndex ? (s.isWon ? 'Ganho' : `Atual · há ${daysSince(deal.stageChangedAt)} dia${daysSince(deal.stageChangedAt) === 1 ? '' : 's'}`) : i < currentIndex ? 'Concluída' : `${s.probability}%` }}
              </span>
            </button>
          </li>
        </ol>
      </section>

      <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <!-- Coluna principal -->
        <section class="min-w-0 space-y-4">
          <div role="tablist" aria-label="Seções do negócio" class="flex gap-1 border-b border-zinc-800">
            <button
              v-for="t in tabs"
              :key="t.value"
              type="button"
              role="tab"
              :aria-selected="tab === t.value"
              class="-mb-px h-11 border-b-2 px-4 text-sm font-medium transition"
              :class="tab === t.value ? 'border-blue-500 text-white' : 'border-transparent text-zinc-400 hover:text-white'"
              @click="selectTab(t.value)"
            >
              {{ t.label }}
            </button>
          </div>

          <!-- Linha do tempo -->
          <template v-if="tab === 'timeline'">
            <form class="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900" @submit.prevent="addActivity">
              <div role="group" aria-label="Tipo de registro" class="flex gap-1 border-b border-zinc-800 p-2">
                <button
                  v-for="k in COMPOSER_KINDS"
                  :key="k.value"
                  type="button"
                  :aria-pressed="composer.kind === k.value"
                  class="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm transition"
                  :class="composer.kind === k.value ? 'bg-zinc-800 font-medium text-white' : 'text-zinc-400 hover:text-white'"
                  @click="composer.kind = k.value"
                >
                  <component :is="k.icon" :size="14" /> {{ k.label }}
                </button>
              </div>

              <div v-if="composer.kind === 'schedule'" class="grid gap-2 border-b border-zinc-800 p-3 sm:grid-cols-[150px_1fr]">
                <select v-model="composer.taskType" aria-label="Tipo de tarefa" class="h-10 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-sm text-white outline-none [color-scheme:dark]">
                  <option v-for="t in TASK_OPTIONS" :key="t" :value="t">{{ ACTIVITY_TYPES[t].label }}</option>
                </select>
                <input v-model="composer.title" aria-label="Título da tarefa" required placeholder="Ex.: Enviar simulação de parcelamento" maxlength="200" class="h-10 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500">
                <input v-model="composer.dueAt" aria-label="Prazo" required type="datetime-local" class="h-10 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-sm text-white outline-none [color-scheme:dark] focus:border-blue-500">
                <select v-model="composer.assigneeId" aria-label="Responsável pela tarefa" class="h-10 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-sm text-white outline-none [color-scheme:dark]">
                  <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
                </select>
              </div>

              <label class="block px-4 pt-3">
                <span class="sr-only">Texto do registro</span>
                <textarea
                  v-model="composer.content"
                  rows="3"
                  maxlength="5000"
                  :placeholder="composerPlaceholder"
                  class="w-full resize-y bg-transparent text-sm leading-relaxed text-white outline-none placeholder:text-zinc-500"
                />
              </label>
              <div class="flex items-center justify-between gap-2 px-4 pb-3">
                <span class="text-xs text-zinc-500">{{ composerHint }}</span>
                <button
                  type="submit"
                  :disabled="savingActivity || !canSubmitComposer"
                  class="h-9 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {{ composerCta }}
                </button>
              </div>
            </form>

            <ol class="space-y-0">
              <li v-for="a in timeline" :key="a.id" class="flex gap-3.5">
                <div class="flex flex-col items-center">
                  <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" :class="[ACTIVITY_TYPES[a.type]?.bg, ACTIVITY_TYPES[a.type]?.fg]">
                    <component :is="ACTIVITY_TYPES[a.type]?.icon ?? StickyNote" :size="15" />
                  </span>
                  <span class="w-px flex-1 bg-zinc-800" />
                </div>
                <div class="min-w-0 flex-1 pb-5">
                  <div class="flex flex-wrap items-baseline gap-x-2">
                    <span class="text-[13.5px] font-semibold text-white">{{ activityTitle(a) }}</span>
                    <span class="text-xs text-zinc-500">{{ formatDateTime(a.createdAt) }}</span>
                  </div>
                  <p v-if="a.content" class="mt-2 whitespace-pre-line rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm leading-relaxed text-zinc-200">{{ a.content }}</p>
                  <p class="mt-1.5 text-xs text-zinc-400">
                    <template v-if="a.dueAt">
                      <span :class="!a.doneAt && isOverdue(a.dueAt) ? 'text-red-300' : ''">
                        {{ a.doneAt ? `Concluída · prazo ${formatDateTime(a.dueAt)}` : `Prazo ${formatDue(a.dueAt)}` }}
                      </span>
                      <span v-if="a.assignee"> · {{ a.assignee.name }}</span>
                    </template>
                    <template v-else-if="a.user">por {{ a.user.name }}</template>
                  </p>
                </div>
              </li>
            </ol>
          </template>

          <!-- Conversa -->
          <template v-else-if="tab === 'chat'">
            <div class="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d1117]">
              <div class="flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
                <p class="text-sm">
                  <span class="font-semibold text-white">{{ deal.contact?.name || deal.contact?.phoneNumber }}</span>
                  <span class="text-zinc-400"> · {{ deal.channel ? CHANNELS[deal.channel]?.label : 'Conversa' }}</span>
                </p>
                <NuxtLink :to="`/conversations?id=${deal.conversationId}`" class="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500">
                  <MessageSquare :size="13" /> Responder na caixa de entrada
                </NuxtLink>
              </div>
              <div class="space-y-2 p-4">
                <p v-if="chatLoading" class="py-6 text-center text-sm text-zinc-500">Carregando mensagens…</p>
                <p v-else-if="!chatMessages.length" class="py-6 text-center text-sm text-zinc-500">Nenhuma mensagem nesta conversa.</p>
                <div v-for="m in chatMessages" :key="m.id" class="flex" :class="m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'">
                  <div class="max-w-[72%] rounded-xl px-3 py-2 text-sm leading-relaxed" :class="m.direction === 'OUTBOUND' ? 'bg-blue-900 text-white' : 'bg-zinc-800 text-zinc-100'">
                    <p class="whitespace-pre-line">{{ m.content || `[${m.type.toLowerCase()}]` }}</p>
                    <p class="mt-1 text-right text-[11px] text-zinc-400">{{ formatDateTime(m.createdAt) }}</p>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- Produtos -->
          <template v-else>
            <div class="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
              <table class="w-full border-collapse text-sm">
                <thead>
                  <tr class="text-left text-xs text-zinc-400">
                    <th scope="col" class="border-b border-zinc-800 px-4 py-3 font-medium">Item</th>
                    <th scope="col" class="w-24 border-b border-zinc-800 px-3 py-3 text-right font-medium">Qtd.</th>
                    <th scope="col" class="w-36 border-b border-zinc-800 px-3 py-3 text-right font-medium">Preço unit.</th>
                    <th scope="col" class="w-36 border-b border-zinc-800 px-3 py-3 text-right font-medium">Subtotal</th>
                    <th scope="col" class="w-12 border-b border-zinc-800"><span class="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(p, i) in productsDraft" :key="i">
                    <td class="border-b border-zinc-800/70 px-2 py-1.5"><input v-model="p.name" aria-label="Produto" class="h-9 w-full rounded-lg bg-transparent px-2 text-white outline-none focus:bg-zinc-950"></td>
                    <td class="border-b border-zinc-800/70 px-2 py-1.5"><input v-model.number="p.qty" aria-label="Quantidade" type="number" min="1" class="h-9 w-full rounded-lg bg-transparent px-2 text-right tabular-nums text-white outline-none focus:bg-zinc-950"></td>
                    <td class="border-b border-zinc-800/70 px-2 py-1.5"><input v-model.number="p.price" aria-label="Preço unitário" type="number" min="0" step="0.01" class="h-9 w-full rounded-lg bg-transparent px-2 text-right tabular-nums text-white outline-none focus:bg-zinc-950"></td>
                    <td class="border-b border-zinc-800/70 px-3 py-1.5 text-right tabular-nums text-zinc-200">{{ formatBRL((Number(p.qty) || 0) * (Number(p.price) || 0)) }}</td>
                    <td class="border-b border-zinc-800/70 pr-2">
                      <button type="button" :aria-label="`Remover ${p.name || 'produto'}`" class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-white" @click="productsDraft.splice(i, 1)">
                        <Trash2 :size="14" />
                      </button>
                    </td>
                  </tr>
                  <tr v-if="!productsDraft.length">
                    <td colspan="5" class="px-4 py-8 text-center text-sm text-zinc-500">Nenhum produto adicionado.</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" class="px-4 py-3">
                      <button type="button" class="flex items-center gap-1.5 text-sm text-blue-300 hover:text-blue-200" @click="productsDraft.push({ name: '', qty: 1, price: 0 })">
                        <Plus :size="14" /> Adicionar produto
                      </button>
                    </td>
                    <td class="px-3 py-3 text-right font-semibold tabular-nums text-white">{{ formatBRL(productsTotal) }}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              <div class="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-800 px-4 py-3">
                <label class="flex items-center gap-2 text-xs text-zinc-300">
                  <input v-model="syncValueWithProducts" type="checkbox" class="h-4 w-4 accent-blue-600">
                  Atualizar o valor do negócio com o total
                </label>
                <button type="button" :disabled="savingProducts" class="h-9 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50" @click="saveProducts">
                  {{ savingProducts ? 'Salvando…' : 'Salvar produtos' }}
                </button>
              </div>
            </div>
          </template>
        </section>

        <!-- Lateral -->
        <aside class="space-y-4">
          <section v-if="deal.contact" class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div class="flex items-center gap-3">
              <span class="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold" :class="personTone(deal.contact.id)">
                {{ personInitials(deal.contact.name ?? deal.contact.phoneNumber) }}
              </span>
              <div class="min-w-0 flex-1">
                <h2 class="truncate text-[15px] font-semibold text-white">{{ deal.contact.name || deal.contact.phoneNumber }}</h2>
                <p class="text-xs tabular-nums text-zinc-400">{{ deal.contact.phoneNumber }}</p>
              </div>
              <NuxtLink :to="`/contacts?id=${deal.contact.id}`" class="flex min-h-[32px] items-center text-xs text-blue-300 hover:text-blue-200">Ver contato</NuxtLink>
            </div>
            <dl class="mt-3.5 grid grid-cols-[100px_1fr] gap-y-2 text-sm">
              <dt class="text-zinc-400">LGPD</dt>
              <dd class="flex items-center gap-1.5" :class="consent.tone">
                <ShieldCheck :size="14" /> {{ consent.label }}
              </dd>
              <template v-if="deal.conversation?.csatScore">
                <dt class="text-zinc-400">CSAT</dt>
                <dd class="text-zinc-200">{{ deal.conversation.csatScore }}/5 na conversa</dd>
              </template>
            </dl>
          </section>

          <section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div class="mb-2 flex items-center justify-between">
              <h2 class="text-sm font-semibold text-white">Tarefas</h2>
              <span class="text-xs text-zinc-400">{{ tasks.filter((t) => t.doneAt).length }} de {{ tasks.length }} concluídas</span>
            </div>
            <ul class="space-y-0.5">
              <li v-for="t in tasks" :key="t.id">
                <label class="flex cursor-pointer items-start gap-2.5 py-2">
                  <input type="checkbox" class="mt-0.5 h-[18px] w-[18px] shrink-0 accent-blue-600" :checked="!!t.doneAt" @change="toggleTask(t)">
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm" :class="t.doneAt ? 'text-zinc-500 line-through' : 'text-white'">{{ t.title || ACTIVITY_TYPES[t.type]?.label }}</span>
                    <span class="block text-xs" :class="!t.doneAt && isOverdue(t.dueAt) ? 'text-red-300' : 'text-zinc-400'">
                      {{ ACTIVITY_TYPES[t.type]?.label }} · {{ t.doneAt ? 'concluída' : formatDue(t.dueAt) }}<template v-if="t.assignee"> · {{ t.assignee.name }}</template>
                    </span>
                  </span>
                </label>
              </li>
            </ul>
            <p v-if="!tasks.length" class="py-2 text-sm text-zinc-500">Nenhuma tarefa agendada.</p>
            <button type="button" class="mt-1 h-9 w-full rounded-lg border border-dashed border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800" @click="startSchedule">
              + Nova tarefa
            </button>
          </section>

          <section class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <h2 class="mb-3 text-sm font-semibold text-white">Detalhes</h2>
            <div class="space-y-3 text-sm">
              <label class="block">
                <span class="mb-1 block text-xs text-zinc-400">Previsão de fechamento</span>
                <input
                  type="date"
                  :value="deal.expectedCloseDate ? deal.expectedCloseDate.slice(0, 10) : ''"
                  class="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-white outline-none [color-scheme:dark] focus:border-blue-500"
                  @change="onCloseDateChange"
                >
              </label>
              <label class="block">
                <span class="mb-1 block text-xs text-zinc-400">Origem</span>
                <input
                  :value="deal.source ?? ''"
                  maxlength="200"
                  placeholder="Ex.: Indicação"
                  class="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                  @change="patch({ source: ($event.target as HTMLInputElement).value.trim() || null })"
                >
              </label>
              <div>
                <span class="mb-1 block text-xs text-zinc-400">Etiquetas</span>
                <div class="flex flex-wrap gap-1.5">
                  <span v-for="tag in deal.tags" :key="tag" class="flex items-center gap-1 rounded-full bg-zinc-800 py-0.5 pl-2.5 pr-1 text-xs text-zinc-200">
                    {{ tag }}
                    <button type="button" :aria-label="`Remover etiqueta ${tag}`" class="rounded-full p-0.5 text-zinc-500 hover:text-white" @click="patch({ tags: deal.tags.filter((x) => x !== tag) })">
                      <X :size="11" />
                    </button>
                  </span>
                  <input
                    v-model="tagDraft"
                    aria-label="Nova etiqueta"
                    placeholder="+ etiqueta"
                    maxlength="50"
                    class="h-7 w-24 rounded-full border border-dashed border-zinc-700 bg-transparent px-2.5 text-xs text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                    @keydown.enter.prevent="addTag"
                  >
                </div>
              </div>
            </div>
            <button type="button" class="mt-4 flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200" @click="removeDeal">
              <Trash2 :size="13" /> Excluir negócio
            </button>
          </section>
        </aside>
      </div>
    </template>

    <CrmLostDealModal :deal="showLost ? deal : null" @close="showLost = false" @lost="onLost" />
  </div>
</template>

<script setup lang="ts">
import {
  ArrowLeft, CalendarPlus, Check, MessageSquare, Pencil, Phone, Plus, RotateCcw,
  ShieldCheck, StickyNote, Trash2, Trophy, X, XCircle,
} from "lucide-vue-next"
import { useApi } from "../../../composables/useApi"
import {
  ACTIVITY_TYPES, CHANNELS, daysSince, formatBRL, formatDate, formatDateTime, formatDue,
  isOverdue, localInputToIso, personInitials, personTone, apiErrorMessage,
  type Deal, type DealActivity, type Member, type PipelineStage,
} from "../../../composables/useCrm"

definePageMeta({ middleware: "auth" })

type DealDetail = Deal & {
  activities: DealActivity[]
  pipeline: { id: string; name: string; stages: PipelineStage[] }
  contact: (Deal["contact"] & { optOut?: boolean; consentGivenAt?: string | null }) | null
  conversation: (Deal["conversation"] & { csatScore?: number | null }) | null
}

const COMPOSER_KINDS = [
  { value: "note",     label: "Nota",     icon: StickyNote },
  { value: "call",     label: "Ligação",  icon: Phone },
  { value: "schedule", label: "Agendar",  icon: CalendarPlus },
] as const

const TASK_OPTIONS = ["TASK", "CALL", "WHATSAPP", "MEETING", "VISIT"]

const api = useApi()
const route = useRoute()
const authStore = useAuthStore()
const dealId = computed(() => String(route.params.id))

const deal = ref<DealDetail | null>(null)
const members = ref<Member[]>([])
const loading = ref(true)
const loadError = ref("")
const tab = ref<"timeline" | "chat" | "products">("timeline")
const showLost = ref(false)

const editingTitle = ref(false)
const titleDraft = ref("")
const titleInput = ref<HTMLInputElement | null>(null)
const editingValue = ref(false)
const valueDraft = ref<number | null>(null)
const valueInput = ref<HTMLInputElement | null>(null)
const tagDraft = ref("")

const composer = reactive({
  kind: "note" as "note" | "call" | "schedule",
  content: "",
  title: "",
  taskType: "TASK",
  dueAt: "",
  assigneeId: "",
})
const savingActivity = ref(false)

const productsDraft = ref<{ name: string; qty: number; price: number }[]>([])
const syncValueWithProducts = ref(true)
const savingProducts = ref(false)

const chatMessages = ref<any[]>([])
const chatLoading = ref(false)

useHead({ title: () => deal.value?.title ?? "Negócio" })

// ── Derived ───────────────────────────────────────────────────────────────────

const stages = computed(() => deal.value?.pipeline.stages ?? [])
const currentIndex = computed(() => stages.value.findIndex((s) => s.id === deal.value?.stageId))
const currentStage = computed(() => stages.value[currentIndex.value])
const pipelineName = computed(() => deal.value?.pipeline.name ?? "")
const statusLabel = computed(() =>
  deal.value?.status === "LOST" ? "Perdido" : currentStage.value?.name ?? ""
)
const tabs = computed(() => [
  { value: "timeline" as const, label: "Linha do tempo" },
  ...(deal.value?.conversationId ? [{ value: "chat" as const, label: "Conversa" }] : []),
  { value: "products" as const, label: `Produtos (${deal.value?.products.length ?? 0})` },
])
const timeline = computed(() => deal.value?.activities ?? [])
const tasks = computed(() =>
  (deal.value?.activities ?? [])
    .filter((a) => a.dueAt)
    .sort((a, b) => Number(!!a.doneAt) - Number(!!b.doneAt) || new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
)
const productsTotal = computed(() =>
  productsDraft.value.reduce((sum, p) => sum + (Number(p.qty) || 0) * (Number(p.price) || 0), 0)
)
const consent = computed(() => {
  const c = deal.value?.contact
  if (c?.optOut) return { label: "Bloqueado (opt-out)", tone: "text-red-300" }
  if (c?.consentGivenAt) return { label: "Consentimento registrado", tone: "text-emerald-300" }
  return { label: "Sem consentimento registrado", tone: "text-zinc-400" }
})

const composerPlaceholder = computed(() => ({
  note: "Escreva uma nota interna sobre o negócio…",
  call: "Resumo da ligação…",
  schedule: "Detalhes da tarefa (opcional)…",
}[composer.kind]))
const composerHint = computed(() => ({
  note: "Visível apenas para a equipe",
  call: "Fica registrada como ligação realizada agora",
  schedule: "Aparece em Tarefas para o responsável",
}[composer.kind]))
const composerCta = computed(() => ({ note: "Salvar nota", call: "Registrar ligação", schedule: "Agendar tarefa" }[composer.kind]))
const canSubmitComposer = computed(() =>
  composer.kind === "schedule" ? !!composer.title.trim() && !!composer.dueAt : !!composer.content.trim()
)

function activityTitle(a: DealActivity) {
  if (a.title) return a.title
  if (a.type === "NOTE") return "Nota"
  if (a.type === "CALL") return "Ligação registrada"
  return ACTIVITY_TYPES[a.type]?.label ?? "Atividade"
}

// ── Load ──────────────────────────────────────────────────────────────────────

async function load() {
  try {
    const [d, m] = await Promise.all([
      api<DealDetail>(`/crm/deals/${dealId.value}`),
      members.value.length ? Promise.resolve(members.value) : api<Member[]>("/crm/members"),
    ])
    deal.value = d
    members.value = m
    productsDraft.value = (d.products ?? []).map((p) => ({ ...p }))
    if (!composer.assigneeId) composer.assigneeId = d.ownerId ?? authStore.user?.id ?? m[0]?.id ?? ""
  } catch (err) {
    deal.value = null
    loadError.value = apiErrorMessage(err, "Não foi possível carregar o negócio.")
  } finally {
    loading.value = false
  }
}

async function loadChat() {
  if (!deal.value?.conversationId) return
  chatLoading.value = true
  try {
    const conv = await api<any>(`/conversations/${deal.value.conversationId}`)
    chatMessages.value = (conv.messages ?? []).filter((m: any) => !m.isInternal && m.type !== "SYSTEM").slice(-20)
  } catch {
    chatMessages.value = []
  } finally {
    chatLoading.value = false
  }
}

function selectTab(value: "timeline" | "chat" | "products") {
  tab.value = value
  if (value === "chat" && !chatMessages.value.length) loadChat()
}

// ── Mutations ─────────────────────────────────────────────────────────────────

async function patch(body: Record<string, unknown>) {
  if (!deal.value) return
  try {
    deal.value = await api<DealDetail>(`/crm/deals/${deal.value.id}`, { method: "PATCH", body })
  } catch (err) {
    alert(apiErrorMessage(err, "Não foi possível salvar."))
  }
}

function startEditTitle() {
  titleDraft.value = deal.value?.title ?? ""
  editingTitle.value = true
  nextTick(() => titleInput.value?.focus())
}

async function saveTitle() {
  if (!editingTitle.value) return
  editingTitle.value = false
  const title = titleDraft.value.trim()
  if (title && title !== deal.value?.title) await patch({ title })
}

function startEditValue() {
  valueDraft.value = deal.value?.value ?? 0
  editingValue.value = true
  nextTick(() => valueInput.value?.focus())
}

async function saveValue() {
  if (!editingValue.value) return
  editingValue.value = false
  const value = Number(valueDraft.value)
  if (!Number.isNaN(value) && value >= 0 && value !== deal.value?.value) await patch({ value })
}

function onCloseDateChange(e: Event) {
  const v = (e.target as HTMLInputElement).value
  patch({ expectedCloseDate: v ? new Date(`${v}T12:00:00`).toISOString() : null })
}

function addTag() {
  const tag = tagDraft.value.trim()
  tagDraft.value = ""
  if (!tag || !deal.value || deal.value.tags.includes(tag)) return
  patch({ tags: [...deal.value.tags, tag] })
}

async function move(stageId: string) {
  if (!deal.value || (stageId === deal.value.stageId && deal.value.status === "OPEN")) return
  try {
    deal.value = await api<DealDetail>(`/crm/deals/${deal.value.id}/move`, { method: "POST", body: { stageId } })
  } catch (err) {
    alert(apiErrorMessage(err, "Não foi possível mover o negócio."))
  }
}

async function markWon() {
  if (!deal.value) return
  try {
    deal.value = await api<DealDetail>(`/crm/deals/${deal.value.id}/won`, { method: "POST" })
  } catch (err) {
    alert(apiErrorMessage(err, "Não foi possível marcar como ganho."))
  }
}

function onLost(updated: Deal) {
  showLost.value = false
  deal.value = updated as DealDetail
}

async function reopen() {
  if (!deal.value) return
  try {
    deal.value = await api<DealDetail>(`/crm/deals/${deal.value.id}/reopen`, { method: "POST" })
  } catch (err) {
    alert(apiErrorMessage(err, "Não foi possível reabrir."))
  }
}

async function removeDeal() {
  if (!deal.value) return
  if (!confirm(`Excluir o negócio "${deal.value.title}"? O histórico será apagado.`)) return
  try {
    await api(`/crm/deals/${deal.value.id}`, { method: "DELETE" })
    await navigateTo(`/crm/pipeline?pipeline=${deal.value.pipelineId}`)
  } catch (err) {
    alert(apiErrorMessage(err, "Não foi possível excluir."))
  }
}

function startSchedule() {
  tab.value = "timeline"
  composer.kind = "schedule"
}

async function addActivity() {
  if (!deal.value || !canSubmitComposer.value) return
  savingActivity.value = true
  try {
    const body = composer.kind === "schedule"
      ? {
          type: composer.taskType,
          title: composer.title.trim(),
          content: composer.content.trim() || undefined,
          dueAt: localInputToIso(composer.dueAt),
          assigneeId: composer.assigneeId || null,
        }
      : { type: composer.kind === "call" ? "CALL" : "NOTE", content: composer.content.trim() }
    await api(`/crm/deals/${deal.value.id}/activities`, { method: "POST", body })
    composer.content = ""
    composer.title = ""
    composer.dueAt = ""
    await load()
  } catch (err) {
    alert(apiErrorMessage(err, "Não foi possível salvar o registro."))
  } finally {
    savingActivity.value = false
  }
}

async function toggleTask(t: DealActivity) {
  const done = !t.doneAt
  t.doneAt = done ? new Date().toISOString() : null
  try {
    await api(`/crm/activities/${t.id}`, { method: "PATCH", body: { done } })
    await load()
  } catch {
    t.doneAt = done ? null : new Date().toISOString()
  }
}

async function saveProducts() {
  if (!deal.value) return
  savingProducts.value = true
  const products = productsDraft.value
    .filter((p) => p.name.trim())
    .map((p) => ({ name: p.name.trim(), qty: Number(p.qty) || 1, price: Number(p.price) || 0 }))
  await patch({ products, ...(syncValueWithProducts.value ? { value: productsTotal.value } : {}) })
  productsDraft.value = (deal.value?.products ?? []).map((p) => ({ ...p }))
  savingProducts.value = false
}

watch(dealId, () => {
  loading.value = true
  chatMessages.value = []
  tab.value = "timeline"
  load()
})

onMounted(load)
</script>
