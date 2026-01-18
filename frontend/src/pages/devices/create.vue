<script setup>
import { ref } from 'vue'
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

const form = ref({
  name: '',
  type: '',
  description: '',
})

const submit = async () => {
  loading.value = true
  try {
    await api.post('/devices', form.value)
    router.push({ name: 'devices-list' })
  } catch (error) {
    console.error('Error creating device:', error)
  } finally {
    loading.value = false
  }
}
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
            สร้างอุปกรณ์ใหม่
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
                    label="ชื่ออุปกรณ์"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    v-model="form.type"
                    label="ประเภท"
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
                    สร้างอุปกรณ์
                  </VBtn>
                  <VBtn
                    variant="outlined"
                    class="ms-2"
                    :to="{ name: 'devices-list' }"
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

