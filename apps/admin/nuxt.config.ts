export default defineNuxtConfig({

  modules: [
    "@pinia/nuxt",
    "@nuxtjs/tailwindcss"
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