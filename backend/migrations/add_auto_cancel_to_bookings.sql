-- Add auto_cancel column to booking_requests table
ALTER TABLE `booking_requests` 
ADD COLUMN IF NOT EXISTS `auto_cancel` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0=manual cancel, 1=auto cancel' AFTER `status`;




