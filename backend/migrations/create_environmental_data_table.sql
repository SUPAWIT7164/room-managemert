-- Create environmental_data table for storing sensor data from AM319 & Noise sensors
CREATE TABLE IF NOT EXISTS `environmental_data` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `room_id` INT NULL COMMENT 'Room ID (NULL for general area)',
  `device_id` INT NULL COMMENT 'Device ID (AM319, Noise sensor, etc.)',
  `timestamp` DATETIME NOT NULL COMMENT 'Timestamp of the measurement',
  `temperature` DECIMAL(5,2) NULL COMMENT 'Temperature in Celsius',
  `humidity` DECIMAL(5,2) NULL COMMENT 'Humidity percentage',
  `co2` INT NULL COMMENT 'CO2 in ppm',
  `tvoc` DECIMAL(6,3) NULL COMMENT 'TVOC in mg/m³',
  `pressure` DECIMAL(7,2) NULL COMMENT 'Barometric pressure in hPa',
  `pm25` INT NULL COMMENT 'PM2.5 in µg/m³',
  `pm10` INT NULL COMMENT 'PM10 in µg/m³',
  `hcho` DECIMAL(6,4) NULL COMMENT 'HCHO in mg/m³',
  `noise` DECIMAL(5,2) NULL COMMENT 'Noise level in dB',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_room_id` (`room_id`),
  INDEX `idx_device_id` (`device_id`),
  INDEX `idx_room_timestamp` (`room_id`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Environmental sensor data from AM319 & Noise sensors';




