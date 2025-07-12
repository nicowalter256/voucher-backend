-- Migration: Add MTN MoMo fields to payments table
-- Run this migration to add support for MTN Mobile Money integration

-- Add new columns to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS gateway_reference_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create index for faster lookups by gateway reference ID
CREATE INDEX IF NOT EXISTS idx_payments_gateway_reference_id ON payments(gateway_reference_id);

-- Create index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_payments_phone_number ON payments(phone_number);

-- Update existing records to have updated_at timestamp
UPDATE payments SET updated_at = created_at WHERE updated_at IS NULL;

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON COLUMN payments.phone_number IS 'Phone number for mobile money payments';
COMMENT ON COLUMN payments.gateway_reference_id IS 'Reference ID from payment gateway (e.g., MTN MoMo)';
COMMENT ON COLUMN payments.error_message IS 'Error message if payment failed';
COMMENT ON COLUMN payments.updated_at IS 'Timestamp when payment was last updated'; 