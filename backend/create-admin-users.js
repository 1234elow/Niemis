const bcrypt = require('bcryptjs');
const { sequelize } = require('./config/database');
const { User } = require('./models');

async function createAdminUsers() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected successfully');

        const adminUsers = [
            {
                username: 'admin',
                email: 'admin@education.gov.bb',
                password: 'admin123',
                role: 'admin'
            },
            {
                username: 'super_admin',
                email: 'super.admin@education.gov.bb',
                password: 'super123',
                role: 'super_admin'
            },
            {
                username: 'teacher_demo',
                email: 'teacher.demo@alexandra.edu.bb',
                password: 'teacher123',
                role: 'teacher'
            }
        ];

        const saltRounds = 10;
        const createdUsers = [];

        for (const adminUser of adminUsers) {
            const hashedPassword = await bcrypt.hash(adminUser.password, saltRounds);
            
            const user = await User.create({
                username: adminUser.username,
                email: adminUser.email,
                password_hash: hashedPassword,
                role: adminUser.role
            });

            createdUsers.push({
                username: adminUser.username,
                email: adminUser.email,
                password: adminUser.password,
                role: adminUser.role
            });

            console.log(`✅ Created ${adminUser.role}: ${adminUser.username}`);
        }

        console.log('\\n=== ADMIN ACCOUNTS CREATED ===');
        console.log('Login credentials for testing:');
        createdUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.username} | ${user.email} | ${user.password} | ${user.role}`);
        });

        return createdUsers;

    } catch (error) {
        console.error('❌ Error creating admin users:', error.message);
        throw error;
    } finally {
        await sequelize.close();
    }
}

if (require.main === module) {
    createAdminUsers()
        .then(() => {
            console.log('\\n✅ Admin users created successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Failed to create admin users:', error);
            process.exit(1);
        });
}

module.exports = { createAdminUsers };