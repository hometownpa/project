// middleware/protectAdmin.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Adjust path to your User model

module.exports = async (req, res, next) => {
    let token;
    console.log('[ProtectAdmin Middleware] --- START ---'); // New log

    // 1. Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        console.log('[ProtectAdmin Middleware] Token extracted from "Bearer":', token ? token.substring(0, 30) + '...' : 'No Token'); // Log partial token
    } else {
        console.log('[ProtectAdmin Middleware] No "Bearer" token in Authorization header. Checking other headers or no token.');
    }

    // If no token is found
    if (!token) {
        console.log('[ProtectAdmin Middleware] No token found at all. Denying access (401).');
        return res.status(401).json({ msg: 'No token, authorization denied for admin access.' });
    }

    try {
        // 2. Verify token
        // !!! TEMPORARY DEBUG: Confirm JWT_SECRET is loaded and its value (first few chars) !!!
        console.log('[ProtectAdmin Middleware] Using JWT_SECRET (first 5 chars):', process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 5) : 'UNDEFINED');

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('[ProtectAdmin Middleware] Decoded JWT payload:', decoded); // CRITICAL: What is `decoded`?

        // 3. Extract user ID from decoded payload and find user in DB
        // Assuming the token payload for admins contains the user ID under `id` or `_id`
        // **If `decoded.user` exists, it should be `decoded.user.id`. Otherwise, it might be `decoded.id` or `decoded._id`**
        const userIdFromToken = decoded.user ? decoded.user.id : decoded.id; // Adjust this based on your token structure
        console.log('[ProtectAdmin Middleware] User ID extracted from token payload:', userIdFromToken); // CRITICAL: What is `userIdFromToken`?

        // Validate userIdFromToken BEFORE querying DB if it's the source of "Invalid ID format"
        // This check would catch it earlier if the token itself has a malformed ID
        if (!userIdFromToken || !mongoose.Types.ObjectId.isValid(userIdFromToken)) {
            console.error('[ProtectAdmin Middleware] Extracted User ID from token is invalid ObjectId format or missing:', userIdFromToken);
            return res.status(401).json({ msg: 'Invalid token payload: User ID format is incorrect.' });
        }


        const adminUser = await User.findById(userIdFromToken);
        console.log('[ProtectAdmin Middleware] Admin user found in DB:', adminUser ? adminUser._id : 'Not Found');

        if (!adminUser) {
            console.log('[ProtectAdmin Middleware] Admin user not found in DB with ID from token after verification.');
            return res.status(401).json({ msg: 'Not authorized, admin user not found.' });
        }

        // 4. Ensure the found user actually has the admin role
        if (adminUser.role !== 'admin') {
            console.log(`[ProtectAdmin Middleware] User ${adminUser._id} is not an admin. Role: ${adminUser.role}. Denying access (403).`);
            return res.status(403).json({ msg: 'Forbidden: You do not have admin privileges.' });
        }

        // 5. Attach the full admin user object to req.admin
        req.admin = adminUser;
        console.log('[ProtectAdmin Middleware] Admin user attached to req.admin: ID:', req.admin._id, 'Role:', req.admin.role);
        console.log('[ProtectAdmin Middleware] --- END SUCCESS ---'); // New log
        next();

    } catch (error) {
        console.error('[ProtectAdmin Middleware] Token verification or DB lookup failed:', error.name, '-', error.message);
        // Provide more specific error messages to the client based on JWT error type
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ msg: 'Admin token expired. Please log in again.' });
        } else if (error.name === 'JsonWebTokenError') {
            // This covers malformed tokens, invalid signatures, etc.
            return res.status(401).json({ msg: 'Invalid admin token.' });
        }
        // If the error isn't a JWT error, but still something in the try block, it could be the Mongoose findById failing on a bad ID format
        console.log('[ProtectAdmin Middleware] Re-throwing as generic 401 for other errors.'); // New log
        res.status(401).json({ msg: 'Token is not valid or server error during authentication.' });
    }
};