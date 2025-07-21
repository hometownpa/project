// netlify/functions/auth/admin-login.js
// This file will handle requests to /api/auth/admin-login (via netlify.toml redirect)

// Need to import everything this specific function uses:
require('dotenv').config(); // For process.env.JWT_SECRET, MONGODB_URI
const mongoose = require('mongoose');
const User = require('../../../models/User'); // <<< IMPORTANT: Adjust this path!
                                            // If models is at hometownbankpa/models/User.js,
                                            // and this function is at hometownbankpa/netlify/functions/auth/admin-login.js
                                            // You need to go up 3 levels: ../../../
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// IMPORTANT: For serverless functions, database connection needs careful handling.
// It might be established per invocation (less efficient cold starts) or reused.
// A common pattern is to cache the connection.
let conn = null; // Variable to hold the connection instance

const connectToDatabase = async () => {
    if (conn == null) {
        conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        }).then(() => mongoose);
        conn.connection.on('error', err => {
            console.error('MongoDB connection error in function:', err);
            conn = null; // Clear connection if it errors out
        });
    }
    return conn;
};

// Main handler for the function
const handlerLogic = async (event, context) => {
    // Ensure this function only responds to POST requests (as it's a login)
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Parse the request body
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON body' }) };
    }

    const { username, password } = body;

    try {
        // Connect to MongoDB
        await connectToDatabase();

        // Find admin user (your logic from routes/adminAuth.js)
        const user = await User.findOne({ username, isAdmin: true });
        if (!user) {
            return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials' }) };
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials' }) };
        }

        // Generate JWT token
        const payload = { user: { id: user.id, isAdmin: user.isAdmin } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        // CORS headers are crucial for Netlify Functions
        const headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://hometownbankpa.netlify.app', // Your frontend URL
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'POST, OPTIONS' // Allow POST and preflight OPTIONS
        };

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({ token })
        };
    } catch (error) {
        console.error('Admin login function error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
    }
};

// Exports the handler, also includes an OPTIONS handler for CORS preflight
exports.handler = async (event, context) => {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': 'https://hometownbankpa.netlify.app',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, PATCH, OPTIONS' // Allow all methods your API uses
            },
            body: '' // No body for OPTIONS requests
        };
    }
    // If not OPTIONS, proceed with the main logic
    return handlerLogic(event, context);
};