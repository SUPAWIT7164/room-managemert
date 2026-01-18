<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { requiredValidator } from '@core/utils/validators'
import api from '@/utils/api'

definePage({
  meta: {
    layout: 'blank',
  },
})

const router = useRouter()
const loading = ref(false)

const form = ref({
  name: '',
  email: '',
  phone: '',
  visit_date: '',
  purpose: '',
})

const submit = async () => {
  loading.value = true
  try {
    await api.post('/visitors', form.value)
    router.push({ name: 'visitors-list' })
  } catch (error) {
    console.error('Error registering visitor:', error)
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
              icon="tabler-user-plus"
              class="me-2"
            />
            ลงทะเบียนผู้เยี่ยมชม
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
                    label="ชื่อ-นามสกุล"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    v-model="form.email"
                    label="อีเมล"
                    type="email"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppTextField
                    v-model="form.phone"
                    label="เบอร์โทร"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppDatePicker
                    v-model="form.visit_date"
                    label="วันที่เยี่ยมชม"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol cols="12">
                  <AppTextarea
                    v-model="form.purpose"
                    label="วัตถุประสงค์"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol cols="12">
                  <VBtn
                    type="submit"
                    color="primary"
                    :loading="loading"
                  >
                    ลงทะเบียน
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

