export default defineNuxtConfig({
  modules: ["@pinia/nuxt", "@nuxtjs/tailwindcss"],

  runtimeConfig: {
    public: {
      apiUrl: process.env.API_URL ?? "http://localhost:3333",
    },
  },

  // Porta diferente da app do cliente (apps/client, porta 3000) —
  // as duas rodam ao mesmo tempo em desenvolvimento.
  devServer: {
    port: 3001,
  },

  devtools: { enabled: true },
})
