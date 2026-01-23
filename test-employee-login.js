// Test script to verify employee login
const axios = require('axios');

async function testEmployeeLogin() {
  try {
    console.log('Testing employee login...');
    
    // Test with a sample employee email that should exist
    const response = await axios.post('https://hrms.talentshield.co.uk/api/auth/login', {
      identifier: 'test@company.com', // Replace with actual employee email
      password: 'test123' // Replace with actual password
    });
    
    console.log('✅ Login successful:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('❌ Login failed:', error.response.status, error.response.data);
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
}

testEmployeeLogin();
