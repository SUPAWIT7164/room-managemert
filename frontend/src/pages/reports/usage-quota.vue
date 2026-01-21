<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
    admin: true,
  },
})

const loading = ref(false)
const quotaSettings = ref([])
const editedValues = reactive({})
const savingSettings = reactive({})

// Dialog and Snackbar states
const confirmDialog = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogText = ref('')
const confirmDialogSetting = ref(null)
const loadingDialog = ref(false)
const loadingDialogText = ref('')
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

const fetchQuotaSettings = async () => {
  loading.value = true
  try {
    const response = await api.get('/reports/usage-quota')
    const settings = response.data.data || []
    quotaSettings.value = settings
    
    // Initialize edited values with current values
    settings.forEach(setting => {
      editedValues[setting.id] = setting.value || ''
    })
  } catch (error) {
    console.error('Error fetching quota settings:', error)
    showSnackbar('ไม่สามารถโหลดข้อมูลการตั้งค่าโควตาได้: ' + (error.response?.data?.message || error.message), 'error')
  } finally {
    loading.value = false
  }
}

const showSnackbar = (text, color = 'success') => {
  snackbarText.value = text
  snackbarColor.value = color
  snackbar.value = true
}

const showConfirmDialog = (setting) => {
  confirmDialogTitle.value = 'ยืนยันการเปลี่ยนแปลง?'
  confirmDialogText.value = 'คุณต้องการบันทึกการเปลี่ยนแปลงหรือไม่'
  confirmDialogSetting.value = setting
  confirmDialog.value = true
}

const confirmSave = async () => {
  const setting = confirmDialogSetting.value
  confirmDialog.value = false
  
  // Show loading dialog
  loadingDialogText.value = 'กำลังบันทึก...'
  loadingDialog.value = true
  
  try {
    // Update single setting by slug
    const updates = {}
    updates[setting.slug] = editedValues[setting.id]
    
    const response = await api.post('/quotas/update', updates)
    
    // Close loading dialog
    loadingDialog.value = false
    
    // Check if response indicates success
    if (response.data && response.data.success) {
      // Update the setting in the list
      const index = quotaSettings.value.findIndex(s => s.id === setting.id)
      if (index !== -1) {
        quotaSettings.value[index].value = editedValues[setting.id]
      }
      
      // Show success message
      showSnackbar('การตั้งค่าถูกบันทึกเรียบร้อยแล้ว', 'success')
    } else {
      // Response was successful but success flag is false
      editedValues[setting.id] = setting.value || ''
      showSnackbar('การบันทึกไม่สำเร็จ', 'error')
    }
  } catch (error) {
    console.error('Error saving quota setting:', error)
    
    // Close loading dialog
    loadingDialog.value = false
    
    // Revert to original value on error
    editedValues[setting.id] = setting.value || ''
    
    // Show error message
    const errorMessage = error.response?.data?.message || error.message || 'เกิดข้อผิดพลาดในการบันทึก'
    showSnackbar(errorMessage, 'error')
  } finally {
    savingSettings[setting.id] = false
  }
}

const saveSetting = async (setting) => {
  // Check if value has changed
  if (editedValues[setting.id] === (setting.value || '')) {
    showSnackbar('ไม่มีการเปลี่ยนแปลงค่า', 'info')
    return
  }
  
  savingSettings[setting.id] = true
  
  // Show confirmation dialog
  showConfirmDialog(setting)
}

const hasChanges = (setting) => {
  return editedValues[setting.id] !== (setting.value || '')
}

onMounted(() => {
  fetchQuotaSettings()
})
</script>

<template>
  <div class="usage-quota-page">
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
                  icon="tabler-settings"
                />
              </VAvatar>
              <div>
                <h4 class="text-h4 mb-1">
                  ตั้งค่าโควต้าการใช้งาน
                </h4>
                <p class="text-body-2 mb-0">
                  จัดการและตั้งค่าโควต้าการใช้งานระบบจองห้องประชุม
                </p>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Quota Settings Form -->
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-settings"
              class="me-2"
            />
            การตั้งค่าโควตา
          </VCardTitle>
          <VCardText>
            <div
              v-if="loading"
              class="d-flex justify-center align-center py-12"
            >
              <VProgressCircular
                indeterminate
                color="primary"
                size="64"
              />
            </div>
            <div v-else>
              <div
                v-if="quotaSettings.length > 0"
                class="quota-settings-list"
              >
                <div
                  v-for="setting in quotaSettings"
                  :key="setting.id"
                  class="quota-setting-row"
                >
                  <div class="setting-row-content">
                    <label
                      :for="'setting-' + setting.id"
                      class="setting-label"
                    >
                      {{ setting.name }}{{ setting.unit ? ' (' + setting.unit + ')' : '' }}
                    </label>
                    <div class="setting-input-group">
                      <AppTextField
                        :id="'setting-' + setting.id"
                        v-model="editedValues[setting.id]"
                        type="text"
                        variant="outlined"
                        density="compact"
                        class="setting-field"
                        hide-details
                      />
                      <VBtn
                        color="success"
                        size="small"
                        class="setting-save-btn"
                        :loading="savingSettings[setting.id]"
                        :disabled="!hasChanges(setting)"
                        @click="saveSetting(setting)"
                      >
                        บันทึก
                      </VBtn>
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-else
                class="text-center py-12"
              >
                <VIcon
                  icon="tabler-settings-off"
                  size="64"
                  color="disabled"
                  class="mb-4"
                />
                <p class="text-body-1 text-disabled mb-2">
                  ยังไม่มีการตั้งค่าโควตา
                </p>
                <p class="text-caption text-disabled">
                  กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มการตั้งค่าโควตา
                </p>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Confirmation Dialog -->
    <VDialog
      v-model="confirmDialog"
      max-width="400"
    >
      <VCard>
        <VCardTitle class="text-h5">
          {{ confirmDialogTitle }}
        </VCardTitle>
        <VCardText>
          {{ confirmDialogText }}
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            color="error"
            variant="text"
            @click="confirmDialog = false; savingSettings[confirmDialogSetting?.id] = false"
          >
            ยกเลิก
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            @click="confirmSave"
          >
            ใช่, บันทึกเลย!
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Loading Dialog -->
    <VDialog
      v-model="loadingDialog"
      persistent
      max-width="300"
    >
      <VCard>
        <VCardText class="text-center pt-6">
          <VProgressCircular
            indeterminate
            color="primary"
            class="mb-4"
          />
          <div class="text-body-1">
            {{ loadingDialogText }}
          </div>
        </VCardText>
      </VCard>
    </VDialog>

    <!-- Snackbar for notifications -->
    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="top"
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
.usage-quota-page {
  padding: 0;
}

.quota-settings-list {
  background: #fff;
}

.quota-setting-row {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.quota-setting-row:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.setting-row-content {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.setting-label {
  flex: 0 0 auto;
  min-width: 350px;
  font-size: 14px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.87);
  line-height: 1.5;
  margin-bottom: 0;
}

.setting-input-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.setting-field {
  flex: 0 0 auto;
  width: 200px;
  margin-bottom: 0;
}

.setting-field :deep(.v-field) {
  padding-top: 0;
}

.setting-field :deep(.v-field__input) {
  min-height: 36px;
  padding: 8px 12px;
}

.setting-save-btn {
  flex-shrink: 0;
  min-width: 80px;
}

@media (max-width: 960px) {
  .setting-row-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .setting-label {
    min-width: 100%;
    width: 100%;
  }
  
  .setting-input-group {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
  
  .setting-field {
    width: 100%;
  }
  
  .setting-save-btn {
    width: 100%;
  }
}
</style>

