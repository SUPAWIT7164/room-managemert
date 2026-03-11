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
        title: 'ตารางจองห้อง',
        to: 'bookings-avaliable',
      },
      // หน้า calendar ปิดใช้ — ใช้ตารางห้องว่างแทน
      // { title: 'ตารางการใช้งาน', to: 'bookings-calendar' },
      {
        title: 'รายการการจอง',
        to: 'bookings-list',
      },
      // Hidden: pending-approvals
      // {
      //   title: 'คำขอลงทะเบียน',
      //   to: 'pending-approvals',
      // },
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
      // Hidden: rooms-lighting
      // {
      //   title: 'ไฟ',
      //   to: 'rooms-lighting',
      // },
      // Hidden: rooms-air-conditioning
      // {
      //   title: 'แอร์',
      //   to: 'rooms-air-conditioning',
      // },
      // {
      //   title: 'CCTV',
      //   to: 'cctv',
      // },
    ],
  },
  {
    title: 'สถานะปัจจุบัน',
    icon: { icon: 'tabler-users' },
    children: [
      // ปิดใช้ — หน้า /reports/current-service-users
      // {
      //   title: 'ผู้ใช้เข้าใช้บริการปัจจุบัน',
      //   to: 'reports-current-service-users',
      // },
      {
        title: 'Floor Plan',
        to: 'floor-plan',
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
        to: 'reports-water-usage',
      },
      {
        title: 'ค่าใช้จ่ายค่าไฟและค่าน้ำ',
        to: 'utilities-expenses',
      },
      {
        title: 'รายงานค่าใช้จ่ายของผู้เช่าร้านค้า',
        to: 'utilities-tenant-expenses',
      },
      {
        title: 'สภาพแวดล้อมภายในห้อง',
        to: 'reports-environment',
      },
      {
        title: 'ตั้งค่า',
        children: [
          {
            title: 'การแจ้งเตือน',
            to: 'energy-notification',
          },
        ],
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
