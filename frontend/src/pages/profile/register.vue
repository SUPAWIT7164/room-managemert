<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
    admin: true,
  },
})

const loading = ref(false)
const faceRegistrations = ref([])
const selectedRegistration = ref(null)
const showDetailDialog = ref(false)
const imageLoading = ref(false)
const faceImage = ref(null)
const search = ref('')
const errorMessage = ref(null)

// Prepare data for table with formatted values
const tableData = computed(() => {
  return faceRegistrations.value.map((item, index) => ({
    ...item,
    displayId: faceRegistrations.value.length - index,
    displayDate: formatDate(item.created_at),
    displayName: item.name_en || item.name,
    displayFaculty: item.faculty || item.organization_name_TH || '-',
  }))
})

// Headers for VDataTable
const headers = [
  {
    title: '#',
    key: 'displayId',
    sortable: false,
    width: '80px',
  },
  {
    title: 'วันที่ลงทะเบียน',
    key: 'displayDate',
  },
  {
    title: 'ชื่อ-สกุล',
    key: 'displayName',
  },
  {
    title: 'ประเภทของผู้ใช้งาน',
    key: 'visitor_type',
  },
  {
    title: 'หน่วยงาน',
    key: 'displayFaculty',
  },
  {
    title: 'สถานะ',
    key: 'approve',
    sortable: false,
  },
  {
    title: 'จัดการ',
    key: 'actions',
    sortable: false,
    align: 'end',
  },
]

const fetchRegistrations = async () => {
  loading.value = true
  errorMessage.value = null
  
  try {
    // ดึงข้อมูล visitors ทั้งหมดจาก database
    const response = await api.get('/visitors/list')
    
    // Response format: { success: true, data: [...] }
    if (response.data?.success && response.data?.data) {
      faceRegistrations.value = response.data.data
    } else if (Array.isArray(response.data)) {
      // Fallback: ถ้า response เป็น array โดยตรง
      faceRegistrations.value = response.data
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      faceRegistrations.value = response.data.data
    } else {
      faceRegistrations.value = []
    }
  } catch (error) {
    console.error('Error fetching face registrations:', error)
    
    // Handle different error types
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
      errorMessage.value = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่า backend server กำลังทำงานอยู่ที่ port 5000'
    } else if (error.response?.status === 401) {
      errorMessage.value = 'กรุณาเข้าสู่ระบบใหม่'
    } else if (error.response?.status === 403) {
      errorMessage.value = 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้'
    } else {
      errorMessage.value = error.response?.data?.message || 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง'
    }
    
    faceRegistrations.value = []
  } finally {
    loading.value = false
  }
}

const getStatusBadge = (approve) => {
  if (approve === null) {
    return { text: 'รออนุมัติ', color: 'warning' }
  } else if (approve === 1) {
    return { text: 'อนุมัติแล้ว', color: 'success' }
  } else {
    return { text: 'ปฏิเสธแล้ว', color: 'error' }
  }
}

const showDetails = async (registration) => {
  selectedRegistration.value = registration
  imageLoading.value = true
  faceImage.value = null
  showDetailDialog.value = true
  
  try {
    // ดึงรูปภาพ visitor (ตาม room-management-portal)
    const response = await api.post('/visitors/image', {
      id: registration.id,
    })
    
    if (response.data.success && response.data.image) {
      faceImage.value = response.data.image
    } else {
      faceImage.value = null
    }
  } catch (error) {
    console.error('Error loading face image:', error)
    faceImage.value = null
  } finally {
    imageLoading.value = false
  }
}

const approveRegistration = async (id) => {
  try {
    // อนุมัติ visitor (ตาม room-management-portal)
    const response = await api.post('/visitors/toggleApproval', {
      id: id,
    })
    
    if (response.data.success) {
      // Refresh data
      await fetchRegistrations()
      alert('อนุมัติสำเร็จ')
      showDetailDialog.value = false
    } else {
      alert(response.data.message || 'เกิดข้อผิดพลาดในการอนุมัติ')
    }
  } catch (error) {
    console.error('Error approving registration:', error)
    alert(error.response?.data?.message || 'เกิดข้อผิดพลาดในการอนุมัติ')
  }
}

const rejectRegistration = async (id) => {
  try {
    // ปฏิเสธ visitor (ตาม room-management-portal)
    const response = await api.post('/visitors/rejectVisitor', {
      id: id,
    })
    
    if (response.data.success) {
      // Refresh data
      await fetchRegistrations()
      alert('ปฏิเสธสำเร็จ')
      showDetailDialog.value = false
    } else {
      alert(response.data.message || 'เกิดข้อผิดพลาดในการปฏิเสธ')
    }
  } catch (error) {
    console.error('Error rejecting registration:', error)
    alert(error.response?.data?.message || 'เกิดข้อผิดพลาดในการปฏิเสธ')
  }
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear() + 543 // Convert to Buddhist year
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
}

const deleteRegistration = async (id) => {
  if (!confirm('คุณต้องการลบรายการนี้หรือไม่?')) {
    return
  }
  
  try {
    // ลบ visitor (ตาม room-management-portal)
    const response = await api.post('/visitors/delete', {
      id: id,
    })
    
    if (response.data.success) {
      // Refresh data
      await fetchRegistrations()
      alert('ลบสำเร็จ')
    } else {
      alert(response.data.message || 'เกิดข้อผิดพลาดในการลบ')
    }
  } catch (error) {
    console.error('Error deleting registration:', error)
    alert(error.response?.data?.message || 'เกิดข้อผิดพลาดในการลบ')
  }
}

onMounted(() => {
  fetchRegistrations()
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
                icon="tabler-user-circle-plus"
                class="me-2"
              />
              <span>คำขอลงทะเบียน</span>
            </div>
            <VBtn
              color="primary"
              :loading="loading"
              @click="fetchRegistrations"
            >
              <VIcon
                icon="tabler-refresh"
                class="me-2"
              />
              รีเฟรช
            </VBtn>
          </VCardTitle>

          <VDivider />

          <VCardText>
            <VRow>
              <VCol
                cols="12"
                offset-md="8"
                md="4"
              >
                <AppTextField
                  v-model="search"
                  placeholder="ค้นหา..."
                  append-inner-icon="tabler-search"
                  single-line
                  hide-details
                  dense
                  outlined
                />
              </VCol>
            </VRow>
          </VCardText>

          <VDivider />

          <VCardText>
            <!-- Error Message -->
            <VAlert
              v-if="errorMessage"
              type="error"
              variant="tonal"
              prominent
              class="mb-4"
              closable
              @click:close="errorMessage = null"
            >
              <VAlertTitle>
                <VIcon
                  icon="tabler-alert-circle"
                  class="me-2"
                />
                เกิดข้อผิดพลาด
              </VAlertTitle>
              <div class="mt-2">{{ errorMessage }}</div>
              <VBtn
                v-if="errorMessage.includes('backend server')"
                color="primary"
                size="small"
                variant="text"
                class="mt-2"
                @click="fetchRegistrations"
              >
                <VIcon
                  icon="tabler-refresh"
                  class="me-2"
                />
                ลองใหม่อีกครั้ง
              </VBtn>
            </VAlert>

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

            <!-- Data Table -->
            <VDataTable
              v-else
              :headers="headers"
              :items="tableData"
              :search="search"
              :items-per-page="10"
              class="text-no-wrap"
            >
              <!-- Name Column -->
              <template #item.displayName="{ item }">
                <a
                  href="javascript:void(0)"
                  class="text-primary text-decoration-none font-weight-medium"
                  @click="showDetails(item)"
                >
                  {{ item.displayName }}
                </a>
              </template>

              <!-- Visitor Type Column -->
              <template #item.visitor_type="{ item }">
                <span class="text-high-emphasis">{{ item.visitor_type || '-' }}</span>
              </template>

              <!-- Status Column -->
              <template #item.approve="{ item }">
                <template v-if="item.approve === null">
                  <VBtn
                    color="info"
                    size="small"
                    variant="flat"
                    class="me-2"
                    @click="approveRegistration(item.id)"
                  >
                    อนุมัติ
                  </VBtn>
                  <VBtn
                    color="error"
                    size="small"
                    variant="flat"
                    @click="rejectRegistration(item.id)"
                  >
                    ปฏิเสธ
                  </VBtn>
                </template>
                <VChip
                  v-else-if="item.approve === 1"
                  color="success"
                  size="small"
                  class="font-weight-medium"
                >
                  อนุมัติแล้ว
                </VChip>
                <VChip
                  v-else
                  color="error"
                  size="small"
                  class="font-weight-medium"
                >
                  ปฏิเสธแล้ว
                </VChip>
              </template>

              <!-- Actions Column -->
              <template #item.actions="{ item }">
                <VBtn
                  icon
                  variant="text"
                  color="error"
                  size="small"
                  @click="deleteRegistration(item.id)"
                >
                  <VIcon icon="tabler-trash" />
                </VBtn>
              </template>

              <!-- No Data -->
              <template #no-data>
                <div class="text-center py-8">
                  <VIcon
                    size="64"
                    icon="tabler-user-off"
                    class="text-disabled mb-4"
                  />
                  <div class="text-h6 mb-2">
                    ไม่พบข้อมูล
                  </div>
                  <div class="text-body-2 text-medium-emphasis">
                    ยังไม่มีคำขอลงทะเบียนใบหน้า
                  </div>
                </div>
              </template>
            </VDataTable>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Detail Dialog -->
    <VDialog
      v-model="showDetailDialog"
      max-width="600"
    >
      <VCard v-if="selectedRegistration">
        <VCardTitle class="d-flex align-center justify-space-between">
          <span>รายละเอียดคำขอลงทะเบียน</span>
          <VBtn
            icon
            variant="text"
            size="small"
            @click="showDetailDialog = false"
          >
            <VIcon icon="tabler-x" />
          </VBtn>
        </VCardTitle>

        <VDivider />

        <VCardText>
          <!-- Face Image -->
          <div class="text-center mb-6">
            <div
              v-if="imageLoading"
              class="d-flex justify-center align-center"
              style="width: 200px; height: 200px; margin: 0 auto;"
            >
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <VImg
              v-else-if="faceImage"
              :src="faceImage"
              alt="Face Image"
              style="width: 200px; height: 200px; object-fit: cover; margin: 0 auto; border-radius: 8px;"
              @error="faceImage = null"
            />
            <div
              v-else
              class="d-flex justify-center align-center text-medium-emphasis"
              style="width: 200px; height: 200px; margin: 0 auto; border: 2px dashed; border-radius: 8px;"
            >
              ไม่พบรูปภาพ
            </div>
          </div>

          <VDivider class="mb-4" />

          <!-- User Details -->
          <VRow>
            <VCol
              cols="12"
              md="6"
            >
              <div class="mb-4">
                <div class="text-body-2 text-medium-emphasis mb-1">
                  ชื่อ-สกุล (ไทย)
                </div>
                <div class="text-body-1">
                  {{ selectedRegistration.name }}
                </div>
              </div>
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <div class="mb-4">
                <div class="text-body-2 text-medium-emphasis mb-1">
                  ชื่อ-สกุล (อังกฤษ)
                </div>
                <div class="text-body-1">
                  {{ selectedRegistration.name_en }}
                </div>
              </div>
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <div class="mb-4">
                <div class="text-body-2 text-medium-emphasis mb-1">
                  อีเมล
                </div>
                <div class="text-body-1">
                  {{ selectedRegistration.email }}
                </div>
              </div>
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <div class="mb-4">
                <div class="text-body-2 text-medium-emphasis mb-1">
                  เบอร์โทรศัพท์
                </div>
                <div class="text-body-1">
                  {{ selectedRegistration.phone }}
                </div>
              </div>
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <div class="mb-4">
                <div class="text-body-2 text-medium-emphasis mb-1">
                  เลขบัตรประชาชน/พาสปอร์ต
                </div>
                <div class="text-body-1">
                  {{ selectedRegistration.citizen_id }}
                </div>
              </div>
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <div class="mb-4">
                <div class="text-body-2 text-medium-emphasis mb-1">
                  สังกัด/คณะ
                </div>
                <div class="text-body-1">
                  {{ selectedRegistration.faculty }}
                </div>
              </div>
            </VCol>
            <VCol cols="12">
              <div class="mb-4">
                <div class="text-body-2 text-medium-emphasis mb-1">
                  ที่อยู่
                </div>
                <div class="text-body-1">
                  {{ selectedRegistration.address }}
                </div>
              </div>
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <div class="mb-4">
                <div class="text-body-2 text-medium-emphasis mb-1">
                  ประเภทผู้ใช้งาน
                </div>
                <div class="text-body-1">
                  {{ selectedRegistration.visitor_type }}
                </div>
              </div>
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <div class="mb-4">
                <div class="text-body-2 text-medium-emphasis mb-1">
                  สถานะ
                </div>
                <div>
                  <VChip
                    :color="getStatusBadge(selectedRegistration.approve).color"
                    size="small"
                  >
                    {{ getStatusBadge(selectedRegistration.approve).text }}
                  </VChip>
                </div>
              </div>
            </VCol>
          </VRow>
        </VCardText>

        <VDivider />

        <VCardActions>
          <VSpacer />
          <VBtn
            v-if="selectedRegistration.approve === null"
            color="success"
            @click="approveRegistration(selectedRegistration.id)"
          >
            <VIcon
              icon="tabler-check"
              class="me-2"
            />
            อนุมัติ
          </VBtn>
          <VBtn
            v-if="selectedRegistration.approve === null"
            color="error"
            @click="rejectRegistration(selectedRegistration.id)"
          >
            <VIcon
              icon="tabler-x"
              class="me-2"
            />
            ปฏิเสธ
          </VBtn>
          <VBtn
            color="secondary"
            variant="outlined"
            @click="showDetailDialog = false"
          >
            ปิด
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

