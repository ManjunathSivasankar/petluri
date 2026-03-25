const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');
dotenv.config();

const verifyAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const admins = await User.find({ role: 'admin' });
        console.log(`Found ${admins.length} admin(s):`);
        
        admins.forEach(admin => {
            console.log(`- Name: ${admin.name}, Email: ${admin.email}, Role: ${admin.role}, ID: ${admin._id}`);
        });

        const allUsers = await User.find({});
        console.log(`Total users: ${allUsers.length}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

verifyAdmin();
