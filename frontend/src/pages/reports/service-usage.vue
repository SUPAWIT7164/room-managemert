<script setup>
import { ref } from 'vue'
import { requiredValidator } from '@core/utils/validators'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
    admin: true,
  },
})

const loading = ref(false)
const reportData = ref(null)

const form = ref({
  start_date: '',
  end_date: '',
})

const generateReport = async () => {
  loading.value = true
  try {
    const response = await api.post('/reports/service-usage', form.value)
    reportData.value = response.data.data
  } catch (error) {
    console.error('Error generating report:', error)
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
              icon="tabler-graph-up"
              class="me-2"
            />
            รายงานการเข้าใช้บริการ
          </VCardTitle>
          <VCardText>
            <VForm @submit.prevent="generateReport">
              <VRow>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppDatePicker
                    v-model="form.start_date"
                    label="วันที่เริ่มต้น"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppDatePicker
                    v-model="form.end_date"
                    label="วันที่สิ้นสุด"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol cols="12">
                  <VBtn
                    type="submit"
                    color="primary"
                    :loading="loading"
                  >
                    สร้างรายงาน
                  </VBtn>
                </VCol>
              </VRow>
            </VForm>
            <div
              v-if="reportData"
              class="mt-6"
            >
              <h3>ผลรายงาน</h3>
              <p>รายงานการเข้าใช้บริการ</p>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>












