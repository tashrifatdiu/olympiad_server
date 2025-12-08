require('dotenv').config();
const mongoose = require('mongoose');

const clearStudentData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear all student-related collections
    await mongoose.connection.db.collection('users').deleteMany({});
    console.log('✅ Cleared all users');

    await mongoose.connection.db.collection('examsessions').deleteMany({});
    console.log('✅ Cleared all exam sessions');

    await mongoose.connection.db.collection('responses').deleteMany({});
    console.log('✅ Cleared all responses');

    await mongoose.connection.db.collection('logs').deleteMany({});
    console.log('✅ Cleared all logs');

    // Reset exam control
    await mongoose.connection.db.collection('examcontrols').updateMany(
      {},
      { $set: { isExamActive: false, examStartTime: null } }
    );
    console.log('✅ Reset exam control');

    console.log('\n🎉 Database cleared successfully!');
    console.log('📝 Admin account is still intact');
    console.log('📚 Questions are still available');
    console.log('\nYou can now:');
    console.log('1. Register new students at http://localhost:3000/register');
    console.log('2. Login as admin at http://localhost:3000/admin/login');
    console.log('3. Start fresh exam');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
};

clearStudentData();
