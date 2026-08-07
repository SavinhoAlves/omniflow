import { useCookie, useRuntimeConfig } from "nuxt/app"

export function useApi() {

  const config = useRuntimeConfig()

  return $fetch.create({

    baseURL: config.public.apiUrl as string | undefined,

    credentials: "include",

    onRequest({ options }) {
      const token = useCookie("access_token").value

      options.headers = new Headers(options.headers)
      if (token) {
        options.headers.set("Authorization", `Bearer ${token}`)
      }
    }

  })

}
