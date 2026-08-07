<template>
  <div class="h-screen bg-zinc-950 text-white flex overflow-hidden">
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <AppHeader />
      <div class="flex-1 overflow-hidden">
        <slot />
      </div>
    </div>
  </div>
</template>
