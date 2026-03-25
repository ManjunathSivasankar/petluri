const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

const checkAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        const admins = await User.find({ role: 'admin' });
        console.log('Admin users found:', admins.map(u => ({ name: u.name, email: u.email, role: u.role })));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkAdmin();
