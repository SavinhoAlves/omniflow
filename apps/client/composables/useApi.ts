// composables/useApi.ts
import { useCookie, useRuntimeConfig, useRequestHeaders, navigateTo } from "#imports"

interface ApiOptions {
  method?: string
  body?: unknown
  headers?: HeadersInit
  [key: string]: unknown
}

// Compartilhado no escopo do módulo (não dentro de useApi()) de propósito:
// o dashboard dispara 4 requests em paralelo no mount (whatsapp/instances,
// departments, users, workflows/default) — se cada um tratasse o 401
// isoladamente, os 4 chamariam /auth/refresh ao mesmo tempo, gerando 4
// refresh tokens novos e invalidando uns aos outros na sequência errada
// (ver auth.service.ts: cada /auth/refresh troca o refresh token antigo por
// um novo). Uma única promise em voo garante que só a PRIMEIRA falha
// dispara o refresh; as outras 3 esperam o mesmo resultado.
let refreshInFlight: Promise<boolean> | null = null

function readTokenFromCookieHeader(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined
  const match = cookieHeader.match(/access_token=([^;]+)/)
  return match ? match[1] : undefined
}

function refreshAccessToken(apiUrl: string | undefined): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        // `credentials: include` é o que importa aqui — o refresh token
        // real é o cookie httpOnly `refresh_token`, o browser anexa
        // sozinho; não tem Authorization nem access_token nesta chamada.
        const response: any = await $fetch(`${apiUrl}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        })
        useCookie("access_token", { sameSite: "lax", httpOnly: false }).value = response.accessToken
        return true
      } catch {
        return false
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

export function useApi() {
  const config = useRuntimeConfig()
  const apiUrl = config.public.apiUrl as string | undefined

  async function request<T = unknown>(url: string, options: ApiOptions = {}, isRetry = false): Promise<T> {
    let token = useCookie("access_token").value

    // Fallback de SSR: no primeiro render no servidor não existe
    // `document.cookie` pra `useCookie` ler diretamente nesse contexto de
    // requisição — extrai do header cru da requisição original do browser.
    if (!token && import.meta.server) {
      token = readTokenFromCookieHeader(useRequestHeaders(["cookie"]).cookie)
    }

    const headers = new Headers(options.headers)
    if (token) headers.set("Authorization", `Bearer ${token}`)

    try {
      const httpMethod = (options.method ?? "GET").toUpperCase()
      const needsBody = ["POST", "PUT", "PATCH"].includes(httpMethod)
      // Always send at least {} for mutating requests without an explicit body.
      // Without a body, $fetch omits Content-Type entirely and Fastify returns 415.
      // With body:undefined explicitly passed, $fetch sends Content-Type:application/json
      // but an empty body, which Fastify rejects with FST_ERR_CTP_EMPTY_JSON_BODY.
      const body = options.body !== undefined ? options.body : needsBody ? {} : undefined

      return await $fetch<T>(url, {
        baseURL: apiUrl,
        credentials: "include",
        method: options.method as any,
        ...(body !== undefined && { body: body as any }),
        headers,
      })
    } catch (err: any) {
      const status = err?.response?.status ?? err?.statusCode

      // Só tenta refresh uma vez por chamada — se o request que já é um
      // retry voltar com 401 de novo, o refresh token também não é mais
      // válido, então cai direto pro redirect abaixo em vez de entrar num
      // loop de refresh→retry→401→refresh...
      if (status === 401 && !isRetry) {
        const refreshed = await refreshAccessToken(apiUrl)
        if (refreshed) return request<T>(url, options, true)
      }

      if (status === 401) {
        useCookie("access_token").value = null
        // Server-side (SSR) não tem sentido chamar navigateTo por conta
        // própria fora do ciclo de vida da rota — deixa o middleware
        // `auth.ts` (que roda antes de qualquer page) cuidar do redirect
        // na próxima navegação; aqui só garante que o cookie inválido não
        // fica pendurado tentando de novo.
        if (import.meta.client) {
          await navigateTo("/login")
        }
      }

      throw err
    }
  }

  return request
}
