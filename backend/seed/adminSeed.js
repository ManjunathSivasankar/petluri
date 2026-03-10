const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const connectDB = require('../config/db');

dotenv.config();
connectDB();

const seedAdmin = async () => {
    try {
        await User.deleteMany({ email: 'admin@petluri.com' }); // cleanup

        const adminUser = await User.create({
            name: 'Super Admin',
            email: 'admin@petluri.com',
            password: 'Admin@123', // Will be hashed by pre-save hook
            role: 'admin',
            phone: '9999999999',
            collegeName: 'Petluri Admin Office',
            collegeDetails: 'Administration',
            personalAddress: 'Hyderabad, India'
        });

        console.log('Admin User Created Successfully:', adminUser.email);
        process.exit();
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();
