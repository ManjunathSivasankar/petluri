const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

const testUpdate = async () => {
    try {
        // 1. Login as admin
        console.log('Logging in as admin...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@petluri.com',
            password: 'Admin@123'
        });

        const token = loginRes.data.token;
        console.log('Login successful. Token acquired.');
        console.log('User Role:', loginRes.data.role);

        // 2. Try to update an enrollment status
        const enrollmentId = '69b84b9d2066aa02846ae93e'; // ID from user error
        console.log(`Attempting to update enrollment ${enrollmentId} to 'completed'...`);
        
        const updateRes = await axios.put(`${API_URL}/admin/enrollments/${enrollmentId}/status`, 
            { status: 'completed' },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log('Update Successful:', updateRes.data);
    } catch (error) {
        if (error.response) {
            console.error('Update Failed:', error.response.status, error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
};

testUpdate();
