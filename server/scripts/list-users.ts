import mongoose from 'mongoose';

const MONGO_HOST = process.argv[2] || 'localhost';
const URI = `mongodb://${MONGO_HOST}:27017/admin`;

async function main() {
  console.log(`Connecting to ${URI}...`);
  const conn = await mongoose.connect(URI);
  const adminDb = conn.connection.db.admin();

  const { users } = await adminDb.command({ usersInfo: 1 });

  console.log('\n=== MongoDB Users ===\n');
  for (const u of users) {
    console.log(`  User: ${u.user}`);
    console.log(`  DB:   ${u.db}`);
    console.log(`  Roles:`);
    for (const r of u.roles) {
      console.log(`    - ${r.role} @ ${r.db}`);
    }
    console.log();
  }

  await conn.disconnect();
}

main().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
