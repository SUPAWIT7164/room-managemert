<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { requiredValidator } from '@core/utils/validators'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const rooms = ref([])

const form = ref({
  room_id: null,
  title: '',
  description: '',
  start_datetime: '',
  end_datetime: '',
  attendees: 1,
})

const fetchRooms = async () => {
  try {
    const response = await api.get('/rooms')
    rooms.value = response.data.data || []
  } catch (error) {
    console.error('Error fetching rooms:', error)
  }
}

const submit = async () => {
  loading.value = true
  try {
    await api.post('/bookings', form.value)
    router.push({ name: 'bookings-calendar' })
  } catch (error) {
    console.error('Error creating booking:', error)
  } finally {
    loading.value = false
  }
}

fetchRooms()
</script>

<template>
  <div>
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-plus"
              class="me-2"
            />
            จองห้องใหม่
          </VCardTitle>
          <VCardText>
            <VForm @submit.prevent="submit">
              <VRow>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppSelect
                    v-model="form.room_id"
                    label="ห้องประชุม"
                    :items="rooms.map(r => ({ title: r.name, value: r.id }))"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    v-model="form.title"
                    label="หัวข้อ"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol cols="12">
                  <AppTextarea
                    v-model="form.description"
                    label="รายละเอียด"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppDateTimePicker
                    v-model="form.start_datetime"
                    label="เวลาเริ่มต้น"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppDateTimePicker
                    v-model="form.end_datetime"
                    label="เวลาสิ้นสุด"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol cols="12">
                  <VBtn
                    type="submit"
                    color="primary"
                    :loading="loading"
                  >
                    จองห้อง
                  </VBtn>
                  <VBtn
                    variant="outlined"
                    class="ms-2"
                    :to="{ name: 'bookings-list' }"
                  >
                    ยกเลิก
                  </VBtn>
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

