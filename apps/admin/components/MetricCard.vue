<template>

<div
  class="
    bg-zinc-900
    border
    border-zinc-800
    rounded-2xl
    p-6
    hover:border-zinc-700
    transition
  "
>


<div class="flex justify-between items-start">


<div>

<p class="text-sm text-zinc-400">
{{ title }}
</p>


<h2 class="text-3xl font-bold text-white mt-3">
{{ value }}
</h2>

</div>


<div
class="
bg-blue-500/10
text-blue-400
rounded-xl
p-3
"
>

<component
:is="icon"
:size="24"
/>

</div>


</div>


<p class="mt-5 text-sm text-green-400">
{{ description }}
</p>


</div>


</template>


<script setup lang="ts">

defineProps<{

title:string

value:string

description:string

icon:any

}>()

</script>