import { defineNuxtPlugin } from '#app';

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const apiUrl = config.public.apiUrl as string;

  const apiFetch = $fetch.create({
    baseURL: apiUrl,
    onRequest({ options }) {
      if (process.client) {
        const token = useCookie('access_token').value;
        if (token) {
          (options.headers as any)['Authorization'] = `Bearer ${token}`;
        }
      }
    },
    onResponseError({ response }) {
      if (response.status === 401 && process.client) {
        console.warn('Sessão expirada ou não autorizada. Redirecionando...');
      }
    },
  });

  return {
    provide: {
      api: apiFetch,
    },
  };
});