// netlify/functions/auth/admin-login.js
const mongoose = require('mongoose');
const User = require('../../../models/User'); // Adjust path correctly
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config(); // Load environment variables for the function

// Cached DB connection
let cachedDb = null;
async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    cachedDb = await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    return cachedDb;
}

exports.handler = async (event, context) => {
    // CORS Preflight handling (crucial for browser requests)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': 'https://hometownbankpa.netlify.app',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, PATCH, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    try {
        await connectToDatabase();
        const { username, password } = JSON.parse(event.body);

        // Your existing admin login logic from server.js/routes/adminAuth.js
        // ... find user, compare password, generate token ...

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://hometownbankpa.netlify.app', // Your frontend domain
            },
            body: JSON.stringify({ token })
        };
    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://hometownbankpa.netlify.app',
            },
            body: JSON.stringify({ message: error.message || 'Internal Server Error' })
        };
    }
};