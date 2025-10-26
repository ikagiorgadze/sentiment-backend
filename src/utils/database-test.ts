import { pool } from '../config/database';

/**
 * Test database connection and display basic statistics
 */
export async function testDatabaseConnection(): Promise<void> {
  try {
    console.log('\n🔍 Testing Database Connection...\n');

    // Test basic connection
    const timeResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful');
    console.log(`⏰ Database time: ${timeResult.rows[0].current_time}`);

    // Get counts for each table
    const tables = ['users', 'posts', 'comments', 'sentiments', 'reactions'];
    
    console.log('\n📊 Table Statistics:');
    console.log('━'.repeat(50));
    
    for (const table of tables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(countResult.rows[0].count, 10);
        console.log(`  ${table.padEnd(15)} : ${count.toLocaleString().padStart(10)} rows`);
      } catch (error) {
        console.log(`  ${table.padEnd(15)} : Error fetching count`);
      }
    }

    console.log('━'.repeat(50));
    console.log('\n✅ Database test completed successfully\n');
  } catch (error) {
    console.error('\n❌ Database connection failed:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  testDatabaseConnection()
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}





