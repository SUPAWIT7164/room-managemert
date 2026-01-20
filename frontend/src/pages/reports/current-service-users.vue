<script setup>
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
    admin: true,
  },
})

const router = useRouter()
const loading = ref(false)
const serviceUsers = ref([])
const pagination = ref({
  page: 1,
  limit: 15,
  total: 0,
  totalPages: 0
})
const selectedDevice = ref('all')
const devices = ref(['all', 'PeopleCam/CAM-F-02', 'PeopleCam/CAM-F-01'])

// Format date to Thai format
const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const day = date.getDate()
  const month = thaiMonths[date.getMonth()]
  const year = date.getFullYear() + 543 // Convert to Buddhist year
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day} ${month} ${year} ${hours}:${minutes}`
}

// Get image URL from processed images, CCTV, or user image
const getImageUrl = (item) => {
  if (!item) return null
  
  if (item.image) {
    // If it's already a data URL
    if (item.image.startsWith('data:')) {
      return item.image
    }
    // If it's a base64 string (without data: prefix)
    if (item.image.startsWith('/9j/') || (item.image.length > 100 && !item.image.startsWith('http') && !item.image.startsWith('/'))) {
      return `data:image/jpeg;base64,${item.image}`
    }
    // If it's a relative URL (processed-images or other paths)
    if (item.image.startsWith('/processed-images/') || (item.image.startsWith('/') && !item.image.startsWith('/api'))) {
      // Prepend backend base URL (without /api)
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
      const backendBaseUrl = apiBaseUrl.replace('/api', '')
      const fullUrl = `${backendBaseUrl}${item.image}`
      console.log(`[getImageUrl] Processed image URL: ${fullUrl}`)
      return fullUrl
    }
    // If it's a full URL
    if (item.image.startsWith('http')) {
      return item.image
    }
    // If it's a URL path starting with /api
    if (item.image.startsWith('/api')) {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
      const backendBaseUrl = apiBaseUrl.replace('/api', '')
      return `${backendBaseUrl}${item.image}`
    }
    // Return as is
    console.log(`[getImageUrl] Returning image as is: ${item.image}`)
    return item.image
  }
  
  // If camera_id exists, try to get image from CCTV
  if (item.camera_id) {
    // Return CCTV snapshot URL with timestamp to prevent caching
    const timestamp = new Date().getTime()
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
    const backendBaseUrl = apiBaseUrl.replace('/api', '')
    return `${backendBaseUrl}/api/cctv/snapshot?cameraId=${item.camera_id}&t=${timestamp}`
  }
  
  // Fallback to default image
  console.log(`[getImageUrl] No image found for item:`, item)
  return null
}

// Load current service users
const loadServiceUsers = async (silent = false) => {
  // Skip if already loading to prevent multiple simultaneous requests
  if (loading.value) {
    return
  }
  
  loading.value = true
  try {
    const response = await api.get('/service-users/current', {
      params: {
        device: selectedDevice.value,
        page: pagination.value.page,
        limit: pagination.value.limit
      }
    })
    
    if (!silent) {
      console.log('Service users response:', response.data)
    }
    
    if (response.data.success) {
      const data = response.data.data || []
      
      // Only update if data actually changed to prevent unnecessary re-renders
      const currentDataStr = JSON.stringify(serviceUsers.value.map(u => u.id))
      const newDataStr = JSON.stringify(data.map(u => u.id))
      const dataChanged = currentDataStr !== newDataStr
      
      if (dataChanged || serviceUsers.value.length === 0) {
        serviceUsers.value = data
        pagination.value = {
          ...pagination.value,
          ...response.data.pagination
        }
        
        if (!silent) {
          console.log(`Loaded ${serviceUsers.value.length} service users`)
        }
      }
    }
  } catch (error) {
    if (!silent) {
      console.error('Error loading service users:', error)
      console.error('Error details:', error.response?.data || error.message)
    }
  } finally {
    loading.value = false
  }
}

// Handle page change
const handlePageChange = (page) => {
  pagination.value.page = page
  loadServiceUsers()
}

// Handle device filter change
const handleDeviceChange = () => {
  pagination.value.page = 1
  loadServiceUsers()
}

// View history
const viewHistory = () => {
  router.push('/reports/service-usage')
}

// Handle image error
const handleImageError = (event) => {
  console.error('Image load error:', event)
  console.error('Failed image URL:', event.target?.src)
  // You can set a fallback image here if needed
}

// Server-Sent Events for real-time updates
let eventSource = null

onMounted(() => {
  loadServiceUsers()
  
  // Connect to Server-Sent Events for real-time updates
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
  const authStore = useAuthStore()
  const token = authStore.token || localStorage.getItem('token') || sessionStorage.getItem('token')
  
  // Create EventSource connection (token in query parameter for EventSource compatibility)
  const eventSourceUrl = token 
    ? `${apiBaseUrl.replace('/api', '')}/api/service-users/updates?token=${encodeURIComponent(token)}`
    : `${apiBaseUrl.replace('/api', '')}/api/service-users/updates`
  
  eventSource = new EventSource(eventSourceUrl)
  
  eventSource.onopen = () => {
    console.log('[SSE] Connected to service users updates')
  }
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      console.log('[SSE] Received update:', data)
      
      if (data.type === 'new_entry') {
        // Reload data when someone enters the area
        console.log('[SSE] New entry detected, reloading data...', data)
        // Small delay to ensure file is fully written
        setTimeout(() => {
          loadServiceUsers(true) // Silent reload
        }, 500)
      } else if (data.type === 'connected') {
        console.log('[SSE]', data.message)
      }
    } catch (error) {
      console.error('[SSE] Error parsing message:', error)
    }
  }
  
  eventSource.onerror = (error) => {
    console.error('[SSE] Connection error:', error)
    // Try to reconnect after 5 seconds
    setTimeout(() => {
      if (eventSource && eventSource.readyState === EventSource.CLOSED) {
        console.log('[SSE] Attempting to reconnect...')
        // Reconnect will be handled by EventSource automatically
      }
    }, 5000)
  }
})

// Cleanup on unmount
onBeforeUnmount(() => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
})
</script>

<template>
  <div>
    <!-- Breadcrumb -->
    <div class="mb-4">
      <div class="text-caption text-disabled">
        สถานะปัจจุบัน / ผู้ใช้เข้าใช้บริการปัจจุบัน
      </div>
    </div>

    <!-- Header -->
    <VCard class="mb-4">
      <VCardText>
        <div class="d-flex align-center justify-space-between">
          <div>
            <h2 class="text-h5 font-weight-bold">
              ผู้ใช้เข้าใช้บริการปัจจุบัน
            </h2>
          </div>
          <VBtn
            color="warning"
            variant="elevated"
            prepend-icon="tabler-history"
            @click="viewHistory"
          >
            ดูประวัติ
          </VBtn>
        </div>
      </VCardText>
    </VCard>

    <!-- Filter -->
    <VCard class="mb-4">
      <VCardText>
        <VSelect
          v-model="selectedDevice"
          :items="devices"
          label="ทุกอุปกรณ์"
          variant="outlined"
          density="compact"
          @update:model-value="handleDeviceChange"
        />
      </VCardText>
    </VCard>

    <!-- Data Table -->
    <VCard>
      <VTable>
        <thead>
          <tr>
            <th class="text-left">
              วันและเวลา
            </th>
            <th class="text-left">
              รูป
            </th>
            <th class="text-left">
              ชื่อ-นามสกุล
            </th>
            <th class="text-left">
              ประเภทบุคลากร
            </th>
            <th class="text-left">
              ประตู
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr
              v-for="n in 5"
              :key="`skeleton-${n}`"
            >
              <td>
                <VSkeletonLoader
                  type="text"
                  width="120"
                />
              </td>
              <td>
                <VSkeletonLoader
                  type="avatar"
                  width="50"
                  height="50"
                />
              </td>
              <td>
                <VSkeletonLoader
                  type="text"
                  width="150"
                />
              </td>
              <td>
                <VSkeletonLoader
                  type="text"
                  width="120"
                />
              </td>
              <td>
                <VSkeletonLoader
                  type="text"
                  width="150"
                />
              </td>
            </tr>
          </template>
          <template v-else-if="!loading && serviceUsers.length === 0">
            <tr>
              <td
                colspan="5"
                class="text-center py-8 text-disabled"
              >
                ไม่มีข้อมูลผู้ใช้เข้าใช้บริการ
              </td>
            </tr>
          </template>
          <template v-else>
            <tr
              v-for="user in serviceUsers"
              :key="user.id"
            >
            <td>
              {{ formatDate(user.date_time) }}
            </td>
            <td>
              <VAvatar
                v-if="getImageUrl(user)"
                size="50"
                class="border image-avatar"
              >
                <VImg
                  :src="getImageUrl(user)"
                  :alt="user.full_name || 'User'"
                  cover
                  @error="handleImageError"
                  @load="() => console.log('Image loaded:', getImageUrl(user))"
                />
              </VAvatar>
              <VAvatar
                v-else
                size="50"
                color="grey-lighten-2"
                class="border"
              >
                <VIcon
                  icon="tabler-user"
                  size="24"
                  color="grey"
                />
              </VAvatar>
            </td>
            <td>
              {{ user.full_name || 'Unknown' }}
            </td>
            <td>
              {{ user.personnel_type || 'ไม่ทราบข้อมูล' }}
            </td>
            <td>
              {{ user.door || 'ไม่ทราบข้อมูล' }}
            </td>
          </tr>
          </template>
        </tbody>
      </VTable>

      <!-- Pagination -->
      <VCardActions
        v-if="!loading && serviceUsers.length > 0"
        class="px-4 py-3"
      >
        <div class="text-caption text-disabled">
          แสดงผล {{ ((pagination.page - 1) * pagination.limit) + 1 }} ถึง {{ Math.min(pagination.page * pagination.limit, pagination.total) }} จาก {{ pagination.total }} รายการ
        </div>
        <VSpacer />
        <div class="d-flex align-center gap-2">
          <VBtn
            icon
            variant="text"
            size="small"
            :disabled="pagination.page === 1"
            @click="handlePageChange(pagination.page - 1)"
          >
            <VIcon icon="tabler-chevron-left" />
          </VBtn>
          <div class="d-flex align-center gap-1">
            <VBtn
              v-for="page in pagination.totalPages"
              :key="page"
              :variant="pagination.page === page ? 'elevated' : 'text'"
              :color="pagination.page === page ? 'warning' : 'default'"
              size="small"
              @click="handlePageChange(page)"
            >
              {{ page }}
            </VBtn>
          </div>
          <VBtn
            icon
            variant="text"
            size="small"
            :disabled="pagination.page === pagination.totalPages"
            @click="handlePageChange(pagination.page + 1)"
          >
            <VIcon icon="tabler-chevron-right" />
          </VBtn>
        </div>
      </VCardActions>
    </VCard>
  </div>
</template>

<style scoped>
.border {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.image-avatar {
  overflow: hidden;
}

.image-avatar :deep(img) {
  object-fit: cover;
  width: 100%;
  height: 100%;
  /* Apply grayscale filter to match the design */
  filter: grayscale(100%);
  /* Optional: enhance contrast */
  contrast: 1.1;
}
</style>

