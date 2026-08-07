import { useCookie, useRuntimeConfig, navigateTo } from "nuxt/app"

interface ApiOptions {
  method?: string
  body?: unknown
  headers?: HeadersInit
}

let refreshInFlight: Promise<boolean> | null = null

function refreshAccessToken(apiUrl: string): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response: any = await $fetch(`${apiUrl}/platform-auth/refresh`, {
          method: "POST",
          credentials: "include",
        })
        useCookie("platform_access_token", { sameSite: "lax", httpOnly: false }).value = response.accessToken
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
  const apiUrl = config.public.apiUrl as string

  async function request<T = unknown>(url: string, options: ApiOptions = {}, isRetry = false): Promise<T> {
    const token = useCookie("platform_access_token").value
    const headers = new Headers(options.headers)
    if (token) headers.set("Authorization", `Bearer ${token}`)

    try {
      return await $fetch<T>(url, {
        baseURL: apiUrl,
        credentials: "include",
        method: options.method as any,
        body: options.body as any,
        headers,
      })
    } catch (err: any) {
      const status = err?.response?.status ?? err?.statusCode

      if (status === 401 && !isRetry) {
        const refreshed = await refreshAccessToken(apiUrl)
        if (refreshed) return request<T>(url, options, true)
      }

      if (status === 401) {
        useCookie("platform_access_token").value = null
        await navigateTo("/login")
      }

      throw err
    }
  }

  return request
}
