<template>

<div class="min-h-screen bg-zinc-950 text-white flex">


<AppSidebar />


<div class="flex-1 flex flex-col">


<AppHeader />


<main class="p-6">
<slot />
</main>


</div>


</div>

</template>