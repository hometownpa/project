// routes/adminAuth.js

const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin'); // Correctly importing Admin Mongoose Model
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in .env for adminAuth.');
    process.exit(1); // Exit if critical configuration is missing
}

/**
 * @route   POST /api/auth/admin-login
 * @desc    Authenticate admin & get token
 * @access  Public
 */
router.post('/admin-login', async (req, res) => {
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
        console.log('[Backend Admin Login] Error: Username and password are required (missing fields).');
        return res.status(400).json({ message: 'Please enter both username and password.' });
    }

    try {
        // IMPORTANT FIX: Convert the incoming username to lowercase
        // to match the 'adminbobo' that is stored in your database.
        const admin = await Admin.findOne({ username: username.toLowerCase() });

        if (!admin) {
            console.log(`[Backend Admin Login] Error: Admin '${username}' not found.`);
            return res.status(400).json({ message: 'Invalid Credentials.' });
        }

        // Compare provided password with hashed password
        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            console.log(`[Backend Admin Login] Error: Password mismatch for admin '${username}'.`);
            return res.status(400).json({ message: 'Invalid Credentials.' });
        }

        // Create JWT payload (ensure it includes admin-specific details like role)
        const payload = {
            admin: {
                id: admin.id,
                role: admin.role || 'admin' // Default to 'admin' if not explicitly set
            }
        };

        // Sign the JWT
        jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: '72h' }, // Admin tokens typically have shorter expiry
            (err, token) => {
                if (err) {
                    console.error('[Backend Admin Login] JWT signing error:', err);
                    return res.status(500).json({ message: 'Failed to generate authentication token for admin.' });
                }
                console.log(`[Backend Admin Login] SUCCESS: Admin '${username}' logged in. Token issued.`);
                res.json({ token, message: 'Admin login successful.' });
            }
        );

    } catch (error) {
        console.error('[Backend Admin Login] Unexpected server error:', error);
        res.status(500).json({ message: 'Server Error during admin login process. Please try again later.' });
    }
});


module.exports = router;