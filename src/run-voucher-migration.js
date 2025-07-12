import { db } from './db.js';
import fs from 'fs';
import path from 'path';

async function runVoucherMigration() {
  try {
    console.log('Running voucher migration...');
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'src', 'migrations', 'add_voucher_to_payments.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await db.query(migrationSQL);
    
    console.log('✅ Voucher migration completed successfully!');
    console.log('Added voucher fields to payments table:');
    console.log('  - voucher_id (foreign key to vouchers table)');
    console.log('  - voucher_code (voucher code being paid for)');
    console.log('  - package_type (package type of the voucher)');
    console.log('  - Created indexes for better performance');
    console.log('  - Added foreign key constraint');
    
  } catch (error) {
    console.error('❌ Voucher migration failed:', error.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

runVoucherMigration(); 