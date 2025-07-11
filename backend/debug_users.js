const { User } = require('./models');

async function checkDemoUsers() {
  try {
    console.log('Checking for demo users...');
    
    const adminUser = await User.findOne({ where: { username: 'admin' } });
    const studentUser = await User.findOne({ where: { username: 'student_demo' } });
    
    console.log('\n=== ADMIN USER ===');
    if (adminUser) {
      console.log('✓ Admin user exists');
      console.log('ID:', adminUser.id);
      console.log('Username:', adminUser.username);
      console.log('Email:', adminUser.email);
      console.log('Role:', adminUser.role);
      console.log('Password Hash (first 20 chars):', adminUser.password_hash ? adminUser.password_hash.substring(0, 20) + '...' : 'No password');
      console.log('Created:', adminUser.createdAt);
    } else {
      console.log('✗ Admin user NOT found');
    }
    
    console.log('\n=== STUDENT USER ===');
    if (studentUser) {
      console.log('✓ Student demo user exists');
      console.log('ID:', studentUser.id);
      console.log('Username:', studentUser.username);
      console.log('Email:', studentUser.email);
      console.log('Role:', studentUser.role);
      console.log('Password Hash (first 20 chars):', studentUser.password_hash ? studentUser.password_hash.substring(0, 20) + '...' : 'No password');
      console.log('Created:', studentUser.createdAt);
    } else {
      console.log('✗ Student demo user NOT found');
    }
    
    // Check all users in database
    console.log('\n=== ALL USERS ===');
    const allUsers = await User.findAll({
      attributes: ['id', 'username', 'email', 'role', 'created_at']
    });
    console.log(`Total users in database: ${allUsers.length}`);
    allUsers.forEach(user => {
      console.log(`- ${user.username} (${user.role}) - ${user.email}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking users:', error);
    process.exit(1);
  }
}

checkDemoUsers();