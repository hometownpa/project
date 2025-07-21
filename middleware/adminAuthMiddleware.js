// middleware/adminAuthMiddleware.js

const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin'); // <--- IMPORTANT: Ensure this path is correct

// Ensure JWT_SECRET is loaded from .env
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in adminAuthMiddleware. Please set it in your .env file.');
    // In a real application, you might throw an error or handle it more gracefully
    // For now, we'll let it proceed but log the error.
}

/**
 * Middleware to protect admin routes.
 * It verifies the JWT token and attaches the admin user object to the request.
 */
module.exports = async function(req, res, next) {
    // Get token from header
    // Frontend should send it as 'x-auth-token' or 'Authorization: Bearer <token>'
    const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');

    // Check if no token
    if (!token) {
        console.log('[AdminAuthMiddleware] Authorization denied: No token provided.');
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET); // Use the JWT_SECRET from .env

        // Check if the decoded token has the 'admin' payload structure we expect
        // The admin login route sets payload as { admin: { id, role } }
        if (!decoded.admin || !decoded.admin.id) {
            console.log('[AdminAuthMiddleware] Token payload missing expected \'admin\' context.');
            return res.status(401).json({ msg: 'Token is not valid for admin access.' });
        }

        // Fetch the admin user from the 'admins' collection using the decoded ID
        // .select('-password') excludes the password from the fetched user object
        req.admin = await Admin.findById(decoded.admin.id).select('-password');

        // Comprehensive logging for debugging req.admin
        console.log('[AdminAuthMiddleware] Token decoded successfully. Decoded payload:', decoded);
        console.log('[AdminAuthMiddleware] Fetched req.admin object:', req.admin);
        console.log('[AdminAuthMiddleware] req.admin.id:', req.admin ? req.admin.id : 'N/A');
        console.log('[AdminAuthMiddleware] req.admin.role:', req.admin ? req.admin.role : 'NOT SET');


        if (!req.admin) {
            console.log(`[AdminAuthMiddleware] Authorization denied: Admin user with ID ${decoded.admin.id} not found in 'admins' collection.`);
            return res.status(401).json({ msg: 'Authorization denied: Admin user not found.' });
        }

        // Check if the role matches what's expected for an admin middleware
        // This adds an extra layer of security, though the admin-login route already checks role.
        if (!['admin', 'superadmin', 'moderator'].includes(req.admin.role)) {
            console.log(`[AdminAuthMiddleware] Access Denied: User '${req.admin.username}' (ID: ${req.admin.id}) has role '${req.admin.role}', not an authorized admin role.`);
            return res.status(403).json({ msg: 'Access denied: Insufficient privileges.' });
        }

        next(); // Proceed to the next middleware or route handler

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            console.error('[AdminAuthMiddleware] Token Expired:', err.message);
            return res.status(401).json({ msg: 'Token expired, please log in again.' });
        }
        console.error('[AdminAuthMiddleware] Token verification failed:', err.message);
        res.status(401).json({ msg: 'Token is not valid.' });
    }
};