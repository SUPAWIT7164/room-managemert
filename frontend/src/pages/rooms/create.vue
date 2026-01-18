<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { requiredValidator } from '@core/utils/validators'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
    admin: true,
  },
})

const router = useRouter()
const loading = ref(false)
const buildings = ref([])
const areas = ref([])

const form = ref({
  name: '',
  building_id: null,
  area_id: null,
  capacity: 10,
  description: '',
})

const fetchBuildings = async () => {
  try {
    const response = await api.get('/buildings')
    buildings.value = response.data.data || []
  } catch (error) {
    console.error('Error fetching buildings:', error)
  }
}

const fetchAreas = async () => {
  try {
    const response = await api.get('/areas')
    areas.value = response.data.data || []
  } catch (error) {
    console.error('Error fetching areas:', error)
  }
}

const submit = async () => {
  loading.value = true
  try {
    await api.post('/rooms', form.value)
    router.push({ name: 'rooms-list' })
  } catch (error) {
    console.error('Error creating room:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchBuildings()
  fetchAreas()
})
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
            สร้างห้องใหม่
          </VCardTitle>
          <VCardText>
            <VForm @submit.prevent="submit">
              <VRow>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    v-model="form.name"
                    label="ชื่อห้อง"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppSelect
                    v-model="form.building_id"
                    label="อาคาร"
                    :items="buildings.map(b => ({ title: b.name, value: b.id }))"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppSelect
                    v-model="form.area_id"
                    label="พื้นที่"
                    :items="areas.map(a => ({ title: a.name, value: a.id }))"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    v-model.number="form.capacity"
                    label="ความจุ"
                    type="number"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol cols="12">
                  <AppTextarea
                    v-model="form.description"
                    label="รายละเอียด"
                  />
                </VCol>
                <VCol cols="12">
                  <VBtn
                    type="submit"
                    color="primary"
                    :loading="loading"
                  >
                    สร้างห้อง
                  </VBtn>
                  <VBtn
                    variant="outlined"
                    class="ms-2"
                    :to="{ name: 'rooms-list' }"
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

