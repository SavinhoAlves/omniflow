export default defineNuxtConfig({

  modules: [
    "@pinia/nuxt",
    "@nuxtjs/tailwindcss"
  ],

  css: [
    "@vue-flow/core/dist/style.css",
    "@vue-flow/core/dist/theme-default.css",
    "@vue-flow/controls/dist/style.css",
    "@vue-flow/minimap/dist/style.css",
  ],

  runtimeConfig: {
    public: {
      apiUrl:
        process.env.API_URL ?? "http://localhost:3333"
    }
  },

  devtools: {
    enabled: true
  }

})