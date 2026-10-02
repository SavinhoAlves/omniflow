export default defineNuxtRouteMiddleware((to) => {

  const token = useCookie("access_token")


  if (!token.value) {

    // Guarda a página pedida para voltar a ela depois do login
    return navigateTo({ path: "/login", query: { redirect: to.fullPath } })

  }

})
