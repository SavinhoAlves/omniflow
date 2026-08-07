import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {

  state: () => ({
    user: null as null | {
      id: string
      name: string
      email: string
    }
  }),


  actions: {

    login(user: any) {
      this.user = user
    },


    logout() {
      this.user = null
    }

  }

})