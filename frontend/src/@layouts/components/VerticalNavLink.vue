<script setup>
import { resolveComponent } from 'vue'
import { VIcon } from 'vuetify/components'
import { layoutConfig } from '@layouts'
import { can } from '@layouts/plugins/casl'
import { useLayoutConfigStore } from '@layouts/stores/config'
import { useAuthStore } from '@/stores/auth'
import {
  getComputedNavLinkToProp,
  getDynamicI18nProps,
  isNavLinkActive,
} from '@layouts/utils'

const props = defineProps({
  item: {
    type: null,
    required: true,
  },
})

const configStore = useLayoutConfigStore()
const hideTitleAndBadge = configStore.isVerticalNavMini()
const authStore = useAuthStore()

// Resolve icon component
const iconComponent = computed(() => {
  const renderer = layoutConfig.app.iconRenderer
  if (typeof renderer === 'string') {
    if (renderer === 'VIcon') {
      return VIcon
    }
    try {
      return resolveComponent(renderer)
    } catch {
      return renderer
    }
  }
  return renderer || VIcon
})

// Get icon props
const iconProps = computed(() => {
  const item = props.item
  if (item.icon && typeof item.icon === 'object' && item.icon !== null) {
    return item.icon
  }
  if (item.icon) {
    return { icon: item.icon }
  }
  return layoutConfig.verticalNav.defaultNavItemIconProps || {}
})

// Check role-based access
const canViewItem = computed(() => {
  const item = props.item
  const meta = item.meta || {}
  
  // Check admin requirement
  if (meta.admin && !authStore.isAdmin)
    return false
  
  // Check approver requirement
  if (meta.approver && !authStore.isApprover)
    return false
  
  // Check CASL permissions if defined
  if (item.action && item.subject)
    return can(item.action, item.subject)
  
  return true
})
</script>

<template>
  <li
    v-if="canViewItem"
    class="nav-link"
    :class="{ disabled: item.disable }"
  >
    <Component
      :is="item.to ? 'RouterLink' : 'a'"
      v-bind="getComputedNavLinkToProp(item)"
      :class="{
        'router-link-active router-link-exact-active': isNavLinkActive(
          item,
          $router,
        ),
      }"
    >
      <VIcon
        v-if="iconProps.icon"
        :icon="iconProps.icon"
        :size="iconProps.size || 'default'"
        class="nav-item-icon"
      />
      <Component
        v-else
        :is="iconComponent"
        v-bind="iconProps"
        class="nav-item-icon"
      />
      <TransitionGroup name="transition-slide-x">
        <!-- 👉 Title -->
        <Component
          :is="getDynamicI18nProps(item.title, 'span').keypath ? 'i18n-t' : 'span'"
          v-show="!hideTitleAndBadge"
          key="title"
          class="nav-item-title"
          v-bind="getDynamicI18nProps(item.title, 'span')"
        >
          {{ item.title }}
        </Component>

        <!-- 👉 Badge -->
        <Component
          :is="getDynamicI18nProps(item.badgeContent, 'span').keypath ? 'i18n-t' : 'span'"
          v-if="item.badgeContent"
          v-show="!hideTitleAndBadge"
          key="badge"
          class="nav-item-badge"
          :class="item.badgeClass"
          v-bind="getDynamicI18nProps(item.badgeContent, 'span')"
        >
          {{ item.badgeContent }}
        </Component>
      </TransitionGroup>
    </Component>
  </li>
</template>

<style lang="scss">
.layout-vertical-nav {
  .nav-link a {
    display: flex;
    align-items: center;
  }
}
</style>
