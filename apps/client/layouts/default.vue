<template>
  <div class="min-h-screen bg-zinc-950 text-white flex">
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <AppHeader />
      <main class="flex-1 p-6 overflow-auto">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()

onMounted(async () => {
  if (!authStore.user) {
    await authStore.fetchMe()
  }
})

const appName = computed(() => authStore.user?.companyName ?? 'OmniFlow')

useHead({
  titleTemplate: (title) => title ? `${title} · ${appName.value}` : appName.value,
})
</script>
