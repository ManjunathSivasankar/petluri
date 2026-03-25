const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

const checkAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        const admins = await User.find({ role: 'admin' }).select('+password');
        console.log('--- Admin Users ---');
        admins.forEach(u => {
            console.log(`ID: ${u._id}`);
            console.log(`Name: "${u.name}"`);
            console.log(`Email: "${u.email}"`);
            console.log(`Role: "${u.role}"`);
            console.log(`Has Password: ${!!u.password}`);
            console.log('-------------------');
        });
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkAdmin();
