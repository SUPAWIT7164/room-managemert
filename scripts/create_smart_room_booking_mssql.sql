-- ============================================================
-- สคริปต์สร้างฐานข้อมูล smart_room_booking บน SQL Server
-- แปลงจาก MySQL: smart_room_booking (1).sql
-- รันใน SSMS: เชื่อมต่อ AZ-BMS-DEV (User: devadmin / Pass: Lannacom@Dev@2025)
-- ============================================================

-- สร้างฐานข้อมูล (รันเมื่อเชื่อมต่อกับ master หรือมีสิทธิ์ dbcreator)
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = N'smart_room_booking')
    CREATE DATABASE [smart_room_booking];
GO

USE [smart_room_booking];
GO

-- ==================== ตารางที่ไม่มี FK (สร้างก่อน) ====================

-- area_types
IF OBJECT_ID(N'dbo.area_types', N'U') IS NULL
CREATE TABLE [dbo].[area_types] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [description] nvarchar(max) NULL,
    [disable] bit NOT NULL DEFAULT 0,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_area_types] PRIMARY KEY ([id])
);

-- building_types
IF OBJECT_ID(N'dbo.building_types', N'U') IS NULL
CREATE TABLE [dbo].[building_types] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [description] nvarchar(max) NULL,
    [disable] bit NOT NULL DEFAULT 0,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_building_types] PRIMARY KEY ([id])
);

-- room_types
IF OBJECT_ID(N'dbo.room_types', N'U') IS NULL
CREATE TABLE [dbo].[room_types] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [description] nvarchar(max) NULL,
    [icon] nvarchar(255) NULL,
    [color] nvarchar(255) NOT NULL DEFAULT N'#4F46E5',
    [disable] bit NOT NULL DEFAULT 0,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_room_types] PRIMARY KEY ([id])
);

-- device_types
IF OBJECT_ID(N'dbo.device_types', N'U') IS NULL
CREATE TABLE [dbo].[device_types] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [description] nvarchar(max) NULL,
    [icon] nvarchar(255) NULL,
    [disable] bit NOT NULL DEFAULT 0,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_device_types] PRIMARY KEY ([id])
);

-- log_types
IF OBJECT_ID(N'dbo.log_types', N'U') IS NULL
CREATE TABLE [dbo].[log_types] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [code] nvarchar(255) NOT NULL,
    [description] nvarchar(max) NULL,
    [color] nvarchar(255) NOT NULL DEFAULT N'#6B7280',
    [disable] bit NOT NULL DEFAULT 0,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_log_types] PRIMARY KEY ([id])
);

-- setting_types
IF OBJECT_ID(N'dbo.setting_types', N'U') IS NULL
CREATE TABLE [dbo].[setting_types] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [code] nvarchar(255) NOT NULL,
    [description] nvarchar(max) NULL,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_setting_types] PRIMARY KEY ([id])
);

-- permissions
IF OBJECT_ID(N'dbo.permissions', N'U') IS NULL
CREATE TABLE [dbo].[permissions] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [guard_name] nvarchar(255) NOT NULL,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_permissions] PRIMARY KEY ([id])
);

-- roles
IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
CREATE TABLE [dbo].[roles] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [guard_name] nvarchar(255) NOT NULL,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_roles] PRIMARY KEY ([id])
);

-- users
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
CREATE TABLE [dbo].[users] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [email] nvarchar(255) NOT NULL,
    [phone] nvarchar(255) NULL,
    [department] nvarchar(255) NULL,
    [position] nvarchar(255) NULL,
    [employee_id] nvarchar(255) NULL,
    [photo] nvarchar(max) NULL,
    [is_active] bit NOT NULL DEFAULT 1,
    [last_login_at] datetime2 NULL,
    [email_verified_at] datetime2 NULL,
    [role] nvarchar(50) NULL DEFAULT N'user',
    [password] nvarchar(255) NOT NULL,
    [remember_token] nvarchar(100) NULL,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_users] PRIMARY KEY ([id])
);

-- cache
IF OBJECT_ID(N'dbo.cache', N'U') IS NULL
CREATE TABLE [dbo].[cache] (
    [key] nvarchar(255) NOT NULL,
    [value] nvarchar(max) NOT NULL,
    [expiration] int NOT NULL,
    CONSTRAINT [PK_cache] PRIMARY KEY ([key])
);

-- cache_locks
IF OBJECT_ID(N'dbo.cache_locks', N'U') IS NULL
CREATE TABLE [dbo].[cache_locks] (
    [key] nvarchar(255) NOT NULL,
    [owner] nvarchar(255) NOT NULL,
    [expiration] int NOT NULL,
    CONSTRAINT [PK_cache_locks] PRIMARY KEY ([key])
);

-- password_reset_tokens
IF OBJECT_ID(N'dbo.password_reset_tokens', N'U') IS NULL
CREATE TABLE [dbo].[password_reset_tokens] (
    [email] nvarchar(255) NOT NULL,
    [token] nvarchar(255) NOT NULL,
    [created_at] datetime2 NULL,
    CONSTRAINT [PK_password_reset_tokens] PRIMARY KEY ([email])
);

-- migrations
IF OBJECT_ID(N'dbo.migrations', N'U') IS NULL
CREATE TABLE [dbo].[migrations] (
    [id] int IDENTITY(1,1) NOT NULL,
    [migration] nvarchar(255) NOT NULL,
    [batch] int NOT NULL,
    CONSTRAINT [PK_migrations] PRIMARY KEY ([id])
);

-- job_batches
IF OBJECT_ID(N'dbo.job_batches', N'U') IS NULL
CREATE TABLE [dbo].[job_batches] (
    [id] nvarchar(255) NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [total_jobs] int NOT NULL,
    [pending_jobs] int NOT NULL,
    [failed_jobs] int NOT NULL,
    [failed_job_ids] nvarchar(max) NOT NULL,
    [options] nvarchar(max) NULL,
    [cancelled_at] int NULL,
    [created_at] int NOT NULL,
    [finished_at] int NULL,
    CONSTRAINT [PK_job_batches] PRIMARY KEY ([id])
);

-- ==================== buildings, areas, rooms ====================

-- buildings
IF OBJECT_ID(N'dbo.buildings', N'U') IS NULL
CREATE TABLE [dbo].[buildings] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [code] nvarchar(255) NOT NULL,
    [description] nvarchar(max) NULL,
    [image] nvarchar(255) NULL,
    [building_type_id] bigint NULL,
    [address] nvarchar(255) NULL,
    [latitude] nvarchar(255) NULL,
    [longitude] nvarchar(255) NULL,
    [disable] bit NOT NULL DEFAULT 0,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_buildings] PRIMARY KEY ([id])
);

-- areas
IF OBJECT_ID(N'dbo.areas', N'U') IS NULL
CREATE TABLE [dbo].[areas] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [code] nvarchar(255) NULL,
    [description] nvarchar(max) NULL,
    [building_id] bigint NOT NULL,
    [area_type_id] bigint NULL,
    [floor] int NULL,
    [disable] bit NOT NULL DEFAULT 0,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_areas] PRIMARY KEY ([id])
);

-- rooms
IF OBJECT_ID(N'dbo.rooms', N'U') IS NULL
CREATE TABLE [dbo].[rooms] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [code] nvarchar(255) NOT NULL,
    [description] nvarchar(max) NULL,
    [building_id] bigint NOT NULL,
    [area_id] bigint NULL,
    [room_type_id] bigint NULL,
    [capacity] int NOT NULL DEFAULT 1,
    [floor] int NULL,
    [image] nvarchar(255) NULL,
    [facilities] nvarchar(max) NULL,
    [auto_approve] bit NOT NULL DEFAULT 0,
    [automation_enabled] bit NOT NULL DEFAULT 0,
    [door_entity_id] nvarchar(255) NULL,
    [sensor_entity_id] nvarchar(255) NULL,
    [disable] bit NOT NULL DEFAULT 0,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_rooms] PRIMARY KEY ([id])
);

-- ==================== devices ====================

-- devices
IF OBJECT_ID(N'dbo.devices', N'U') IS NULL
CREATE TABLE [dbo].[devices] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [code] nvarchar(255) NOT NULL,
    [description] nvarchar(max) NULL,
    [device_type_id] bigint NULL,
    [room_id] bigint NULL,
    [entity_id] nvarchar(255) NULL,
    [device_category] nvarchar(50) NOT NULL DEFAULT N'sensor' CHECK ([device_category] IN (N'sensor',N'control',N'borrowable')),
    [quantity] int NOT NULL DEFAULT 1,
    [available_quantity] int NOT NULL DEFAULT 1,
    [image] nvarchar(255) NULL,
    [specifications] nvarchar(max) NULL,
    [status] nvarchar(50) NOT NULL DEFAULT N'active' CHECK ([status] IN (N'active',N'inactive',N'maintenance',N'')),
    [disable] bit NOT NULL DEFAULT 0,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    [ip] nvarchar(50) NULL,
    [username] nvarchar(100) NULL,
    [password] nvarchar(255) NULL,
    [area_id] int NULL,
    [availability] bit DEFAULT 1,
    [can_borrow] bit DEFAULT 0,
    CONSTRAINT [PK_devices] PRIMARY KEY ([id])
);

-- ==================== ตารางที่เหลือ ====================

-- visitors
IF OBJECT_ID(N'dbo.visitors', N'U') IS NULL
CREATE TABLE [dbo].[visitors] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [visitor_number] nvarchar(255) NOT NULL,
    [first_name] nvarchar(255) NOT NULL,
    [last_name] nvarchar(255) NOT NULL,
    [email] nvarchar(255) NOT NULL,
    [phone] nvarchar(255) NULL,
    [company] nvarchar(255) NULL,
    [position] nvarchar(255) NULL,
    [photo] nvarchar(255) NULL,
    [host_user_id] bigint NULL,
    [purpose] nvarchar(max) NULL,
    [visit_date] date NULL,
    [visit_time] time NULL,
    [status] nvarchar(50) NOT NULL DEFAULT N'pending' CHECK ([status] IN (N'pending',N'approved',N'rejected',N'checked_in',N'checked_out')),
    [approved_by] bigint NULL,
    [approved_at] datetime2 NULL,
    [checked_in_at] datetime2 NULL,
    [checked_out_at] datetime2 NULL,
    [converted_to_user] bit NOT NULL DEFAULT 0,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_visitors] PRIMARY KEY ([id])
);

-- booking_requests
IF OBJECT_ID(N'dbo.booking_requests', N'U') IS NULL
CREATE TABLE [dbo].[booking_requests] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [booking_number] nvarchar(255) NOT NULL,
    [room_id] bigint NOT NULL,
    [user_id] bigint NOT NULL,
    [title] nvarchar(255) NOT NULL,
    [description] nvarchar(max) NULL,
    [objective] nvarchar(255) NULL,
    [start_datetime] datetime2 NOT NULL,
    [end_datetime] datetime2 NOT NULL,
    [attendees] int NOT NULL DEFAULT 1,
    [participants] nvarchar(max) NULL,
    [status] nvarchar(50) NOT NULL DEFAULT N'pending' CHECK ([status] IN (N'pending',N'approved',N'rejected',N'cancelled',N'completed')),
    [approved_by] bigint NULL,
    [rejected_by] bigint NULL,
    [rejection_reason] nvarchar(max) NULL,
    [approved_at] datetime2 NULL,
    [rejected_at] datetime2 NULL,
    [cancelled_at] datetime2 NULL,
    [auto_cancelled] bit NOT NULL DEFAULT 0,
    [attachment] nvarchar(255) NULL,
    [send_notification] bit NOT NULL DEFAULT 1,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_booking_requests] PRIMARY KEY ([id])
);

-- approvers
IF OBJECT_ID(N'dbo.approvers', N'U') IS NULL
CREATE TABLE [dbo].[approvers] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [room_id] bigint NOT NULL,
    [user_id] bigint NOT NULL,
    [order] int NOT NULL DEFAULT 1,
    [is_active] bit NOT NULL DEFAULT 1,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_approvers] PRIMARY KEY ([id])
);

-- room_permissions
IF OBJECT_ID(N'dbo.room_permissions', N'U') IS NULL
CREATE TABLE [dbo].[room_permissions] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [room_id] bigint NOT NULL,
    [user_id] bigint NULL,
    [email] nvarchar(255) NULL,
    [permission_type] nvarchar(50) NOT NULL DEFAULT N'book' CHECK ([permission_type] IN (N'view',N'book',N'manage')),
    [valid_from] date NULL,
    [valid_until] date NULL,
    [is_active] bit NOT NULL DEFAULT 1,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_room_permissions] PRIMARY KEY ([id])
);

-- schedules
IF OBJECT_ID(N'dbo.schedules', N'U') IS NULL
CREATE TABLE [dbo].[schedules] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [room_id] bigint NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [description] nvarchar(max) NULL,
    [day_of_week] nvarchar(20) NOT NULL CHECK ([day_of_week] IN (N'monday',N'tuesday',N'wednesday',N'thursday',N'friday',N'saturday',N'sunday')),
    [start_time] time NOT NULL,
    [end_time] time NOT NULL,
    [automation_actions] nvarchar(max) NULL,
    [is_active] bit NOT NULL DEFAULT 1,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_schedules] PRIMARY KEY ([id])
);

-- borrow_records
IF OBJECT_ID(N'dbo.borrow_records', N'U') IS NULL
CREATE TABLE [dbo].[borrow_records] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [borrow_number] nvarchar(255) NOT NULL,
    [device_id] bigint NOT NULL,
    [user_id] bigint NOT NULL,
    [quantity] int NOT NULL DEFAULT 1,
    [purpose] nvarchar(max) NULL,
    [borrow_date] datetime2 NOT NULL,
    [expected_return_date] datetime2 NOT NULL,
    [actual_return_date] datetime2 NULL,
    [status] nvarchar(50) NOT NULL DEFAULT N'pending' CHECK ([status] IN (N'pending',N'approved',N'rejected',N'borrowed',N'returned',N'overdue')),
    [approved_by] bigint NULL,
    [returned_to] bigint NULL,
    [rejection_reason] nvarchar(max) NULL,
    [notes] nvarchar(max) NULL,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_borrow_records] PRIMARY KEY ([id])
);

-- faces
IF OBJECT_ID(N'dbo.faces', N'U') IS NULL
CREATE TABLE [dbo].[faces] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [user_id] bigint NOT NULL,
    [face_encoding] nvarchar(max) NOT NULL,
    [image_base64] nvarchar(max) NULL,
    [image_path] nvarchar(255) NOT NULL,
    [is_active] bit NOT NULL DEFAULT 1,
    [registered_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_faces] PRIMARY KEY ([id])
);

-- logs
IF OBJECT_ID(N'dbo.logs', N'U') IS NULL
CREATE TABLE [dbo].[logs] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [log_type_id] bigint NOT NULL,
    [user_id] bigint NULL,
    [room_id] bigint NULL,
    [action] nvarchar(255) NOT NULL,
    [description] nvarchar(max) NULL,
    [metadata] nvarchar(max) NULL,
    [ip_address] nvarchar(255) NULL,
    [user_agent] nvarchar(255) NULL,
    [logged_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_logs] PRIMARY KEY ([id])
);

-- settings
IF OBJECT_ID(N'dbo.settings', N'U') IS NULL
CREATE TABLE [dbo].[settings] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [name] nvarchar(255) NULL,
    [name_en] nvarchar(255) NULL,
    [slug] nvarchar(255) NULL,
    [value] nvarchar(max) NULL,
    [unit] nvarchar(255) NULL,
    [unit_en] nvarchar(255) NULL,
    [is_default] bit DEFAULT 0,
    [disable] bit DEFAULT 0,
    [type_id] bigint NULL,
    [module_id] bigint NULL,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_settings] PRIMARY KEY ([id])
);

-- settings_old
IF OBJECT_ID(N'dbo.settings_old', N'U') IS NULL
CREATE TABLE [dbo].[settings_old] (
    [id] bigint NOT NULL DEFAULT 0,
    [key] nvarchar(255) NOT NULL,
    [value] nvarchar(max) NULL,
    [setting_type_id] bigint NULL,
    [label] nvarchar(255) NOT NULL,
    [description] nvarchar(max) NULL,
    [input_type] nvarchar(50) NOT NULL DEFAULT N'text' CHECK ([input_type] IN (N'text',N'number',N'boolean',N'json',N'textarea')),
    [is_public] bit NOT NULL DEFAULT 0,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_settings_old] PRIMARY KEY ([id])
);

-- energy_data
IF OBJECT_ID(N'dbo.energy_data', N'U') IS NULL
CREATE TABLE [dbo].[energy_data] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [device_id] bigint NOT NULL,
    [building_id] bigint NULL,
    [room_id] bigint NULL,
    [power] decimal(10,2) NULL,
    [energy] decimal(10,2) NULL,
    [voltage] decimal(10,2) NULL,
    [current] decimal(10,2) NULL,
    [power_factor] decimal(5,2) NULL,
    [recorded_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_energy_data] PRIMARY KEY ([id])
);

-- environment_data
IF OBJECT_ID(N'dbo.environment_data', N'U') IS NULL
CREATE TABLE [dbo].[environment_data] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [device_id] bigint NOT NULL,
    [building_id] bigint NULL,
    [room_id] bigint NULL,
    [temperature] decimal(5,2) NULL,
    [humidity] decimal(5,2) NULL,
    [co2] decimal(10,2) NULL,
    [pm25] decimal(10,2) NULL,
    [light] decimal(10,2) NULL,
    [people_count] int NULL,
    [additional_data] nvarchar(max) NULL,
    [recorded_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_environment_data] PRIMARY KEY ([id])
);

-- access_logs
IF OBJECT_ID(N'dbo.access_logs', N'U') IS NULL
CREATE TABLE [dbo].[access_logs] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [room_id] bigint NOT NULL,
    [user_id] bigint NULL,
    [booking_request_id] bigint NULL,
    [visitor_id] bigint NULL,
    [access_type] nvarchar(50) NOT NULL DEFAULT N'entry' CHECK ([access_type] IN (N'entry',N'exit',N'denied')),
    [auth_method] nvarchar(50) NOT NULL DEFAULT N'card' CHECK ([auth_method] IN (N'card',N'face',N'pin',N'manual',N'booking')),
    [notes] nvarchar(max) NULL,
    [accessed_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_access_logs] PRIMARY KEY ([id])
);

-- notifications
IF OBJECT_ID(N'dbo.notifications', N'U') IS NULL
CREATE TABLE [dbo].[notifications] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [user_id] bigint NOT NULL,
    [title] nvarchar(255) NOT NULL,
    [message] nvarchar(max) NOT NULL,
    [type] nvarchar(50) NOT NULL DEFAULT N'info' CHECK ([type] IN (N'info',N'success',N'warning',N'error')),
    [related_type] nvarchar(255) NULL,
    [related_id] bigint NULL,
    [action_url] nvarchar(255) NULL,
    [is_read] bit NOT NULL DEFAULT 0,
    [read_at] datetime2 NULL,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_notifications] PRIMARY KEY ([id])
);

-- holidays
IF OBJECT_ID(N'dbo.holidays', N'U') IS NULL
CREATE TABLE [dbo].[holidays] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [date] date NOT NULL,
    [description] nvarchar(max) NULL,
    [is_recurring] bit NOT NULL DEFAULT 0,
    [is_active] bit NOT NULL DEFAULT 1,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_holidays] PRIMARY KEY ([id])
);

-- cctv_area_config: บันทึกพื้นที่วาดนับคนบนหน้า CCTV (โหลด/บันทึกผ่าน API)
IF OBJECT_ID(N'dbo.cctv_area_config', N'U') IS NULL
CREATE TABLE [dbo].[cctv_area_config] (
    [id] int IDENTITY(1,1) NOT NULL,
    [config_key] nvarchar(50) NOT NULL DEFAULT N'default',
    [areas] nvarchar(max) NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_cctv_area_config] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_cctv_area_config_key] UNIQUE ([config_key])
);

-- booking_quotas
IF OBJECT_ID(N'dbo.booking_quotas', N'U') IS NULL
CREATE TABLE [dbo].[booking_quotas] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [user_id] bigint NULL,
    [user_group] nvarchar(255) NULL,
    [room_id] bigint NULL,
    [max_bookings_per_day] int NOT NULL DEFAULT 2,
    [max_bookings_per_week] int NOT NULL DEFAULT 10,
    [max_bookings_per_month] int NOT NULL DEFAULT 30,
    [max_hours_per_booking] int NOT NULL DEFAULT 4,
    [max_advance_days] int NOT NULL DEFAULT 30,
    [is_active] bit NOT NULL DEFAULT 1,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_booking_quotas] PRIMARY KEY ([id])
);

-- home_assistant_entities
IF OBJECT_ID(N'dbo.home_assistant_entities', N'U') IS NULL
CREATE TABLE [dbo].[home_assistant_entities] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [entity_id] nvarchar(255) NOT NULL,
    [friendly_name] nvarchar(255) NULL,
    [entity_type] nvarchar(50) NOT NULL DEFAULT N'sensor' CHECK ([entity_type] IN (N'sensor',N'switch',N'light',N'climate',N'lock',N'camera',N'binary_sensor')),
    [room_id] bigint NULL,
    [device_id] bigint NULL,
    [attributes] nvarchar(max) NULL,
    [state] nvarchar(255) NULL,
    [last_updated] datetime2 NULL,
    [is_active] bit NOT NULL DEFAULT 1,
    [created_at] datetime2 NULL,
    [updated_at] datetime2 NULL,
    CONSTRAINT [PK_home_assistant_entities] PRIMARY KEY ([id])
);

-- jobs
IF OBJECT_ID(N'dbo.jobs', N'U') IS NULL
CREATE TABLE [dbo].[jobs] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [queue] nvarchar(255) NOT NULL,
    [payload] nvarchar(max) NOT NULL,
    [attempts] tinyint NOT NULL,
    [reserved_at] int NULL,
    [available_at] int NOT NULL,
    [created_at] int NOT NULL,
    CONSTRAINT [PK_jobs] PRIMARY KEY ([id])
);

-- failed_jobs
IF OBJECT_ID(N'dbo.failed_jobs', N'U') IS NULL
CREATE TABLE [dbo].[failed_jobs] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [uuid] nvarchar(255) NOT NULL,
    [connection] nvarchar(max) NOT NULL,
    [queue] nvarchar(max) NOT NULL,
    [payload] nvarchar(max) NOT NULL,
    [exception] nvarchar(max) NOT NULL,
    [failed_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT [PK_failed_jobs] PRIMARY KEY ([id])
);

-- device_positions
IF OBJECT_ID(N'dbo.device_positions', N'U') IS NULL
CREATE TABLE [dbo].[device_positions] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [room_id] bigint NOT NULL,
    [device_type] nvarchar(20) NOT NULL CHECK ([device_type] IN (N'light',N'ac',N'erv')),
    [positions] nvarchar(max) NOT NULL,
    [created_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    [updated_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT [PK_device_positions] PRIMARY KEY ([id])
);

-- device_states
IF OBJECT_ID(N'dbo.device_states', N'U') IS NULL
CREATE TABLE [dbo].[device_states] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [room_id] bigint NOT NULL,
    [device_type] nvarchar(20) NOT NULL CHECK ([device_type] IN (N'light',N'ac',N'erv')),
    [device_index] int NOT NULL,
    [status] bit DEFAULT 0,
    [settings] nvarchar(max) NULL,
    [created_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    [updated_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT [PK_device_states] PRIMARY KEY ([id])
);

-- environmental_data
IF OBJECT_ID(N'dbo.environmental_data', N'U') IS NULL
CREATE TABLE [dbo].[environmental_data] (
    [id] int IDENTITY(1,1) NOT NULL,
    [room_id] int NULL,
    [device_id] int NULL,
    [timestamp] datetime2 NOT NULL,
    [temperature] decimal(5,2) NULL,
    [humidity] decimal(5,2) NULL,
    [co2] int NULL,
    [tvoc] decimal(6,3) NULL,
    [pressure] decimal(7,2) NULL,
    [pm25] int NULL,
    [pm10] int NULL,
    [hcho] decimal(6,4) NULL,
    [noise] decimal(5,2) NULL,
    [created_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    [updated_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT [PK_environmental_data] PRIMARY KEY ([id])
);

-- service_access_logs
IF OBJECT_ID(N'dbo.service_access_logs', N'U') IS NULL
CREATE TABLE [dbo].[service_access_logs] (
    [id] int IDENTITY(1,1) NOT NULL,
    [user_id] int NULL,
    [device_id] int NULL,
    [entry_time] datetime2 NOT NULL,
    [exit_time] datetime2 NULL,
    [camera_id] nvarchar(255) NULL,
    [image_data] nvarchar(max) NULL,
    [created_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    [updated_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT [PK_service_access_logs] PRIMARY KEY ([id])
);

-- sessions
IF OBJECT_ID(N'dbo.sessions', N'U') IS NULL
CREATE TABLE [dbo].[sessions] (
    [id] nvarchar(255) NOT NULL,
    [user_id] bigint NULL,
    [ip_address] nvarchar(45) NULL,
    [user_agent] nvarchar(max) NULL,
    [payload] nvarchar(max) NOT NULL,
    [last_activity] int NOT NULL,
    CONSTRAINT [PK_sessions] PRIMARY KEY ([id])
);

-- role_has_permissions
IF OBJECT_ID(N'dbo.role_has_permissions', N'U') IS NULL
CREATE TABLE [dbo].[role_has_permissions] (
    [permission_id] bigint NOT NULL,
    [role_id] bigint NOT NULL,
    CONSTRAINT [PK_role_has_permissions] PRIMARY KEY ([permission_id], [role_id])
);

-- model_has_permissions
IF OBJECT_ID(N'dbo.model_has_permissions', N'U') IS NULL
CREATE TABLE [dbo].[model_has_permissions] (
    [permission_id] bigint NOT NULL,
    [model_type] nvarchar(255) NOT NULL,
    [model_id] bigint NOT NULL,
    CONSTRAINT [PK_model_has_permissions] PRIMARY KEY ([permission_id], [model_id], [model_type])
);

-- model_has_roles
IF OBJECT_ID(N'dbo.model_has_roles', N'U') IS NULL
CREATE TABLE [dbo].[model_has_roles] (
    [role_id] bigint NOT NULL,
    [model_type] nvarchar(255) NOT NULL,
    [model_id] bigint NOT NULL,
    CONSTRAINT [PK_model_has_roles] PRIMARY KEY ([role_id], [model_id], [model_type])
);

-- usage_quotas
IF OBJECT_ID(N'dbo.usage_quotas', N'U') IS NULL
CREATE TABLE [dbo].[usage_quotas] (
    [id] int IDENTITY(1,1) NOT NULL,
    [user_id] int NULL,
    [room_id] int NULL,
    [weekly_limit] int NULL,
    [monthly_limit] int NULL,
    [weekly_hours_limit] decimal(10,2) NULL,
    [created_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    [updated_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT [PK_usage_quotas] PRIMARY KEY ([id])
);

-- user_preferences
IF OBJECT_ID(N'dbo.user_preferences', N'U') IS NULL
CREATE TABLE [dbo].[user_preferences] (
    [id] bigint IDENTITY(1,1) NOT NULL,
    [user_id] bigint NOT NULL,
    [preference_key] nvarchar(50) NOT NULL,
    [preference_value] nvarchar(max) NULL,
    [created_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    [updated_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT [PK_user_preferences] PRIMARY KEY ([id])
);

-- ============================================================
-- สิ้นสุดสคริปต์
-- หมายเหตุ: ไม่ได้สร้าง Foreign Key เพื่อความยืดหยุ่นในการ import ข้อมูล
-- และรองรับการรันสคริปต์ซ้ำ (IF OBJECT_ID ... IS NULL)
-- ============================================================
PRINT N'สร้างฐานข้อมูล smart_room_booking และตารางทั้ง 47 ตารางเสร็จสิ้น';
GO
