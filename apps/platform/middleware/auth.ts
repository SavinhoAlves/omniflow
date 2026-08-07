export default defineNuxtRouteMiddleware(() => {
  const token = useCookie("platform_access_token")

  if (!token.value) {
    return navigateTo("/login")
  }
})
