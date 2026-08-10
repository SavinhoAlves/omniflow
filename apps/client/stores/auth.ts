import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {

  state: () => ({
    user: null as null | {
      id: string
      name: string
      email: string
      role: string
      companyId: string
      companyName: string
      companySlug: string
      departmentIds: string[]
    }
  }),

  actions: {
    login(user: any) {
      this.user = user
    },

    logout() {
      this.user = null
    },

    async fetchMe() {
      try {
        const config = useRuntimeConfig()
        const token = useCookie('access_token').value
        if (!token) return
        const data: any = await $fetch(`${config.public.apiUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        })
        this.user = data
      } catch {}
    }
  }

})
