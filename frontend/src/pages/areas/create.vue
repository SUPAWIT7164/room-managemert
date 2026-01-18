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

const form = ref({
  name: '',
  building_id: null,
  floor: '',
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

const submit = async () => {
  loading.value = true
  try {
    await api.post('/areas', form.value)
    router.push({ name: 'areas-list' })
  } catch (error) {
    console.error('Error creating area:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchBuildings()
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
            สร้างพื้นที่ใหม่
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
                    label="ชื่อพื้นที่"
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
                  <AppTextField
                    v-model="form.floor"
                    label="ชั้น"
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
                    สร้างพื้นที่
                  </VBtn>
                  <VBtn
                    variant="outlined"
                    class="ms-2"
                    :to="{ name: 'areas-list' }"
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

