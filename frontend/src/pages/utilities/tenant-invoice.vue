<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import moment from 'moment'
import 'moment/locale/th'
import psruLogo from '@images/PSURlogo.png'
import signProcessed from '@images/รายเซ็น_processed.png'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const route = useRoute()

moment.locale('th')

const VAT_RATE = 0.07
const round2 = n => Math.round(Number(n) * 100) / 100

const UNIVERSITY_TH = 'มหาวิทยาลัยราชภัฏพิบูลสงคราม'
const DEPT_TH = 'โรงอาหาร ศูนย์อาหารทะเลแก้วนิเวศ'
const INVOICE_ADDRESS =
  '156 หมู่ 5 ถนนสุรินทร์-พิบูลสงคราม ต.ในเมือง อ.เมือง จ.พิษณุโลก 65000'

const tenantsData = [
  {
    id: 1,
    lockNumber: 'A01',
    tenantName: 'ร้านกาแฟสตาร์บัคส์',
    contactPhone: '02-123-4567',
    waterUsage: 16.67,
    waterFee: 250,
    electricityUsage: 528.57,
    electricityFee: 1850,
    rentalFee: 8500,
    otherFee: 0,
  },
  {
    id: 2,
    lockNumber: 'A02',
    tenantName: 'ร้านอาหารไทยอร่อย',
    contactPhone: '02-234-5678',
    waterUsage: 21.33,
    waterFee: 320,
    electricityUsage: 685.71,
    electricityFee: 2400,
    rentalFee: 12000,
    otherFee: 0,
  },
  {
    id: 3,
    lockNumber: 'A03',
    tenantName: 'ร้านเสื้อผ้าแฟชั่น',
    contactPhone: '02-345-6789',
    waterUsage: 10,
    waterFee: 150,
    electricityUsage: 271.43,
    electricityFee: 950,
    rentalFee: 5000,
    otherFee: 0,
  },
  {
    id: 4,
    lockNumber: 'B01',
    tenantName: 'ร้านเครื่องสำอางค์',
    contactPhone: '02-456-7890',
    waterUsage: 12,
    waterFee: 180,
    electricityUsage: 342.86,
    electricityFee: 1200,
    rentalFee: 6500,
    otherFee: 0,
  },
  {
    id: 5,
    lockNumber: 'B02',
    tenantName: 'ร้านหนังสือ',
    contactPhone: '02-567-8901',
    waterUsage: 8,
    waterFee: 120,
    electricityUsage: 242.86,
    electricityFee: 850,
    rentalFee: 3800,
    otherFee: 0,
  },
  {
    id: 6,
    lockNumber: 'B03',
    tenantName: 'ร้านอิเล็กทรอนิกส์',
    contactPhone: '02-678-9012',
    waterUsage: 13.33,
    waterFee: 200,
    electricityUsage: 600,
    electricityFee: 2100,
    rentalFee: 9500,
    otherFee: 0,
  },
]

const tenantId = computed(() => {
  return route.query.id ? Number.parseInt(String(route.query.id), 10) : null
})

const lockNumber = computed(() => {
  return route.query.lockNumber || null
})

const tenant = computed(() => {
  if (tenantId.value)
    return tenantsData.find(t => t.id === tenantId.value)

  if (lockNumber.value)
    return tenantsData.find(t => t.lockNumber === lockNumber.value)

  return tenantsData[0]
})

const isEditing = ref(false)
let nextLineId = 1
const form = reactive({
  tenantName: '',
  address: INVOICE_ADDRESS,
  issueDate: '',
  paymentDueDate: '',
  lines: [],
})

const toNumber = (value) => {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

const toDisplayDate = (value, fallbackDate) => {
  const m = moment(value, ['DD/MM/YYYY', 'YYYY-MM-DD'], true)
  return m.isValid() ? m.format('DD/MM/YYYY') : fallbackDate
}

const resetFormFromTenant = () => {
  if (!tenant.value)
    return

  form.tenantName = tenant.value.tenantName || ''
  form.address = INVOICE_ADDRESS
  form.issueDate = moment().format('DD/MM/YYYY')
  form.paymentDueDate = moment().add(15, 'days').format('DD/MM/YYYY')
  form.lines = [
    { id: nextLineId++, desc: 'ค่าเช่าพื้นที่', amount: toNumber(tenant.value.rentalFee) },
    { id: nextLineId++, desc: 'ค่าน้ำประปา', amount: toNumber(tenant.value.waterFee) },
    { id: nextLineId++, desc: 'ค่าไฟฟ้า', amount: toNumber(tenant.value.electricityFee) },
    { id: nextLineId++, desc: 'ค่าธรรมเนียมอื่นๆ', amount: toNumber(tenant.value.otherFee) },
  ]
}

watch(tenant, () => {
  isEditing.value = false
  resetFormFromTenant()
}, { immediate: true })

const startEdit = () => {
  isEditing.value = true
}

const cancelEdit = () => {
  resetFormFromTenant()
  isEditing.value = false
}

const saveEdit = () => {
  form.tenantName = (form.tenantName || '').trim()
  form.address = (form.address || '').trim()
  form.issueDate = toDisplayDate(form.issueDate, moment().format('DD/MM/YYYY'))
  form.paymentDueDate = toDisplayDate(form.paymentDueDate, moment().add(15, 'days').format('DD/MM/YYYY'))
  form.lines = form.lines
    .map(line => ({
      id: line.id,
      desc: (line.desc || '').trim(),
      amount: toNumber(line.amount),
    }))
    .filter(line => line.desc.length > 0 || line.amount > 0)
  isEditing.value = false
}

const addInvoiceLine = () => {
  form.lines.push({
    id: nextLineId++,
    desc: 'รายการใหม่',
    amount: 0,
  })
}

const removeInvoiceLine = (id) => {
  if (form.lines.length <= 1)
    return
  form.lines = form.lines.filter(line => line.id !== id)
}

const invoiceLines = computed(() => {
  if (!tenant.value)
    return []
  return form.lines.map((line, i) => {
    const before = toNumber(line.amount)
    const vat = round2(before * VAT_RATE)
    const net = round2(before + vat)
    return {
      no: i + 1,
      id: line.id,
      desc: line.desc,
      beforeVat: before,
      vat,
      net,
    }
  })
})

const grandTotal = computed(() =>
  round2(invoiceLines.value.reduce((s, r) => s + r.net, 0)),
)

const issueDateDisplay = computed(() => form.issueDate)
const paymentDueDisplay = computed(() => form.paymentDueDate)

const formatCurrency = value => {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const numberToThaiText = (num) => {
  const thaiNumbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
  const thaiUnits = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']

  if (num === 0)
    return 'ศูนย์บาทถ้วน'

  const integerPart = Math.floor(num)
  const decimalPart = Math.round((num - integerPart) * 100)

  let result = ''
  const numStr = integerPart.toString()

  if (numStr.length > 0) {
    for (let i = 0; i < numStr.length; i++) {
      const digit = Number.parseInt(numStr[numStr.length - 1 - i], 10)
      const position = i % 6
      const unit = thaiUnits[position]

      if (digit > 0) {
        if (position === 1) {
          if (digit === 1) {
            result = `สิบ${result}`
          }
          else if (digit === 2) {
            result = `ยี่สิบ${result}`
          }
          else {
            result = `${thaiNumbers[digit]}${unit}${result}`
          }
        }
        else if (position === 0 && digit === 1 && numStr.length > 1 && Number.parseInt(numStr[numStr.length - 2], 10) !== 0) {
          result = `เอ็ด${result}`
        }
        else {
          result = `${thaiNumbers[digit]}${unit}${result}`
        }
      }
    }
  }

  result += 'บาท'

  if (decimalPart > 0) {
    if (decimalPart < 10) {
      result += `${thaiNumbers[decimalPart]}สตางค์`
    }
    else if (decimalPart < 20) {
      if (decimalPart === 10) {
        result += 'สิบสตางค์'
      }
      else {
        result += `สิบ${thaiNumbers[decimalPart % 10]}สตางค์`
      }
    }
    else {
      const tens = Math.floor(decimalPart / 10)
      const ones = decimalPart % 10
      if (tens === 2) {
        result += 'ยี่สิบ'
      }
      else {
        result += `${thaiNumbers[tens]}สิบ`
      }
      if (ones > 0) {
        result += thaiNumbers[ones]
      }
      result += 'สตางค์'
    }
  }
  else {
    result += 'ถ้วน'
  }

  return result
}

const printInvoice = () => {
  window.print()
}

onMounted(() => {
  if (!tenant.value) {
    console.warn('ไม่พบข้อมูลผู้เช่า')
  }
})
</script>

<template>
  <div class="invoice-page">
    <VRow class="mb-4 no-print">
      <VCol cols="12">
        <VCard>
          <VCardText>
            <div class="d-flex align-center justify-space-between flex-wrap gap-3">
              <div class="d-flex align-center flex-wrap gap-2">
                <VBtn
                  variant="outlined"
                  prepend-icon="tabler-arrow-left"
                  @click="$router.back()"
                >
                  กลับ
                </VBtn>
                <VBtn
                  v-if="!isEditing"
                  color="warning"
                  variant="tonal"
                  prepend-icon="tabler-edit"
                  @click="startEdit"
                >
                  แก้ไขใบแจ้งหนี้
                </VBtn>
                <template v-else>
                  <VBtn
                    color="success"
                    prepend-icon="tabler-device-floppy"
                    @click="saveEdit"
                  >
                    บันทึก
                  </VBtn>
                  <VBtn
                    color="secondary"
                    variant="tonal"
                    prepend-icon="tabler-x"
                    @click="cancelEdit"
                  >
                    ยกเลิก
                  </VBtn>
                </template>
              </div>
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

    <VCard
      v-if="tenant"
      class="invoice-card"
    >
      <VCardText class="pa-6 pa-md-10 invoice-content">
        <div class="invoice-doc">
          <!-- Header -->
          <header class="doc-header">
            <div class="doc-logo-wrap">
              <img
                :src="psruLogo"
                alt=""
                class="doc-logo"
                width="88"
                height="88"
              >
            </div>
            <p class="doc-line doc-line--th doc-line--uni">
              {{ UNIVERSITY_TH }}
            </p>
            <p class="doc-line doc-line--th doc-line--dept">
              {{ DEPT_TH }}
            </p>
            <div class="doc-title-row">
              <h1 class="doc-title">
                ใบแจ้งหนี้
              </h1>
              <div class="doc-title-meta">
                <div class="doc-title-meta-line">
                  วันที่:
                  <template v-if="isEditing">
                    <VTextField
                      v-model="form.issueDate"
                      density="compact"
                      variant="outlined"
                      hide-details
                      class="inline-edit-field inline-edit-field--date"
                    />
                  </template>
                  <span
                    v-else
                    class="doc-title-meta-value"
                  >{{ issueDateDisplay }}</span>
                </div>
                <div class="doc-title-meta-line">
                  กำหนดชำระ:
                  <template v-if="isEditing">
                    <VTextField
                      v-model="form.paymentDueDate"
                      density="compact"
                      variant="outlined"
                      hide-details
                      class="inline-edit-field inline-edit-field--date"
                    />
                  </template>
                  <span
                    v-else
                    class="doc-title-meta-value"
                  >{{ paymentDueDisplay }}</span>
                </div>
              </div>
            </div>
          </header>

          <!-- Meta fields -->
          <section class="doc-meta">
            <div class="meta-sheet">
              <div class="meta-item">
                <p class="meta-label-line">
                  ชื่อร้านค้า:
                  <template v-if="isEditing">
                    <VTextField
                      v-model="form.tenantName"
                      density="compact"
                      variant="outlined"
                      hide-details
                      class="inline-edit-field"
                    />
                  </template>
                  <span
                    v-else
                    class="meta-inline-value"
                  >{{ form.tenantName }}</span>
                </p>
              </div>
              <div class="meta-item meta-item--full">
                <p class="meta-label-line">
                  ที่อยู่:
                  <template v-if="isEditing">
                    <VTextField
                      v-model="form.address"
                      density="compact"
                      variant="outlined"
                      hide-details
                      class="inline-edit-field inline-edit-field--wide"
                    />
                  </template>
                  <span
                    v-else
                    class="meta-inline-value meta-inline-value--wrap"
                  >{{ form.address }}</span>
                </p>
              </div>
            </div>
          </section>

          <!-- Table -->
          <div class="table-responsive invoice-table-wrap">
            <div
              v-if="isEditing"
              class="table-actions no-print"
            >
              <VBtn
                size="small"
                color="primary"
                variant="tonal"
                prepend-icon="tabler-plus"
                @click="addInvoiceLine"
              >
                เพิ่มรายการ
              </VBtn>
            </div>
            <table class="invoice-table">
              <thead>
                <tr>
                  <th class="col-no">
                    ลำดับ
                  </th>
                  <th class="col-desc">
                    รายการ
                  </th>
                  <th class="col-num">
                    ยอดรวมสุทธิ<br><span class="th-unit">บาท</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in invoiceLines"
                  :key="row.id"
                >
                  <td class="text-center">
                    {{ row.no }}
                  </td>
                  <td>
                    <template v-if="isEditing">
                      <div class="desc-edit-wrap">
                        <VTextField
                          v-model="form.lines.find(x => x.id === row.id).desc"
                          density="compact"
                          variant="outlined"
                          hide-details
                          class="desc-edit-field"
                        />
                        <VBtn
                          icon
                          size="small"
                          variant="text"
                          color="error"
                          :disabled="form.lines.length <= 1"
                          @click="removeInvoiceLine(row.id)"
                        >
                          <VIcon icon="tabler-trash" />
                        </VBtn>
                      </div>
                    </template>
                    <template v-else>
                      {{ row.desc }}
                    </template>
                  </td>
                  <td class="text-right">
                    <template v-if="isEditing">
                      <VTextField
                        v-model.number="form.lines.find(x => x.id === row.id).amount"
                        type="number"
                        min="0"
                        step="0.01"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="table-edit-field"
                      />
                    </template>
                    <template v-else>
                      {{ formatCurrency(row.net) }}
                    </template>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="summary-row summary-row--total">
                  <td
                    colspan="2"
                    class="summary-label summary-label--strong"
                  >
                    รวมยอดเงินที่ต้องชำระ
                  </td>
                  <td class="text-right summary-grand">
                    {{ formatCurrency(grandTotal) }}
                  </td>
                </tr>
                <tr class="amount-words-row">
                  <td colspan="3">
                    <span class="amount-words-label">จำนวนเงินเป็นตัวอักษร:</span>
                    {{ numberToThaiText(grandTotal) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Footer -->
          <footer class="doc-footer">
            <div class="footer-col footer-col--pay">
              <p class="footer-pay-title">
                ช่องทางการชำระเงิน
              </p>
              <p class="footer-pay-item">
                โอนเงินผ่านธนาคาร ธนาคารกรุงไทย<br>
                ชื่อบัญชี มหาวิทยาลัยราชภัฏพิบูลสงคราม<br>
                เลขบัญชี 623-0-45871-9
              </p>
            </div>
            <div class="footer-col footer-col--sign">
              <div class="footer-sign-block">
                <img
                  :src="signProcessed"
                  alt=""
                  class="footer-sign-img"
                >
                <p class="footer-sign-name">
                  ( นาย ศุภวิชญ์ นิปูณะ )
                </p>
                <p class="footer-sign-line">
                  ลงชื่อผู้รับเงิน / ผู้แจ้งหนี้
                </p>
              </div>
            </div>
          </footer>
        </div>
      </VCardText>
    </VCard>

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
@import url('https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,400;0,600;0,700;1,400&display=swap');

/* ——— Screen / document ——— */
.invoice-doc {
  font-family: Sarabun, 'Noto Sans Thai', system-ui, sans-serif;
  color: #111;
  font-size: 15px;
  line-height: 1.45;
  max-width: 210mm;
  margin: 0 auto;
}

.doc-header {
  position: relative;
  text-align: left;
  margin-bottom: 1.25rem;
  min-height: 96px;
  padding-left: 104px;
  padding-top: 0.45rem;
}

.doc-logo-wrap {
  position: absolute;
  top: 0;
  left: 0;
  margin: 0;
}

.doc-logo {
  width: 88px;
  height: 88px;
  object-fit: contain;
  display: block;
  border: none;
  border-radius: 0;
  padding: 0;
  background: transparent;
  box-shadow: none;
  outline: none;
}

.doc-line {
  margin: 0.15rem 0;
  font-size: 15px;
}

.doc-line--th {
  font-weight: 600;
}

.doc-line--uni {
  font-size: 21px;
  line-height: 1.25;
}

.doc-line--dept {
  margin-top: 0.35rem;
  font-size: 18px;
  line-height: 1.25;
}

.doc-title {
  margin: 1rem 0 0;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.doc-title-row {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 0.25rem;
  margin-top: 0;
  width: auto;
  text-align: right;
}

.doc-title-row .doc-title {
  margin: 0 0 0.1rem;
  text-align: right;
}

.doc-title-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  font-size: 14px;
  line-height: 1.4;
  font-weight: 600;
  white-space: nowrap;
}

.doc-title-meta-value {
  font-weight: 400;
}

/* ——— Meta ——— */
.doc-meta {
  margin-bottom: 1.25rem;
}

.meta-sheet {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 2rem;
  row-gap: 0.85rem;
}

.meta-item--full {
  grid-column: 1 / -1;
}

.meta-label-line {
  margin: 0 0 0.2rem;
  font-weight: 600;
  font-size: 14px;
  line-height: 1.35;
}

.inline-edit-field {
  display: inline-flex;
  width: min(360px, 100%);
  margin-left: 0.35rem;
  vertical-align: middle;
}

.inline-edit-field--wide {
  width: min(760px, 100%);
}

.inline-edit-field--date {
  width: 150px;
  margin-left: 0.35rem;
}

.table-edit-field {
  width: 140px;
  margin-left: auto;
}

.meta-inline-value {
  font-weight: 400;
}

.meta-inline-value--wrap {
  word-break: break-word;
}

.meta-value-line {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  padding-left: 0.15rem;
  word-break: break-word;
}

@media (max-width: 599.98px) {
  .doc-header {
    text-align: center;
    padding-left: 0;
    min-height: auto;
  }

  .doc-logo-wrap {
    position: static;
    width: fit-content;
    margin: 0 auto 0.5rem;
  }

  .doc-title-row {
    position: static;
    align-items: flex-end;
    text-align: right;
    gap: 0.35rem;
    width: 100%;
  }

  .doc-title-meta {
    text-align: right;
    white-space: normal;
  }

  .meta-sheet {
    grid-template-columns: 1fr;
    column-gap: 0;
  }
}

/* ——— Table ——— */
.invoice-table-wrap {
  margin-bottom: 1rem;
}

.table-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}

.invoice-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #1a1a1a;
  font-size: 14px;
}

.invoice-table th,
.invoice-table td {
  border: 1px solid #1a1a1a;
  padding: 0.4rem 0.5rem;
  vertical-align: top;
}

.invoice-table thead th {
  background: #dce6f1;
  font-weight: 600;
  text-align: center;
  line-height: 1.35;
}

.th-unit {
  font-weight: 400;
  font-size: 0.88em;
}

.col-no {
  width: 52px;
}

.col-desc {
  min-width: 140px;
}

.col-num {
  width: 17%;
  white-space: nowrap;
}

.invoice-table tbody td.text-right {
  font-variant-numeric: tabular-nums;
}

.desc-edit-wrap {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.desc-edit-field {
  width: 100%;
}

.summary-row td {
  background: #f3f7fc;
}

.summary-row--total td {
  background: #dce6f1;
  font-weight: 600;
}

.summary-label {
  text-align: right;
  font-weight: 600;
}

.summary-label--strong {
  font-weight: 700;
}

.summary-grand {
  font-weight: 700;
}

.summary-emp {
  color: #666;
}

.amount-words-row td {
  font-size: 14px;
  padding: 0.5rem 0.65rem;
}

.amount-words-label {
  font-weight: 600;
  margin-right: 0.35rem;
}

/* ——— Footer ——— */
.doc-footer {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
  margin-top: 1.25rem;
  padding-top: 0.75rem;
  border-top: 1px solid #ccc;
}

.footer-col {
  flex: 0 1 auto;
}

.footer-col--pay {
  flex: 1 1 200px;
  min-width: 0;
}

.footer-col--sign {
  max-width: 340px;
  flex: 0 0 auto;
}

.footer-sign-block {
  margin-top: 0;
  text-align: right;
}

.footer-sign-img {
  display: block;
  max-width: 200px;
  max-height: 72px;
  width: auto;
  height: auto;
  object-fit: contain;
  margin: 0 0 0.2rem auto;
}

.footer-sign-name {
  margin: 0 0 0.35rem;
  font-size: 14px;
  font-weight: 600;
}

.footer-sign-line {
  margin: 0;
  font-size: 14px;
}

.footer-pay-title {
  font-weight: 600;
  margin: 0 0 0.35rem;
}

.footer-pay-item {
  margin: 0 0 0.35rem;
  font-size: 13px;
  line-height: 1.45;
}

.doc-thanks {
  text-align: center;
  margin: 1.25rem 0 0;
  font-size: 14px;
  font-weight: 600;
}

/* ——— Layout card ——— */
.invoice-card {
  max-width: 220mm;
  margin: 0 auto;
  background: #fff;
}

@media screen {
  .invoice-page {
    padding-bottom: 2rem;
  }

  .invoice-card {
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
  }
}

/* ——— Print ——— */
@media print {
  @page {
    size: A4 portrait;
    margin: 10mm;
  }

  .no-print,
  .no-print * {
    display: none !important;
  }

  .invoice-page {
    padding: 0 !important;
    margin: 0 !important;
  }

  .invoice-card {
    box-shadow: none !important;
    border: none !important;
    max-width: 100% !important;
  }

  .invoice-content {
    padding: 0 !important;
  }

  .invoice-doc {
    font-size: 11pt;
  }

  .doc-title {
    font-size: 14pt;
  }

  .invoice-table {
    font-size: 9.5pt;
  }

  .doc-footer {
    break-inside: avoid;
  }
}
</style>

<style lang="scss">
@media print {
  .v-navigation-drawer,
  .v-app-bar,
  .v-toolbar,
  .v-footer,
  .layout-navbar,
  .layout-footer,
  nav,
  header:not(.doc-header),
  aside,
  footer:not(.doc-footer) {
    display: none !important;
  }

  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }

  .invoice-page {
    display: block !important;
    width: 100% !important;
  }
}
</style>
