import { storeToRefs } from 'pinia'
import { useTheme } from 'vuetify'
import { cookieRef, useLayoutConfigStore } from '@layouts/stores/config'
import { themeConfig } from '@themeConfig'

// SECTION Store
export const useConfigStore = defineStore('config', () => {
  // 👉 Theme
  const userPreferredColorScheme = usePreferredColorScheme()
  const cookieColorScheme = cookieRef('color-scheme', 'light')

  watch(userPreferredColorScheme, val => {
    if (val !== 'no-preference')
      cookieColorScheme.value = val
  }, { immediate: true })

  const theme = cookieRef('theme', 'light')

  // 👉 isVerticalNavSemiDark
  const isVerticalNavSemiDark = cookieRef('isVerticalNavSemiDark', themeConfig.verticalNav.isVerticalNavSemiDark)

  // 👉 isVerticalNavSemiDark
  const skin = cookieRef('skin', themeConfig.app.skin)

  // ℹ️ We need to use `storeToRefs` to forward the state
  const { isLessThanOverlayNavBreakpoint, appContentWidth, navbarType, isNavbarBlurEnabled, appContentLayoutNav, isVerticalNavCollapsed, footerType, isAppRTL } = storeToRefs(useLayoutConfigStore())
  
  return {
    theme,
    isVerticalNavSemiDark,
    skin,

    // @layouts exports
    isLessThanOverlayNavBreakpoint,
    appContentWidth,
    navbarType,
    isNavbarBlurEnabled,
    appContentLayoutNav,
    isVerticalNavCollapsed,
    footerType,
    isAppRTL,
  }
})
// !SECTION
// SECTION Init
export const initConfigStore = () => {
  const userPreferredColorScheme = usePreferredColorScheme()
  const vuetifyTheme = useTheme()
  const configStore = useConfigStore()

  // ตั้ง default เป็น Light: ถ้าเคยใช้ system ให้ใช้ light แทน
  if (configStore.theme === 'system') {
    configStore.theme = 'light'
  }

  watch([() => configStore.theme, userPreferredColorScheme], () => {
    const themetoUpdate = configStore.theme === 'system'
      ? userPreferredColorScheme.value === 'dark'
        ? 'dark'
        : 'light'
      : configStore.theme

    vuetifyTheme.change(themetoUpdate)
  })
  onMounted(() => {
    if (configStore.theme === 'system')
      vuetifyTheme.change(userPreferredColorScheme.value)
    else
      vuetifyTheme.change(configStore.theme)
  })
}
// !SECTION
