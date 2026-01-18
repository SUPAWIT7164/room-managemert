require('dotenv').config();
const { pool } = require('../config/database');

// Mock data for visitors/face registrations
const mockVisitors = [
  {
    prefix_name: null,
    prefix_name_en: null,
    name: 'Vernelle Noel',
    name_en: 'Vernelle Noel',
    email: 'vernelle.noel@example.com',
    phone: '081-234-5678',
    citizen_id: '1234567890123',
    faculty: 'Carnegie Mellon University',
    address: '123 University Street, Pittsburgh, PA 15213',
    visitor_type: 'บุคคลภายนอก',
    approve: null, // pending
    image: null,
  },
  {
    prefix_name: 'อาจารย์',
    prefix_name_en: 'Dr.',
    name: 'Michael Burgett',
    name_en: 'Michael Burgett',
    email: 'michael.burgett@cmu.ac.th',
    phone: '082-345-6789',
    citizen_id: '2345678901234',
    faculty: 'Faculty of Agriculture, Chiang Mai University',
    address: '239 Huay Kaew Road, Suthep, Muang, Chiang Mai 50200',
    visitor_type: 'อาจารย์',
    approve: 1, // approved
    image: null,
  },
  {
    prefix_name: null,
    prefix_name_en: null,
    name: 'สมชาย ใจดี',
    name_en: 'Somchai Jaidee',
    email: 'somchai.jaidee@example.com',
    phone: '083-456-7890',
    citizen_id: '3456789012345',
    faculty: 'คณะวิศวกรรมศาสตร์',
    address: '123 ถนนมหาวิทยาลัย ตำบลในเมือง อำเภอเมือง จังหวัดสุรินทร์ 32000',
    visitor_type: 'บุคคลภายนอก',
    approve: null, // pending
    image: null,
  },
  {
    prefix_name: 'อาจารย์',
    prefix_name_en: 'Dr.',
    name: 'สมหญิง รักดี',
    name_en: 'Somying Rakdee',
    email: 'somying.rakdee@rmuti.ac.th',
    phone: '084-567-8901',
    citizen_id: '4567890123456',
    faculty: 'คณะวิทยาศาสตร์',
    address: '456 ถนนวิทยาลัย ตำบลนอกเมือง อำเภอเมือง จังหวัดสุรินทร์ 32000',
    visitor_type: 'อาจารย์',
    approve: 1, // approved
    image: null,
  },
  {
    prefix_name: null,
    prefix_name_en: null,
    name: 'วิชัย เก่งมาก',
    name_en: 'Wichai Kengmak',
    email: 'wichai.kengmak@example.com',
    phone: '085-678-9012',
    citizen_id: '5678901234567',
    faculty: 'คณะบริหารธุรกิจ',
    address: '789 ถนนการศึกษา ตำบลกลางเมือง อำเภอเมือง จังหวัดสุรินทร์ 32000',
    visitor_type: 'บุคคลภายนอก',
    approve: 0, // rejected
    image: null,
  },
  {
    prefix_name: 'อาจารย์',
    prefix_name_en: 'Prof.',
    name: 'นางสาว สุชาดา วิไล',
    name_en: 'Suchada Wilai',
    email: 'suchada.wilai@rmuti.ac.th',
    phone: '086-789-0123',
    citizen_id: '6789012345678',
    faculty: 'คณะครุศาสตร์',
    address: '321 ถนนราชมงคล ตำบลในเมือง อำเภอเมือง จังหวัดสุรินทร์ 32000',
    visitor_type: 'อาจารย์',
    approve: null, // pending
    image: null,
  },
  {
    prefix_name: null,
    prefix_name_en: null,
    name: 'John Smith',
    name_en: 'John Smith',
    email: 'john.smith@example.com',
    phone: '087-890-1234',
    citizen_id: '7890123456789',
    faculty: 'MIT',
    address: '77 Massachusetts Ave, Cambridge, MA 02139',
    visitor_type: 'บุคคลภายนอก',
    approve: null, // pending
    image: null,
  },
  {
    prefix_name: 'อาจารย์',
    prefix_name_en: 'Dr.',
    name: 'Sarah Johnson',
    name_en: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    phone: '088-901-2345',
    citizen_id: '8901234567890',
    faculty: 'Stanford University',
    address: '450 Serra Mall, Stanford, CA 94305',
    visitor_type: 'อาจารย์',
    approve: 1, // approved
    image: null,
  },
  {
    prefix_name: null,
    prefix_name_en: null,
    name: 'David Lee',
    name_en: 'David Lee',
    email: 'david.lee@example.com',
    phone: '089-012-3456',
    citizen_id: '9012345678901',
    faculty: 'Harvard University',
    address: 'Cambridge, MA 02138',
    visitor_type: 'บุคคลภายนอก',
    approve: null, // pending
    image: null,
  },
  {
    prefix_name: 'อาจารย์',
    prefix_name_en: 'Prof.',
    name: 'Maria Garcia',
    name_en: 'Maria Garcia',
    email: 'maria.garcia@example.com',
    phone: '090-123-4567',
    citizen_id: '0123456789012',
    faculty: 'University of California, Berkeley',
    address: 'Berkeley, CA 94720',
    visitor_type: 'อาจารย์',
    approve: 0, // rejected
    image: null,
  },
];

// Function to seed visitors
async function seedVisitors() {
  try {
    console.log('🌱 Starting to seed visitors...');

    // Check if visitors table exists
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'visitors'
    `, [process.env.DB_NAME || 'smart_room_booking']);

    if (tables.length === 0) {
      console.log('⚠️  Visitors table does not exist. Creating table...');
      
      // Create visitors table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS visitors (
          id INT AUTO_INCREMENT PRIMARY KEY,
          prefix_name VARCHAR(50) NULL,
          prefix_name_en VARCHAR(50) NULL,
          name VARCHAR(255) NOT NULL,
          name_en VARCHAR(255) NULL,
          email VARCHAR(255) NULL,
          phone VARCHAR(20) NULL,
          citizen_id VARCHAR(20) NULL,
          faculty VARCHAR(255) NULL,
          address TEXT NULL,
          visitor_type VARCHAR(100) NULL DEFAULT 'บุคคลภายนอก',
          image VARCHAR(500) NULL,
          approve TINYINT(1) NULL COMMENT 'NULL = pending, 1 = approved, 0 = rejected',
          ip VARCHAR(45) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_approve (approve),
          INDEX idx_created_at (created_at),
          INDEX idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      console.log('✅ Visitors table created successfully');
    }

    // Check table structure to see which columns exist
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'visitors'
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_NAME || 'smart_room_booking']);
    
    const columnNames = columns.map(col => col.COLUMN_NAME);
    
    console.log(`📋 Table structure detected:`);
    console.log(`   Available columns: ${columnNames.join(', ')}`);
    
    // Map common column name variations
    const hasFirstName = columnNames.includes('first_name');
    const hasLastName = columnNames.includes('last_name');
    const hasFullName = columnNames.includes('name') || columnNames.includes('full_name');
    const emailCol = columnNames.includes('email') ? 'email' : null;
    const phoneCol = columnNames.includes('phone') ? 'phone' : null;
    const facultyCol = columnNames.includes('company') ? 'company' : 
                      columnNames.includes('faculty') ? 'faculty' :
                      columnNames.includes('organization') ? 'organization' : null;
    const statusCol = columnNames.includes('status') ? 'status' :
                     columnNames.includes('approve') ? 'approve' : null;
    const imageCol = columnNames.includes('photo') ? 'photo' :
                    columnNames.includes('image') ? 'image' : null;
    
    if (!hasFirstName && !hasLastName && !hasFullName) {
      throw new Error('Cannot find name column in visitors table. Available columns: ' + columnNames.join(', '));
    }

    // Check if data already exists
    const [existing] = await pool.query('SELECT COUNT(*) as count FROM visitors');
    if (existing[0].count > 0 && !process.argv.includes('--force')) {
      console.log(`⚠️  Found ${existing[0].count} existing visitors.`);
      console.log('Skipping seed. Use --force flag to force seed.');
      return;
    }

    // Insert mock data
    console.log(`📝 Inserting ${mockVisitors.length} visitors...`);
    
    for (const visitor of mockVisitors) {
      // Set created_at to different dates (some older, some recent)
      const daysAgo = Math.floor(Math.random() * 30); // Random date within last 30 days
      const createdDate = new Date();
      createdDate.setDate(createdDate.getDate() - daysAgo);
      
      // Build INSERT query based on available columns
      const fields = [];
      const values = [];
      
      // Add visitor_number if required (unique constraint)
      if (columnNames.includes('visitor_number')) {
        // Generate unique visitor number: V + timestamp + random
        const visitorNumber = `V${Date.now()}${Math.floor(Math.random() * 1000)}`;
        fields.push('visitor_number');
        values.push(visitorNumber);
      }
      
      // Handle name fields
      if (hasFirstName && hasLastName) {
        // Split name into first and last
        const nameParts = (visitor.name || '').trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || firstName;
        fields.push('first_name', 'last_name');
        values.push(firstName, lastName);
      } else if (hasFullName) {
        const nameCol = columnNames.includes('name') ? 'name' : 'full_name';
        fields.push(nameCol);
        values.push(visitor.name);
      }
      
      if (emailCol) {
        fields.push(emailCol);
        values.push(visitor.email);
      }
      
      if (phoneCol) {
        fields.push(phoneCol);
        values.push(visitor.phone);
      }
      
      if (facultyCol) {
        fields.push(facultyCol);
        values.push(visitor.faculty);
      }
      
      if (columnNames.includes('position')) {
        fields.push('position');
        values.push(visitor.visitor_type || null);
      }
      
      if (statusCol) {
        fields.push(statusCol);
        // Map approve value: null = pending, 1 = approved, 0 = rejected
        if (statusCol === 'status') {
          // If status is string type
          values.push(visitor.approve === null ? 'pending' : 
                     visitor.approve === 1 ? 'approved' : 'rejected');
        } else {
          // If status is numeric (approve column)
          values.push(visitor.approve);
        }
      }
      
      if (imageCol) {
        fields.push(imageCol);
        values.push(visitor.image);
      }
      
      if (columnNames.includes('visit_date')) {
        fields.push('visit_date');
        values.push(createdDate.toISOString().slice(0, 10)); // YYYY-MM-DD
      }
      
      if (columnNames.includes('created_at')) {
        fields.push('created_at');
        values.push(createdDate.toISOString().slice(0, 19).replace('T', ' '));
      }
      
      const placeholders = fields.map(() => '?').join(', ');
      const query = `INSERT INTO visitors (${fields.join(', ')}) VALUES (${placeholders})`;
      
      await pool.query(query, values);
    }

    console.log('✅ Successfully seeded visitors!');
    console.log(`📊 Total visitors: ${mockVisitors.length}`);
    console.log(`   - Pending: ${mockVisitors.filter(v => v.approve === null).length}`);
    console.log(`   - Approved: ${mockVisitors.filter(v => v.approve === 1).length}`);
    console.log(`   - Rejected: ${mockVisitors.filter(v => v.approve === 0).length}`);

  } catch (error) {
    console.error('❌ Error seeding visitors:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run seed if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  if (force) {
    // Clear existing data
    pool.query('DELETE FROM visitors')
      .then(() => {
        console.log('🗑️  Cleared existing visitors');
        return seedVisitors();
      })
      .catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
      });
  } else {
    seedVisitors()
      .then(() => {
        console.log('✅ Seed completed');
        process.exit(0);
      })
      .catch(error => {
        console.error('❌ Seed failed:', error);
        process.exit(1);
      });
  }
}

module.exports = { seedVisitors, mockVisitors };

