-- Migration: Add voucher information to payments table
-- This migration adds fields to track which voucher a payment is for

-- Add voucher-related columns to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS voucher_id INTEGER,
ADD COLUMN IF NOT EXISTS voucher_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS package_type VARCHAR(50);

-- Create foreign key constraint to vouchers table
ALTER TABLE payments 
ADD CONSTRAINT fk_payments_voucher_id 
FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL;

-- Create index for voucher lookups
CREATE INDEX IF NOT EXISTS idx_payments_voucher_id ON payments(voucher_id);
CREATE INDEX IF NOT EXISTS idx_payments_voucher_code ON payments(voucher_code);
CREATE INDEX IF NOT EXISTS idx_payments_package_type ON payments(package_type);

-- Add comments for documentation
COMMENT ON COLUMN payments.voucher_id IS 'Reference to the voucher being paid for';
COMMENT ON COLUMN payments.voucher_code IS 'Voucher code being paid for';
COMMENT ON COLUMN payments.package_type IS 'Package type of the voucher being paid for'; 