<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const uploading = ref(false)
const hasFace = ref(false)
const faceImage = ref(null)
const error = ref(null)
const success = ref(null)
const showCameraDialog = ref(false)
const cameraStream = ref(null)
const cameraVideo = ref(null)

// Check if user already has registered face
const checkFace = async () => {
  try {
    const response = await api.get('/face/check')
    hasFace.value = response.data.data?.hasFace || false
    
    if (hasFace.value) {
      await loadFaceImage()
    }
  } catch (error) {
    console.error('Error checking face:', error)
  }
}

// Load existing face image
const loadFaceImage = async () => {
  try {
    const response = await api.get('/face')
    if (response.data.success && response.data.data?.image) {
      faceImage.value = response.data.data.image
    }
  } catch (error) {
    console.error('Error loading face image:', error)
  }
}

// Handle file input
const handleFileInput = (event) => {
  const file = event.target.files[0]
  if (file) {
    if (!file.type.startsWith('image/')) {
      error.value = 'กรุณาเลือกไฟล์รูปภาพเท่านั้น'
      return
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB
      error.value = 'ขนาดไฟล์ต้องไม่เกิน 50 MB'
      return
    }
    
    const reader = new FileReader()
    reader.onload = (e) => {
      faceImage.value = e.target.result
      error.value = null
    }
    reader.readAsDataURL(file)
  }
}

// Register face from uploaded image
const registerFace = async () => {
  if (!faceImage.value) {
    error.value = 'กรุณาเลือกรูปภาพใบหน้า'
    return
  }
  
  uploading.value = true
  error.value = null
  success.value = null
  
  try {
    // Send image as base64 data URL (backend expects this format)
    const uploadResponse = await api.post('/face', {
      image: faceImage.value, // Send full data URL
    })
    
    if (uploadResponse.data.success) {
      success.value = 'ลงทะเบียนใบหน้าสำเร็จ'
      hasFace.value = true
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    }
  } catch (err) {
    console.error('Error registering face:', err)
    error.value = err.response?.data?.message || 'เกิดข้อผิดพลาดในการลงทะเบียนใบหน้า'
  } finally {
    uploading.value = false
  }
}

// Open camera dialog
const openCameraDialog = async () => {
  try {
    // Request camera access
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 }
      } 
    })
    
    cameraStream.value = stream
    showCameraDialog.value = true
    
    // Wait for dialog to open and video element to be available
    await nextTick()
    
    if (cameraVideo.value) {
      cameraVideo.value.srcObject = stream
      cameraVideo.value.play()
    }
  } catch (err) {
    console.error('Error accessing camera:', err)
    error.value = 'ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบการตั้งค่ากล้อง'
  }
}

// Capture photo from camera
const capturePhoto = () => {
  if (!cameraVideo.value) return
  
  const canvas = document.createElement('canvas')
  canvas.width = cameraVideo.value.videoWidth
  canvas.height = cameraVideo.value.videoHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(cameraVideo.value, 0, 0)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
  
  faceImage.value = dataUrl
  error.value = null
  closeCameraDialog()
}

// Close camera dialog
const closeCameraDialog = () => {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach(track => track.stop())
    cameraStream.value = null
  }
  showCameraDialog.value = false
}

// Register face from scanner device
const registerFromScanner = async () => {
  uploading.value = true
  error.value = null
  success.value = null
  
  try {
    // Test scanner connection first
    const testResponse = await api.post('/face/scanner/test')
    if (!testResponse.data.success) {
      error.value = 'ไม่สามารถเชื่อมต่อกับเครื่องสแกนใบหน้าได้'
      uploading.value = false
      return
    }
    
    // Scan face from device
    const scanResponse = await api.post('/face/scanner/scan')
    if (scanResponse.data.success && scanResponse.data.data?.image) {
      faceImage.value = `data:image/jpeg;base64,${scanResponse.data.data.image}`
      
      // Register to device
      const registerResponse = await api.post('/face/scanner/register', {
        username: authStore.user?.email || authStore.user?.username,
      })
      
      if (registerResponse.data.success) {
        // Also save to database
        await registerFace()
        success.value = 'ลงทะเบียนใบหน้าสำเร็จ (จากเครื่องสแกน)'
        hasFace.value = true
      }
    } else {
      error.value = 'ไม่สามารถสแกนใบหน้าได้ กรุณาลองใหม่อีกครั้ง'
    }
  } catch (err) {
    console.error('Error registering from scanner:', err)
    error.value = err.response?.data?.message || 'เกิดข้อผิดพลาดในการสแกนใบหน้า'
  } finally {
    uploading.value = false
  }
}

onMounted(() => {
  checkFace()
})
</script>

<template>
  <div>
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <VIcon
                icon="tabler-user-scan"
                class="me-2"
              />
              <span>ลงทะเบียนใบหน้า</span>
            </div>
          </VCardTitle>

          <VDivider />

          <VCardText>
            <VAlert
              v-if="hasFace"
              type="success"
              variant="tonal"
              class="mb-4"
            >
              <VAlertTitle>คุณได้ลงทะเบียนใบหน้าแล้ว</VAlertTitle>
              <div>คุณสามารถอัปเดตรูปภาพใบหน้าใหม่ได้โดยเลือกรูปภาพใหม่</div>
            </VAlert>

            <VAlert
              v-if="error"
              type="error"
              variant="tonal"
              class="mb-4"
              closable
              @click:close="error = null"
            >
              {{ error }}
            </VAlert>

            <VAlert
              v-if="success"
              type="success"
              variant="tonal"
              class="mb-4"
            >
              {{ success }}
            </VAlert>

            <VRow>
              <!-- Face Image Preview -->
              <VCol
                cols="12"
                md="6"
              >
                <div class="text-center">
                  <div
                    v-if="faceImage"
                    class="face-preview mb-4"
                  >
                    <img
                      :src="faceImage"
                      alt="Face Preview"
                      class="face-image"
                    >
                  </div>
                  <div
                    v-else
                    class="face-placeholder mb-4"
                  >
                    <VIcon
                      icon="tabler-user"
                      size="120"
                      class="text-disabled"
                    />
                    <div class="text-body-1 text-disabled mt-4">
                      ยังไม่มีรูปภาพใบหน้า
                    </div>
                  </div>
                </div>
              </VCol>

              <!-- Upload Options -->
              <VCol
                cols="12"
                md="6"
              >
                <div class="d-flex flex-column gap-4">
                  <div>
                    <VBtn
                      block
                      color="primary"
                      variant="outlined"
                      @click="$refs.fileInput.click()"
                    >
                      <VIcon
                        icon="tabler-upload"
                        class="me-2"
                      />
                      อัปโหลดรูปภาพ
                    </VBtn>
                    <input
                      ref="fileInput"
                      type="file"
                      accept="image/*"
                      style="display: none"
                      @change="handleFileInput"
                    >
                  </div>

                  <div>
                    <VBtn
                      block
                      color="secondary"
                      variant="outlined"
                      @click="openCameraDialog"
                    >
                      <VIcon
                        icon="tabler-camera"
                        class="me-2"
                      />
                      ถ่ายภาพจากกล้อง
                    </VBtn>
                  </div>

                  <div>
                    <VBtn
                      block
                      color="info"
                      variant="outlined"
                      :loading="uploading"
                      @click="registerFromScanner"
                    >
                      <VIcon
                        icon="tabler-scan"
                        class="me-2"
                      />
                      สแกนจากเครื่องสแกนใบหน้า
                    </VBtn>
                  </div>

                  <VDivider />

                  <VBtn
                    block
                    color="primary"
                    size="large"
                    :loading="uploading"
                    :disabled="!faceImage"
                    @click="registerFace"
                  >
                    <VIcon
                      icon="tabler-check"
                      class="me-2"
                    />
                    {{ hasFace ? 'อัปเดต' : 'ลงทะเบียน' }}ใบหน้า
                  </VBtn>
                </div>
              </VCol>
            </VRow>

            <!-- Instructions -->
            <VCard
              variant="tonal"
              color="info"
              class="mt-6"
            >
              <VCardText>
                <div class="text-h6 mb-2">
                  <VIcon
                    icon="tabler-info-circle"
                    class="me-2"
                  />
                  คำแนะนำ
                </div>
                <ul class="text-body-2">
                  <li>เลือกรูปภาพใบหน้าที่ชัดเจน แสดงใบหน้าเต็มหน้า</li>
                  <li>รูปภาพควรมีแสงสว่างเพียงพอ</li>
                  <li>ขนาดไฟล์ไม่เกิน 50 MB</li>
                  <li>รองรับไฟล์รูปภาพ: JPG, PNG, GIF</li>
                  <li>หากมีเครื่องสแกนใบหน้า สามารถสแกนได้โดยตรง</li>
                </ul>
              </VCardText>
            </VCard>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Camera Dialog -->
    <VDialog
      v-model="showCameraDialog"
      max-width="640"
      @update:model-value="(val) => !val && closeCameraDialog()"
    >
      <VCard>
        <VCardTitle class="d-flex align-center justify-space-between">
          <div class="d-flex align-center">
            <VIcon
              icon="tabler-camera"
              class="me-2"
            />
            <span>ถ่ายภาพใบหน้า</span>
          </div>
          <VBtn
            icon
            variant="text"
            size="small"
            @click="closeCameraDialog"
          >
            <VIcon icon="tabler-x" />
          </VBtn>
        </VCardTitle>

        <VDivider />

        <VCardText class="text-center pa-4">
          <video
            ref="cameraVideo"
            autoplay
            playsinline
            class="camera-video"
          />
        </VCardText>

        <VDivider />

        <VCardActions>
          <VSpacer />
          <VBtn
            variant="outlined"
            @click="closeCameraDialog"
          >
            ยกเลิก
          </VBtn>
          <VBtn
            color="primary"
            @click="capturePhoto"
          >
            <VIcon
              icon="tabler-camera"
              class="me-2"
            />
            ถ่ายภาพ
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.face-preview {
  border: 2px dashed rgb(var(--v-theme-primary));
  border-radius: 8px;
  padding: 1rem;
  background: rgb(var(--v-theme-surface));
}

.face-image {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
  object-fit: contain;
}

.face-placeholder {
  border: 2px dashed rgb(var(--v-theme-border-color));
  border-radius: 8px;
  padding: 3rem;
  background: rgb(var(--v-theme-surface));
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.camera-dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
}

.camera-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-container {
  background: rgb(var(--v-theme-surface));
  border-radius: 8px;
  padding: 1.5rem;
  max-width: 640px;
  width: 90%;
}

.camera-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
}

#camera-video {
  width: 100%;
  border-radius: 8px;
  background: #000;
}

.camera-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.btn-capture,
.btn-cancel {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.btn-capture {
  background: rgb(var(--v-theme-primary));
  color: white;
}

.btn-cancel {
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface));
}
</style>

