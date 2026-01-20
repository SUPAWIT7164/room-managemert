<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTheme } from 'vuetify'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const vuetifyTheme = useTheme()
const loading = ref(false)

// ข้อมูลตัวอย่าง 6 ล็อค
const tenants = ref([
  {
    id: 1,
    lockNumber: 'A01',
    tenantName: 'ร้านกาแฟสตาร์บัคส์',
    waterFee: 250,
    electricityFee: 1850,
    rentalFee: 8500,
  },
  {
    id: 2,
    lockNumber: 'A02',
    tenantName: 'ร้านอาหารไทยอร่อย',
    waterFee: 320,
    electricityFee: 2400,
    rentalFee: 12000,
  },
  {
    id: 3,
    lockNumber: 'A03',
    tenantName: 'ร้านเสื้อผ้าแฟชั่น',
    waterFee: 150,
    electricityFee: 950,
    rentalFee: 5000,
  },
  {
    id: 4,
    lockNumber: 'B01',
    tenantName: 'ร้านเครื่องสำอางค์',
    waterFee: 180,
    electricityFee: 1200,
    rentalFee: 6500,
  },
  {
    id: 5,
    lockNumber: 'B02',
    tenantName: 'ร้านหนังสือ',
    waterFee: 120,
    electricityFee: 850,
    rentalFee: 3800,
  },
  {
    id: 6,
    lockNumber: 'B03',
    tenantName: 'ร้านอิเล็กทรอนิกส์',
    waterFee: 200,
    electricityFee: 2100,
    rentalFee: 9500,
  },
])

// คำนวณรวมทั้งหมดของแต่ละล็อค
const tenantsWithTotal = computed(() => {
  return tenants.value.map(tenant => ({
    ...tenant,
    total: tenant.waterFee + tenant.electricityFee + tenant.rentalFee,
  }))
})

// คำนวณ Grand Total
const grandTotal = computed(() => {
  return tenantsWithTotal.value.reduce((sum, tenant) => sum + tenant.total, 0)
})

// คำนวณรวมแต่ละประเภท
const totalWaterFee = computed(() => {
  return tenants.value.reduce((sum, tenant) => sum + tenant.waterFee, 0)
})

const totalElectricityFee = computed(() => {
  return tenants.value.reduce((sum, tenant) => sum + tenant.electricityFee, 0)
})

const totalRentalFee = computed(() => {
  return tenants.value.reduce((sum, tenant) => sum + tenant.rentalFee, 0)
})

// ฟังก์ชันจัดรูปแบบตัวเลข
const formatCurrency = (value) => {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

onMounted(() => {
  // สามารถเพิ่มการดึงข้อมูลจาก API ได้ที่นี่
})
</script>

<template>
  <div>
    <!-- Page Header -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardText>
            <div class="d-flex align-center">
              <VAvatar
                color="primary"
                variant="tonal"
                size="56"
                class="me-4"
              >
                <VIcon
                  icon="tabler-receipt"
                  size="28"
                />
              </VAvatar>
              <div>
                <h4 class="text-h4 mb-1">
                  รายงานค่าใช้จ่ายของผู้เช่าร้านค้า
                </h4>
                <p class="text-body-2 mb-0">
                  สรุปค่าใช้จ่ายรายเดือนของทุกล็อค
                </p>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Summary Cards -->
    <VRow class="mb-4">
      <VCol
        cols="12"
        md="3"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center justify-space-between">
              <div>
                <p class="text-body-2 text-medium-emphasis mb-1">
                  ค่าน้ำรวม
                </p>
                <h3 class="text-h5 font-weight-bold text-primary">
                  ฿{{ formatCurrency(totalWaterFee) }}
                </h3>
              </div>
              <VAvatar
                color="primary"
                variant="tonal"
                size="48"
              >
                <VIcon
                  icon="tabler-droplet"
                  size="24"
                />
              </VAvatar>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="3"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center justify-space-between">
              <div>
                <p class="text-body-2 text-medium-emphasis mb-1">
                  ค่าไฟรวม
                </p>
                <h3 class="text-h5 font-weight-bold text-success">
                  ฿{{ formatCurrency(totalElectricityFee) }}
                </h3>
              </div>
              <VAvatar
                color="success"
                variant="tonal"
                size="48"
              >
                <VIcon
                  icon="tabler-bolt"
                  size="24"
                />
              </VAvatar>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="3"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center justify-space-between">
              <div>
                <p class="text-body-2 text-medium-emphasis mb-1">
                  ค่าเช่ารวม
                </p>
                <h3 class="text-h5 font-weight-bold text-info">
                  ฿{{ formatCurrency(totalRentalFee) }}
                </h3>
              </div>
              <VAvatar
                color="info"
                variant="tonal"
                size="48"
              >
                <VIcon
                  icon="tabler-home"
                  size="24"
                />
              </VAvatar>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="3"
      >
        <VCard class="border border-warning">
          <VCardText>
            <div class="d-flex align-center justify-space-between">
              <div>
                <p class="text-body-2 text-medium-emphasis mb-1">
                  รวมทั้งหมด
                </p>
                <h3 class="text-h5 font-weight-bold text-warning">
                  ฿{{ formatCurrency(grandTotal) }}
                </h3>
              </div>
              <VAvatar
                color="warning"
                variant="tonal"
                size="48"
              >
                <VIcon
                  icon="tabler-calculator"
                  size="24"
                />
              </VAvatar>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Data Table -->
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-table"
              class="me-2"
            />
            รายละเอียดค่าใช้จ่ายตามล็อค
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
            <div
              v-else-if="tenantsWithTotal.length > 0"
              class="table-responsive"
            >
              <VTable>
                <thead>
                  <tr>
                    <th>ล็อค</th>
                    <th>ผู้เช่า</th>
                    <th class="text-end">ค่าน้ำ (บาท)</th>
                    <th class="text-end">ค่าไฟ (บาท)</th>
                    <th class="text-end">ค่าเช่า (บาท)</th>
                    <th class="text-end">รวมทั้งหมด (บาท)</th>
                    <th class="text-center">การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="tenant in tenantsWithTotal"
                    :key="tenant.id"
                  >
                    <td>
                      <VChip
                        color="primary"
                        variant="tonal"
                        size="small"
                      >
                        {{ tenant.lockNumber }}
                      </VChip>
                    </td>
                    <td>
                      <span class="font-weight-medium">{{ tenant.tenantName }}</span>
                    </td>
                    <td class="text-end">
                      <span class="text-primary">฿{{ formatCurrency(tenant.waterFee) }}</span>
                    </td>
                    <td class="text-end">
                      <span class="text-success">฿{{ formatCurrency(tenant.electricityFee) }}</span>
                    </td>
                    <td class="text-end">
                      <span class="text-info">฿{{ formatCurrency(tenant.rentalFee) }}</span>
                    </td>
                    <td class="text-end">
                      <span class="font-weight-bold text-warning">฿{{ formatCurrency(tenant.total) }}</span>
                    </td>
                    <td class="text-center">
                      <VBtn
                        color="primary"
                        variant="outlined"
                        size="small"
                        prepend-icon="tabler-receipt"
                        :to="`/utilities/tenant-invoice?id=${tenant.id}`"
                      >
                        ใบแจ้งหนี้
                      </VBtn>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <th colspan="2">
                      <span class="font-weight-bold">รวมทั้งหมด</span>
                    </th>
                    <th class="text-end">
                      <span class="font-weight-bold text-primary">฿{{ formatCurrency(totalWaterFee) }}</span>
                    </th>
                    <th class="text-end">
                      <span class="font-weight-bold text-success">฿{{ formatCurrency(totalElectricityFee) }}</span>
                    </th>
                    <th class="text-end">
                      <span class="font-weight-bold text-info">฿{{ formatCurrency(totalRentalFee) }}</span>
                    </th>
                    <th class="text-end">
                      <span class="font-weight-bold text-warning">฿{{ formatCurrency(grandTotal) }}</span>
                    </th>
                    <th />
                  </tr>
                </tfoot>
              </VTable>
            </div>
            <div
              v-else
              class="text-center py-12"
            >
              <VAlert
                type="info"
                variant="tonal"
              >
                ไม่มีข้อมูล
              </VAlert>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<style lang="scss" scoped>
/* Table Styling - Same as bookings/report */
.table-responsive {
  overflow-x: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.v-table {
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

/* Table Header */
.v-table thead tr {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.v-table thead th {
  color: white !important;
  font-weight: 700 !important;
  font-size: 0.875rem;
  text-align: left;
  padding: 16px 12px !important;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 2px solid #e0e0e0;
  white-space: nowrap;
}

.v-table thead th:last-child {
  border-right: none;
}

/* Table Body */
.v-table tbody tr {
  transition: background-color 0.2s ease;
}

.v-table tbody tr:nth-child(odd) {
  background-color: #ffffff;
}

.v-table tbody tr:nth-child(even) {
  background-color: #f9fafb;
}

.v-table tbody tr:hover {
  background-color: #f0f4ff !important;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.1);
}

.v-table tbody td {
  padding: 14px 12px !important;
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.875rem;
  color: #374151;
  vertical-align: middle;
}

.v-table tbody td:last-child {
  border-right: none;
}

.v-table tbody tr:last-child td {
  border-bottom: none;
}

/* Lock Column */
.v-table tbody td:first-child {
  font-weight: 500;
  color: #111827;
  min-width: 100px;
}

/* Number Columns */
.v-table tbody td.text-end {
  font-weight: 500;
  text-align: right;
}

/* Table Footer */
.v-table tfoot tr {
  background-color: #fff9e6 !important;
}

.v-table tfoot th {
  font-weight: 700 !important;
  padding: 16px 12px !important;
  border-top: 2px solid #e0e0e0;
  border-right: 1px solid #e5e7eb;
  color: #111827 !important;
}

.v-table tfoot th:last-child {
  border-right: none;
}

/* Responsive */
@media (max-width: 1200px) {
  .v-table thead th,
  .v-table tbody td,
  .v-table tfoot th {
    padding: 10px 8px !important;
    font-size: 0.8125rem;
  }
}
</style>

