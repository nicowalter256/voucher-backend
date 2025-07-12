import { db } from './db.js';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('Running MTN MoMo migration...');
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'src', 'migrations', 'add_mtn_momo_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await db.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('Added fields to payments table:');
    console.log('  - phone_number');
    console.log('  - gateway_reference_id');
    console.log('  - error_message');
    console.log('  - updated_at');
    console.log('  - Created indexes for better performance');
    console.log('  - Added automatic timestamp trigger');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

runMigration(); 