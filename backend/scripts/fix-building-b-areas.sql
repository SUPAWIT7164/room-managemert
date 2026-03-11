-- แก้ไขอาคาร B ไม่มีข้อมูล
-- สถานะ: areas ใน DB มี building_id = 1, 2, 3 แต่ตาราง buildings มีแค่ id=1 (อาคาร A), id=4 (อาคาร B)
-- ตัวเลือก A: ถ้าต้องการให้ areas ที่เคยเป็น building_id=2 กลายเป็นของ "อาคาร B" (id=4)
-- ให้รันคำสั่งด้านล่าง (แก้เลข 2 เป็น 3 ได้ถ้าอาคาร B ควรใช้ areas ของ building_id=3)

-- ตัวอย่าง: ย้าย areas จาก building_id=2 มาเป็นของอาคาร B (building_id=4)
-- UPDATE areas SET building_id = 4 WHERE building_id = 2;

-- ตัวอย่าง: ย้าย areas จาก building_id=3 มาเป็นของอาคาร B (building_id=4)
-- UPDATE areas SET building_id = 4 WHERE building_id = 3;

-- ตรวจสอบก่อนอัปเดต (ดู areas ที่จะถูกเปลี่ยน)
-- SELECT id, name, building_id, floor FROM areas WHERE building_id IN (2, 3);
