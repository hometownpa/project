// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Adjust path if necessary

module.exports = async (req, res, next) => {
    console.log('[Auth Middleware] Request received.');

    // 1. Get token from Authorization header first (preferred standard)
    let token = req.header('Authorization');

    if (token && token.startsWith('Bearer ')) {
        // Extract the token part after 'Bearer '
        token = token.slice(7, token.length);
        console.log('[Auth Middleware] Token extracted from "Bearer" header.');
    } else {
        // Fallback: Get token from 'x-auth-token' header (common in older setups)
        token = req.header('x-auth-token');
        if (token) {
            console.log('[Auth Middleware] Token extracted from "x-auth-token" header.');
        }
    }

    // 2. Check if no token is found
    if (!token) {
        console.log('[Auth Middleware] No token found in any expected header. Denying access (401).');
        return res.status(401).json({ msg: 'No token provided, authorization denied.' });
    }

    // --- CRITICAL DEBUG LINE FOR "JWT MALFORMED" ERROR ---
    // This will print the exact token string that jwt.verify() is attempting to process.
    // Copy this string from your server console and paste it into jwt.io for inspection.
    console.log('[Auth Middleware] Token string received for verification:', token);
    // --- END CRITICAL DEBUG LINE ---

    // 3. Verify token
    try {
        // !!! TEMPORARY DEBUG: Confirm JWT_SECRET is loaded and its value (first few chars) !!!
        // REMEMBER TO REMOVE THIS LINE IN PRODUCTION AS IT EXPOSES YOUR SECRET.
        console.log('[Auth Middleware] Using JWT_SECRET (first 5 chars):', process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 5) : 'UNDEFINED');

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user.id;

        // Fetch the user from the database to verify the role
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        req.user = { id: user._id, role: user.role }; // Attach user info to the request
        console.log(`[Auth Middleware] Token verified. User ID: ${req.user.id}, Role: ${req.user.role}.`);

        // Proceed to the next middleware or route handler
        next();
    } catch (err) {
        // Log the exact error for server-side debugging
        console.error('[Auth Middleware] Token verification failed:', err.name, '-', err.message);

        // Provide more specific error messages to the client based on JWT error type
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ msg: 'Token has expired. Please log in again.' });
        } else if (err.name === 'JsonWebTokenError') {
            // This covers malformed tokens, invalid signatures, etc.
            return res.status(401).json({ msg: 'Invalid token. Please log in again.' });
        } else {
            // Generic error for unexpected issues
            res.status(401).json({ msg: 'Token is not valid.' });
        }
    }
};