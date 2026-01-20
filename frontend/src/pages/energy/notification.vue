<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
    admin: true,
  },
})

const loading = ref(false)
const settings = ref([])
const saving = ref({})

// Confirmation dialog
const showConfirmDialog = ref(false)
const settingToSave = ref(null)

// Snackbar for notifications
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

// Load notification settings
const loadSettings = async () => {
  loading.value = true
  try {
    const response = await api.post('/energy/notification/list', {
      module_id: 3,
    })
    
    if (response.data && Array.isArray(response.data)) {
      settings.value = response.data
    } else {
      console.error('Invalid response format:', response.data)
      showSnackbar('ไม่สามารถโหลดข้อมูลการตั้งค่าได้', 'error')
    }
  } catch (error) {
    console.error('Error loading settings:', error)
    showSnackbar('เกิดข้อผิดพลาดในการโหลดข้อมูลการตั้งค่า', 'error')
  } finally {
    loading.value = false
  }
}

// Show snackbar notification
const showSnackbar = (text, color = 'success') => {
  snackbarText.value = text
  snackbarColor.value = color
  snackbar.value = true
}

// Show confirmation dialog
const confirmSave = (setting) => {
  if (saving.value[setting.slug]) return
  settingToSave.value = setting
  showConfirmDialog.value = true
}

// Save individual setting
const saveSetting = async () => {
  if (!settingToSave.value) return
  
  const setting = settingToSave.value
  saving.value[setting.slug] = true
  showConfirmDialog.value = false
  
  try {
    const data = {
      [setting.slug]: setting.value,
    }
    
    const response = await api.post('/energy/notification/update', data)
    
    if (response.data.success) {
      showSnackbar('การตั้งค่าถูกบันทึกเรียบร้อยแล้ว', 'success')
    } else {
      showSnackbar('การบันทึกไม่สำเร็จ', 'error')
    }
  } catch (error) {
    console.error('Error saving setting:', error)
    showSnackbar('เกิดข้อผิดพลาดในการบันทึก', 'error')
  } finally {
    saving.value[setting.slug] = false
    settingToSave.value = null
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div>
    <!-- Page Header -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar
                size="64"
                color="primary"
                variant="flat"
              >
                <VIcon
                  size="32"
                  icon="tabler-bell"
                />
              </VAvatar>
              <div>
                <h4 class="text-h4 mb-1">
                  ตั้งค่าการแจ้งเตือน
                </h4>
                <p class="text-body-2 mb-0">
                  ตั้งค่าการแจ้งเตือนสำหรับพลังงานและสิ่งแวดล้อม
                </p>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Settings Form -->
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardItem>
            <VCardTitle>การตั้งค่าการแจ้งเตือน</VCardTitle>
            <VCardSubtitle>
              กำหนดค่าการแจ้งเตือนสำหรับพลังงานและสิ่งแวดล้อม
            </VCardSubtitle>
          </VCardItem>

          <VDivider />

          <VCardText>
            <!-- Loading State -->
            <div
              v-if="loading"
              class="text-center py-12"
            >
              <VProgressCircular
                indeterminate
                color="primary"
                size="64"
              />
              <div class="text-h6 mt-4">กำลังโหลดข้อมูล...</div>
            </div>

            <!-- Settings List -->
            <form
              v-else-if="settings.length > 0"
              id="settings-form"
            >
              <div
                v-for="setting in settings"
                :key="setting.slug"
                class="setting-item mb-4"
              >
                <label
                  :for="setting.slug"
                  class="text-body-1 font-weight-medium mb-2 d-block"
                >
                  {{ setting.name }}
                  <span
                    v-if="setting.unit"
                    class="text-caption text-disabled"
                  >
                    ({{ setting.unit }})
                  </span>
                </label>
                <div class="d-flex align-center gap-2">
                  <VTextField
                    :id="setting.slug"
                    v-model="setting.value"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="flex-grow-1"
                    placeholder="กรุณากรอกค่า"
                  />
                  <VBtn
                    color="success"
                    :loading="saving[setting.slug]"
                    size="small"
                    @click="confirmSave(setting)"
                  >
                    <VIcon
                      icon="tabler-device-floppy"
                      class="me-1"
                      size="18"
                    />
                    บันทึก
                  </VBtn>
                </div>
              </div>
            </form>

            <!-- Empty State -->
            <div
              v-else
              class="text-center py-12"
            >
              <VIcon
                icon="tabler-settings-off"
                size="64"
                class="text-disabled mb-4"
              />
              <div class="text-h6 text-disabled">
                ไม่พบการตั้งค่า
              </div>
              <div class="text-body-2 text-disabled mt-2">
                ไม่มีการตั้งค่าการแจ้งเตือนในระบบ
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Confirmation Dialog -->
    <VDialog
      v-model="showConfirmDialog"
      max-width="500"
    >
      <VCard>
        <VCardTitle class="d-flex align-center">
          <VIcon
            icon="tabler-alert-circle"
            color="warning"
            class="me-2"
          />
          ยืนยันการเปลี่ยนแปลง?
        </VCardTitle>
        <VCardText>
          คุณต้องการบันทึกการเปลี่ยนแปลงหรือไม่
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="showConfirmDialog = false"
          >
            ยกเลิก
          </VBtn>
          <VBtn
            color="primary"
            @click="saveSetting"
          >
            ใช่, บันทึกเลย!
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Snackbar for notifications -->
    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="top right"
    >
      {{ snackbarText }}
      <template #actions>
        <VBtn
          variant="text"
          @click="snackbar = false"
        >
          ปิด
        </VBtn>
      </template>
    </VSnackbar>
  </div>
</template>

<style scoped>
.setting-item {
  padding: 0.5rem 0;
}

#settings-form {
  padding: 1rem 0;
}
</style>

