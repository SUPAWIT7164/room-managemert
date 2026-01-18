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
  code: '',
  address: '',
  description: '',
})

const submit = async () => {
  loading.value = true
  try {
    await api.post('/buildings', form.value)
    router.push({ name: 'buildings-list' })
  } catch (error) {
    console.error('Error creating building:', error)
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
            สร้างอาคารใหม่
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
                    label="ชื่ออาคาร"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    v-model="form.code"
                    label="รหัสอาคาร"
                  />
                </VCol>
                <VCol cols="12">
                  <AppTextField
                    v-model="form.address"
                    label="ที่อยู่"
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
                    สร้างอาคาร
                  </VBtn>
                  <VBtn
                    variant="outlined"
                    class="ms-2"
                    :to="{ name: 'buildings-list' }"
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

