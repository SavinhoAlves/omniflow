import type { Config } from "tailwindcss"

// Só estende o padrão do @nuxtjs/tailwindcss. Tokens que não existem na
// paleta padrão do Tailwind (ver especificação da tela de login).
export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        surface: {
          brand: "#0c0c0e", // painel de marca
          input: "#111113", // fundo de campos
          card: "#141416",  // cards sobre o painel de marca
        },
        ink: {
          muted: "#8e8e98", // dicas e rodapé — 6:1 sobre zinc-950
        },
      },
    },
  },
}
