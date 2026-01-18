<script setup>
import api from '@/utils/api'
import { useRouter } from 'vue-router'

const router = useRouter()
const notifications = ref([])

// Format datetime for notification display
const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Format time for notification subtitle
const formatTime = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Fetch pending bookings as notifications
const fetchBookingNotifications = async () => {
  try {
    const response = await api.get('/bookings', {
      params: {
        status: 'pending',
      },
    })
    
    const pendingBookings = response.data.data || []
    
    // Convert bookings to notifications
    notifications.value = pendingBookings.map(booking => ({
      id: booking.id,
      title: `มีการจองใหม่: ${booking.title || 'ไม่มีหัวข้อ'}`,
      subtitle: `${booking.room_name || 'ห้องไม่ระบุ'} - ${formatTime(booking.start_datetime)}`,
      time: formatDateTime(booking.start_datetime),
      isSeen: false,
      icon: 'tabler-calendar-event',
      color: 'primary',
      booking: booking, // Store full booking data for navigation
    }))
  } catch (error) {
    console.error('Error fetching booking notifications:', error)
    notifications.value = []
  }
}

// Refresh notifications periodically
let refreshInterval = null

onMounted(() => {
  fetchBookingNotifications()
  
  // Refresh every 30 seconds
  refreshInterval = setInterval(() => {
    fetchBookingNotifications()
  }, 30000)
})

onBeforeUnmount(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})

const removeNotification = notificationId => {
  notifications.value.forEach((item, index) => {
    if (notificationId === item.id)
      notifications.value.splice(index, 1)
  })
}

const markRead = notificationId => {
  notifications.value.forEach(item => {
    notificationId.forEach(id => {
      if (id === item.id)
        item.isSeen = true
    })
  })
}

const markUnRead = notificationId => {
  notifications.value.forEach(item => {
    notificationId.forEach(id => {
      if (id === item.id)
        item.isSeen = false
    })
  })
}

const handleNotificationClick = notification => {
  if (!notification.isSeen)
    markRead([notification.id])
  
  // Navigate to bookings page or pending approvals
  router.push('/pending-approvals')
}
</script>

<template>
  <Notifications
    :notifications="notifications"
    @remove="removeNotification"
    @read="markRead"
    @unread="markUnRead"
    @click:notification="handleNotificationClick"
  />
</template>
