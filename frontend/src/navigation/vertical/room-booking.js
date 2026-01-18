export default [
  {
    title: 'แดชบอร์ด',
    icon: { icon: 'tabler-smart-home' },
    to: 'dashboard',
  },
  {
    title: 'การจอง',
    icon: { icon: 'tabler-calendar' },
    children: [
      {
        title: 'ลงทะเบียนใบหน้า',
        to: 'face-register',
      },
      {
        title: 'ตารางการใช้งาน',
        to: 'bookings-calendar',
      },
      {
        title: 'รายการการจอง',
        to: 'bookings-list',
      },
      {
        title: 'คำขอลงทะเบียน',
        to: 'pending-approvals',
      },
      {
        title: 'รายงาน',
        children: [
          {
            title: 'รายงานการเข้าใช้บริการ',
            to: 'bookings-statistic',
          },
          {
            title: 'รายงานการใช้งานห้อง',
            to: 'bookings-report',
          },
        ],
      },
      {
        title: 'ตั้งค่า',
        children: [
          {
            title: 'โควต้าการใช้งาน',
            to: 'reports-usage-quota',
          },
          {
            title: 'ห้อง',
            to: 'rooms-list',
          },
        ],
      },
    ],
  },
  {
    title: 'ระบบควบคุม',
    icon: { icon: 'tabler-adjustments' },
    children: [
      {
        title: 'ระบบควบคุมห้อง',
        to: 'rooms-control',
      },
      {
        title: 'ไฟ',
        to: 'rooms-lighting',
      },
      {
        title: 'แอร์',
        to: 'rooms-air-conditioning',
      },
      {
        title: 'CCTV',
        to: 'cctv',
      },
    ],
  },
  {
    title: 'พลังงานและสิ่งแวดล้อม',
    icon: { icon: 'tabler-leaf' },
    children: [
      {
        title: 'รายงานการใช้พลังงาน',
        to: 'energy-report',
      },
      {
        title: 'การใช้น้ำ',
        to: 'reports-usage-quota',
      },
    ],
  },
  {
    title: 'ตั้งค่าระบบ',
    icon: { icon: 'tabler-settings' },
    children: [
      {
        title: 'ผู้ใช้งาน',
        to: 'users-list',
      },
      {
        title: 'อุปกรณ์',
        to: 'devices-list',
      },
    ],
  },
]
