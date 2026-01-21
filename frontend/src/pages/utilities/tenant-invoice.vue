<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import moment from 'moment'
import 'moment/locale/th'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const route = useRoute()

// ตั้งค่า locale เป็นไทย
moment.locale('th')

// อัตราค่าบริการ (บาทต่อหน่วย)
const waterRate = 15 // บาทต่อลบ.ม.
const electricityRate = 3.5 // บาทต่อ kWh

// ข้อมูลตัวอย่าง 6 ล็อค (ควรดึงจาก API จริง)
const tenantsData = [
  {
    id: 1,
    lockNumber: 'A01',
    tenantName: 'ร้านกาแฟสตาร์บัคส์',
    contactPhone: '02-123-4567',
    waterUsage: 16.67, // ลบ.ม.
    waterFee: 250,
    electricityUsage: 528.57, // kWh
    electricityFee: 1850,
    rentalFee: 8500,
  },
  {
    id: 2,
    lockNumber: 'A02',
    tenantName: 'ร้านอาหารไทยอร่อย',
    contactPhone: '02-234-5678',
    waterUsage: 21.33, // ลบ.ม.
    waterFee: 320,
    electricityUsage: 685.71, // kWh
    electricityFee: 2400,
    rentalFee: 12000,
  },
  {
    id: 3,
    lockNumber: 'A03',
    tenantName: 'ร้านเสื้อผ้าแฟชั่น',
    contactPhone: '02-345-6789',
    waterUsage: 10, // ลบ.ม.
    waterFee: 150,
    electricityUsage: 271.43, // kWh
    electricityFee: 950,
    rentalFee: 5000,
  },
  {
    id: 4,
    lockNumber: 'B01',
    tenantName: 'ร้านเครื่องสำอางค์',
    contactPhone: '02-456-7890',
    waterUsage: 12, // ลบ.ม.
    waterFee: 180,
    electricityUsage: 342.86, // kWh
    electricityFee: 1200,
    rentalFee: 6500,
  },
  {
    id: 5,
    lockNumber: 'B02',
    tenantName: 'ร้านหนังสือ',
    contactPhone: '02-567-8901',
    waterUsage: 8, // ลบ.ม.
    waterFee: 120,
    electricityUsage: 242.86, // kWh
    electricityFee: 850,
    rentalFee: 3800,
  },
  {
    id: 6,
    lockNumber: 'B03',
    tenantName: 'ร้านอิเล็กทรอนิกส์',
    contactPhone: '02-678-9012',
    waterUsage: 13.33, // ลบ.ม.
    waterFee: 200,
    electricityUsage: 600, // kWh
    electricityFee: 2100,
    rentalFee: 9500,
  },
]

// ดึงข้อมูลผู้เช่าจาก query parameter หรือ id
const tenantId = computed(() => {
  return route.query.id ? parseInt(route.query.id) : null
})

const lockNumber = computed(() => {
  return route.query.lockNumber || null
})

// หาข้อมูลผู้เช่าที่ตรงกับ parameter
const tenant = computed(() => {
  if (tenantId.value) {
    return tenantsData.find(t => t.id === tenantId.value)
  }
  if (lockNumber.value) {
    return tenantsData.find(t => t.lockNumber === lockNumber.value)
  }
  return tenantsData[0] // default to first tenant
})

// คำนวณรวมทั้งหมด
const totalAmount = computed(() => {
  if (!tenant.value) return 0
  return tenant.value.waterFee + tenant.value.electricityFee + tenant.value.rentalFee
})

// วันที่ออกเอกสาร
const issueDate = computed(() => {
  return moment().format('DD MMMM YYYY')
})

// เดือนและปีของรายงาน
const reportMonth = computed(() => {
  return moment().format('MMMM YYYY')
})

// ฟังก์ชันจัดรูปแบบตัวเลข
const formatCurrency = (value) => {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// ฟังก์ชันแปลงตัวเลขเป็นตัวอักษรไทย
const numberToThaiText = (num) => {
  const thaiNumbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
  const thaiUnits = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']
  
  if (num === 0) return 'ศูนย์บาทถ้วน'
  
  const integerPart = Math.floor(num)
  const decimalPart = Math.round((num - integerPart) * 100)
  
  let result = ''
  let numStr = integerPart.toString()
  
  // แปลงส่วนที่เป็นบาท
  if (numStr.length > 0) {
    for (let i = 0; i < numStr.length; i++) {
      const digit = parseInt(numStr[numStr.length - 1 - i])
      const position = i % 6
      const unit = thaiUnits[position]
      
      if (digit > 0) {
        if (position === 1) {
          if (digit === 1) {
            result = 'สิบ' + result
          } else if (digit === 2) {
            result = 'ยี่สิบ' + result
          } else {
            result = thaiNumbers[digit] + unit + result
          }
        } else if (position === 0 && digit === 1 && numStr.length > 1 && parseInt(numStr[numStr.length - 2]) !== 0) {
          result = 'เอ็ด' + result
        } else {
          result = thaiNumbers[digit] + unit + result
        }
      }
    }
  }
  
  // เพิ่มคำว่า "บาท"
  result += 'บาท'
  
  // แปลงส่วนที่เป็นสตางค์
  if (decimalPart > 0) {
    if (decimalPart < 10) {
      result += thaiNumbers[decimalPart] + 'สตางค์'
    } else if (decimalPart < 20) {
      if (decimalPart === 10) {
        result += 'สิบสตางค์'
      } else {
        result += 'สิบ' + thaiNumbers[decimalPart % 10] + 'สตางค์'
      }
    } else {
      const tens = Math.floor(decimalPart / 10)
      const ones = decimalPart % 10
      if (tens === 2) {
        result += 'ยี่สิบ'
      } else {
        result += thaiNumbers[tens] + 'สิบ'
      }
      if (ones > 0) {
        result += thaiNumbers[ones]
      }
      result += 'สตางค์'
    }
  } else {
    result += 'ถ้วน'
  }
  
  return result
}

// ฟังก์ชันพิมพ์
const printInvoice = () => {
  window.print()
}

onMounted(() => {
  // สามารถเพิ่มการดึงข้อมูลจาก API ได้ที่นี่
  if (!tenant.value) {
    console.warn('ไม่พบข้อมูลผู้เช่า')
  }
})
</script>

<template>
  <div class="invoice-page">
    <!-- Action Buttons (ไม่แสดงตอนพิมพ์) -->
    <VRow class="mb-4 no-print">
      <VCol cols="12">
        <VCard>
          <VCardText>
            <div class="d-flex align-center justify-space-between">
              <VBtn
                variant="outlined"
                prepend-icon="tabler-arrow-left"
                @click="$router.back()"
              >
                กลับ
              </VBtn>
              <VBtn
                color="primary"
                prepend-icon="tabler-printer"
                @click="printInvoice"
              >
                พิมพ์ใบแจ้งหนี้
              </VBtn>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Invoice Content -->
    <VCard
      v-if="tenant"
      class="invoice-card"
    >
      <VCardText class="pa-8 invoice-content">
        <!-- Header Section -->
        <div class="invoice-header mb-8">
          <div class="d-flex justify-space-between align-start mb-6">
            <div>
              <h1 class="text-h3 font-weight-bold mb-2">
                Market Expense Report
              </h1>
              <p class="text-body-1 text-medium-emphasis">
                รายงานค่าใช้จ่ายรายเดือน
              </p>
            </div>
            <div class="text-end">
              <p class="text-body-1 mb-1">
                <strong>ประจำเดือน:</strong> {{ reportMonth }}
              </p>
              <p class="text-body-1 mb-1">
                <strong>วันที่ออกเอกสาร:</strong> {{ issueDate }}
              </p>
            </div>
          </div>
        </div>

        <!-- Tenant Information -->
        <div class="tenant-info mb-8">
          <VCard
            variant="outlined"
            class="pa-4"
          >
            <h3 class="text-h5 font-weight-bold mb-4">
              ข้อมูลผู้เช่า
            </h3>
            <VRow>
              <VCol
                cols="12"
                md="4"
              >
                <p class="text-body-1 mb-1">
                  <strong>ชื่อผู้เช่า:</strong>
                </p>
                <p class="text-body-1">
                  {{ tenant.tenantName }}
                </p>
              </VCol>
              <VCol
                cols="12"
                md="4"
              >
                <p class="text-body-1 mb-1">
                  <strong>หมายเลขล็อค:</strong>
                </p>
                <VChip
                  color="primary"
                  variant="tonal"
                  size="small"
                >
                  {{ tenant.lockNumber }}
                </VChip>
              </VCol>
              <VCol
                cols="12"
                md="4"
              >
                <p class="text-body-1 mb-1">
                  <strong>เบอร์ติดต่อ:</strong>
                </p>
                <p class="text-body-1">
                  {{ tenant.contactPhone }}
                </p>
              </VCol>
            </VRow>
          </VCard>
        </div>

        <!-- Expense Details Table -->
        <div class="expense-details mb-8">
          <h3 class="text-h5 font-weight-bold mb-4">
            รายละเอียดค่าใช้จ่าย
          </h3>
          <VTable class="expense-table">
            <thead>
              <tr>
                <th class="text-start">
                  รายการ
                </th>
                <th class="text-center">
                  หน่วยที่ใช้
                </th>
                <th class="text-center">
                  อัตรา (บาท/หน่วย)
                </th>
                <th class="text-end">
                  จำนวนเงิน (บาท)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-weight-medium">
                  ค่าเช่า
                </td>
                <td class="text-center">
                  <span class="text-medium-emphasis">-</span>
                </td>
                <td class="text-center">
                  <span class="text-medium-emphasis">-</span>
                </td>
                <td class="text-end">
                  ฿{{ formatCurrency(tenant.rentalFee) }}
                </td>
              </tr>
              <tr>
                <td class="font-weight-medium">
                  ค่าน้ำ
                </td>
                <td class="text-center">
                  <span class="font-weight-medium">{{ formatCurrency(tenant.waterUsage) }} <span class="text-medium-emphasis">ลบ.ม.</span></span>
                </td>
                <td class="text-center">
                  <span class="text-medium-emphasis">฿{{ formatCurrency(waterRate) }} / ลบ.ม.</span>
                </td>
                <td class="text-end">
                  ฿{{ formatCurrency(tenant.waterFee) }}
                </td>
              </tr>
              <tr>
                <td class="font-weight-medium">
                  ค่าไฟ
                </td>
                <td class="text-center">
                  <span class="font-weight-medium">{{ formatCurrency(tenant.electricityUsage) }} <span class="text-medium-emphasis">kWh</span></span>
                </td>
                <td class="text-center">
                  <span class="text-medium-emphasis">฿{{ formatCurrency(electricityRate) }} / kWh</span>
                </td>
                <td class="text-end">
                  ฿{{ formatCurrency(tenant.electricityFee) }}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th
                  colspan="3"
                  class="text-start"
                >
                  <span class="text-h6 font-weight-bold">รวมทั้งหมด</span>
                </th>
                <th class="text-end">
                  <span class="text-h5 font-weight-bold text-primary">฿{{ formatCurrency(totalAmount) }}</span>
                </th>
              </tr>
            </tfoot>
          </VTable>
        </div>

        <!-- Total Amount in Text -->
        <div class="total-amount-text mb-8">
          <VCard
            variant="outlined"
            class="pa-4"
          >
            <p class="text-body-1 mb-2">
              <strong>ยอดเงินรวมทั้งสิ้น:</strong>
            </p>
            <p class="text-h5 font-weight-bold text-primary">
              {{ numberToThaiText(totalAmount) }}
            </p>
          </VCard>
        </div>

        <!-- Signature Section -->
        <div class="signature-section">
          <VRow>
            <VCol
              cols="12"
              md="6"
            >
              <div class="signature-box">
                <p class="text-body-1 mb-4">
                  <strong>ลายเซ็นผู้รับเงิน</strong>
                </p>
                <div
                  class="signature-line"
                  style="border-top: 2px solid #000; width: 200px; margin-top: 60px;"
                />
                <p class="text-body-2 text-medium-emphasis mt-2">
                  (_________________________)
                </p>
                <p class="text-body-2 text-medium-emphasis mt-1">
                  วันที่ _________________________
                </p>
              </div>
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <div class="signature-box">
                <p class="text-body-1 mb-4">
                  <strong>ลายเซ็นผู้เช่า</strong>
                </p>
                <div
                  class="signature-line"
                  style="border-top: 2px solid #000; width: 200px; margin-top: 60px;"
                />
                <p class="text-body-2 text-medium-emphasis mt-2">
                  (_________________________)
                </p>
                <p class="text-body-2 text-medium-emphasis mt-1">
                  วันที่ _________________________
                </p>
              </div>
            </VCol>
          </VRow>
        </div>
      </VCardText>
    </VCard>

    <!-- No Data Message -->
    <VCard v-else>
      <VCardText>
        <VAlert
          type="error"
          variant="tonal"
        >
          ไม่พบข้อมูลผู้เช่า
        </VAlert>
      </VCardText>
    </VCard>
  </div>
</template>

<style lang="scss" scoped>
/* Print Styles */
@media print {
  @page {
    size: A4 portrait;
    margin: 10mm;
  }

  /* Reset body and html for print */
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: auto !important;
    background: white !important;
    overflow: visible !important;
  }

  /* Hide no-print elements */
  .no-print,
  .no-print * {
    display: none !important;
  }

  /* Show invoice page content - ensure it's visible */
  .invoice-page {
    position: relative !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    page-break-inside: avoid;
    page-break-after: avoid;
  }

  .invoice-card {
    box-shadow: none !important;
    border: none !important;
    position: relative;
    width: 100%;
    page-break-inside: avoid;
    page-break-after: avoid;
  }

  .invoice-card .v-card-text,
  .invoice-content {
    padding: 12px !important;
  }

  /* Prevent page breaks inside sections */
  .invoice-header,
  .tenant-info,
  .expense-details,
  .total-amount-text,
  .signature-section {
    page-break-inside: avoid;
  }

  /* Reduce spacing for print */
  .invoice-header {
    margin-bottom: 8px !important;
    padding-bottom: 6px !important;
  }

  .invoice-header .mb-6 {
    margin-bottom: 4px !important;
  }

  .invoice-header h1 {
    font-size: 1.4rem !important;
    margin-bottom: 2px !important;
    line-height: 1.2 !important;
  }

  .invoice-header p {
    font-size: 0.8rem !important;
    margin-bottom: 1px !important;
    line-height: 1.3 !important;
  }

  .tenant-info {
    margin-bottom: 8px !important;
  }

  .tenant-info .v-card {
    padding: 8px !important;
  }

  .tenant-info h3 {
    font-size: 0.95rem !important;
    margin-bottom: 4px !important;
    line-height: 1.2 !important;
  }

  .tenant-info .mb-1 {
    margin-bottom: 1px !important;
  }

  .tenant-info p {
    font-size: 0.8rem !important;
    line-height: 1.3 !important;
  }

  .expense-details {
    margin-bottom: 8px !important;
  }

  .expense-details h3 {
    font-size: 0.95rem !important;
    margin-bottom: 4px !important;
    line-height: 1.2 !important;
  }

  .total-amount-text {
    margin-bottom: 8px !important;
  }

  .total-amount-text .v-card {
    padding: 8px !important;
  }

  .total-amount-text p {
    margin-bottom: 2px !important;
    font-size: 0.8rem !important;
    line-height: 1.3 !important;
  }

  .total-amount-text .text-h5 {
    font-size: 0.95rem !important;
    line-height: 1.3 !important;
  }

  .signature-section {
    margin-top: 8px !important;
  }

  .signature-box {
    min-height: 70px !important;
    padding: 8px !important;
  }

  .signature-line {
    margin-top: 20px !important;
    width: 160px !important;
  }

  .signature-box p {
    font-size: 0.75rem !important;
    margin-bottom: 2px !important;
    line-height: 1.3 !important;
  }

  .signature-box .mb-4 {
    margin-bottom: 4px !important;
  }

  /* Override all mb-8 to smaller value */
  .mb-8 {
    margin-bottom: 8px !important;
  }

  .mb-6 {
    margin-bottom: 4px !important;
  }

  .mb-4 {
    margin-bottom: 4px !important;
  }

  .mb-2 {
    margin-bottom: 2px !important;
  }

  .mb-1 {
    margin-bottom: 1px !important;
  }

  body {
    background: white !important;
  }

  .v-card {
    box-shadow: none !important;
  }

  /* Reduce Vuetify component spacing */
  .v-row {
    margin: 0 !important;
  }

  .v-col {
    padding: 2px !important;
  }

  .v-chip {
    font-size: 0.7rem !important;
    padding: 1px 6px !important;
    height: auto !important;
  }

  /* Reduce text sizes */
  .text-h3 {
    font-size: 1.4rem !important;
    line-height: 1.2 !important;
  }

  .text-h5 {
    font-size: 0.95rem !important;
    line-height: 1.2 !important;
  }

  .text-h6 {
    font-size: 0.85rem !important;
    line-height: 1.2 !important;
  }

  .text-body-1 {
    font-size: 0.8rem !important;
    line-height: 1.3 !important;
  }

  .text-body-2 {
    font-size: 0.7rem !important;
    line-height: 1.3 !important;
  }
}

/* Invoice Card */
.invoice-card {
  max-width: 210mm;
  margin: 0 auto;
  background: white;
}

/* Invoice Header */
.invoice-header {
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 24px;
}

@media print {
  .invoice-header {
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 6px;
  }
}

/* Tenant Info */
.tenant-info {
  .v-card {
    background-color: #f9fafb;
  }
}

/* Expense Table */
.expense-table {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  width: 100%;

  thead {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

    th {
      color: white !important;
      font-weight: 700 !important;
      padding: 16px 12px !important;
      font-size: 0.95rem;
      white-space: nowrap;
    }
  }

  tbody {
    tr {
      border-bottom: 1px solid #e5e7eb;

      td {
        padding: 16px 12px !important;
        font-size: 0.95rem;
        vertical-align: middle;
      }
    }
  }

  tfoot {
    background-color: #fff9e6;

    th {
      padding: 20px 12px !important;
      border-top: 2px solid #e0e0e0;
      font-size: 1.1rem;
    }
  }
}

/* Responsive table for print */
@media print {
  .expense-table {
    font-size: 0.7rem !important;
    margin-bottom: 0 !important;

    thead th {
      padding: 6px 4px !important;
      font-size: 0.7rem !important;
      line-height: 1.2 !important;
    }

    tbody td {
      padding: 6px 4px !important;
      font-size: 0.7rem !important;
      line-height: 1.3 !important;
    }

    tfoot th {
      padding: 8px 4px !important;
      font-size: 0.8rem !important;
      line-height: 1.2 !important;
    }
  }
}

/* Total Amount Text */
.total-amount-text {
  .v-card {
    background-color: #f0f4ff;
    border: 2px solid #667eea;
  }
}

/* Signature Section */
.signature-box {
  min-height: 150px;
  padding: 16px;
  border: 1px dashed #ccc;
  border-radius: 8px;
  background-color: #fafafa;
}

.signature-line {
  border-top: 2px solid #000;
  width: 200px;
  margin-top: 60px;
}

@media print {
  .signature-box {
    min-height: 70px !important;
    padding: 8px !important;
  }

  .signature-line {
    margin-top: 20px !important;
    width: 160px !important;
  }
}

/* Screen Styles */
@media screen {
  .invoice-card {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}
</style>

<style lang="scss">
/* Global Print Styles - Not Scoped */
@media print {
  /* Hide all layout components - navbar, sidebar, footer */
  .v-navigation-drawer,
  .v-app-bar,
  .v-toolbar,
  .v-footer,
  .layout-navbar,
  .layout-footer,
  nav,
  header:not(.invoice-header),
  aside,
  footer {
    display: none !important;
  }

  /* Reset body for clean print */
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    width: 100% !important;
    height: auto !important;
  }

  /* Show invoice page content - ensure it's visible */
  .invoice-page {
    display: block !important;
    position: relative !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }
}
</style>

