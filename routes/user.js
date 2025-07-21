// routes/admin/users.js

const express = require('express');
const router = express.Router();

// CORRECTED IMPORTS FOR ADMIN/USERS.JS
const AdminAuth = require('../middleware/adminAuthMiddleware'); // <--- THIS IS THE CORRECT IMPORT FOR ADMIN ROUTES
const User = require('../models/User'); // Correct path from routes/admin/users.js to models/User.js
const { generateUniqueAccountNumber } = require('../utils/accountNumberGenerator'); // Correct path from routes/admin/users.js to utils/accountNumberGenerator.js
const bcrypt = require('bcryptjs'); // For password hashing
const mongoose = require('mongoose'); // For ObjectId.isValid or other Mongoose utilities

// If you have a separate Account model and not embedding accounts in User model, uncomment below:
// const Account = require('../../models/Account');


// --- Middleware to ensure admin role for all routes in this file ---
// All routes defined below this line will use the AdminAuth middleware
router.use(AdminAuth); // This will now correctly refer to the imported AdminAuth

// --- Admin-specific User Management Routes ---

/**
 * @route   GET /api/admin/users
 * @desc    Get all registered users or search by username/email (for admin dashboard)
 * @access  Private (Admin Only)
 * @query   search (optional) - partial username or email to search for (case-insensitive)
 * @query   username (optional) - exact username to search for (case-insensitive)
 * @query   email (optional) - exact email to search for (case-insensitive)
 */
router.get('/', async (req, res) => {
    try {
        // Redundant check if AdminAuth middleware fully enforces, but harmless
        if (req.admin.role !== 'admin' && req.admin.role !== 'superadmin') {
            return res.status(403).json({ msg: 'Authorization denied: Insufficient role.' });
        }

        // Extract query parameters for searching
        const { search, username, email } = req.query;

        let query = {}; // Initialize an empty query object

        // Build the query based on provided parameters
        if (username) {
            // Exact username search (case-insensitive)
            query.username = new RegExp(`^${username}$`, 'i');
        } else if (email) {
            // Exact email search (case-insensitive)
            query.email = new RegExp(`^${email}$`, 'i');
        } else if (search) {
            // General search for partial match in username OR email (case-insensitive)
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { username: { $regex: searchRegex } },
                { email: { $regex: searchRegex } }
            ];
        }

        // Fetch users based on the constructed query, excluding their passwords
        const users = await User.find(query)
                                .select('-password') // Exclude password from results
                                .sort({ createdAt: -1 }); // Sort by creation date, newest first

        // If a search was performed and no users were found, respond with 404
        if ((search || username || email) && users.length === 0) {
            return res.status(404).json({ msg: 'No users found matching your search criteria.' });
        }

        res.json(users);
    } catch (err) {
        console.error('Error fetching users for admin:', err.message);
        res.status(500).send('Server Error');
    }
});


/**
 * @route   POST /api/admin/users/register
 * @desc    Register a new user (Admin Only)
 * @access  Private (Admin Only)
 */
router.post('/register', async (req, res) => {
    // AdminAuth middleware should handle this, but an explicit check is good
    if (req.admin.role !== 'admin' && req.admin.role !== 'superadmin') {
        return res.status(403).json({ msg: 'Authorization denied: Insufficient role.' });
    }

    const {
        username,
        fullName,
        email,
        password,
        role,
        homeAddress,
        phone,
        gender,
        nationality,
        occupation,
        currency,
        routingNumber,
        wireTransferLimit,
        achTransferLimit,
        profilePictureUrl // Use profilePictureUrl to match schema
    } = req.body;

    // --- Input Validation ---
    if (!username || !email || !password || !fullName || !role || !homeAddress || !phone || !gender || !nationality || !occupation || !currency || !routingNumber) {
        return res.status(400).json({ msg: 'Please fill in all required user details.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ msg: 'Password must be at least 6 characters long.' });
    }
    if (role !== 'user' && role !== 'admin') {
        return res.status(400).json({ msg: 'Invalid role specified. Role must be "user" or "admin".' });
    }

    try {
        // 1. Check if user already exists
        let userExists = await User.findOne({ $or: [{ email }, { username }] });
        if (userExists) {
            return res.status(400).json({ msg: 'User with that email or username already exists.' });
        }

        // 2. Generate unique account numbers
        const checkingAccountNumber = await generateUniqueAccountNumber('checking');
        const savingsAccountNumber = await generateUniqueAccountNumber('savings');

        // 3. Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Create new User instance
        const newUser = new User({
            username,
            fullName,
            email,
            password: hashedPassword, // Store the hashed password
            role,
            homeAddress,
            phone,
            gender,
            nationality,
            occupation,
            currency,
            routingNumber,
            wireTransferLimit: wireTransferLimit || 10000,
            achTransferLimit: achTransferLimit || 5000,
            profilePictureUrl: profilePictureUrl || null, // Assign to profilePictureUrl

            // Correctly initialize checking and savings accounts as embedded documents
            checkingAccount: {
                accountNumber: checkingAccountNumber,
                balance: 0,
                currency: currency, // Use the user's chosen currency for the account
                status: 'active',
                openedDate: new Date()
            },
            savingsAccount: {
                accountNumber: savingsAccountNumber,
                balance: 0,
                currency: currency, // Use the user's chosen currency for the account
                status: 'active',
                openedDate: new Date()
            },
            // Initialize other new fields from schema with defaults or provided values
            accountStatus: 'Pending', // Default from schema, but good to be explicit
            isVerified: false,
            kycStatus: 'Pending',
            twoFactorEnabled: true, // Default from schema
        });

        // 5. Save user to database
        await newUser.save();

        // 6. Respond with success (excluding password) and include full account details
        res.status(201).json({
            message: 'User account created successfully!',
            user: {
                _id: newUser._id,
                username: newUser.username,
                fullName: newUser.fullName,
                email: newUser.email,
                role: newUser.role,
                // Include the full embedded account objects
                checkingAccount: newUser.checkingAccount,
                savingsAccount: newUser.savingsAccount,
                homeAddress: newUser.homeAddress,
                phone: newUser.phone,
                gender: newUser.gender,
                nationality: newUser.nationality,
                occupation: newUser.occupation,
                currency: newUser.currency,
                routingNumber: newUser.routingNumber,
                wireTransferLimit: newUser.wireTransferLimit,
                achTransferLimit: newUser.achTransferLimit,
                profilePictureUrl: newUser.profilePictureUrl, // Match schema field
                accountStatus: newUser.accountStatus,
                isVerified: newUser.isVerified,
                kycStatus: newUser.kycStatus,
                twoFactorEnabled: newUser.twoFactorEnabled,
                createdAt: newUser.createdAt
            }
        });

    } catch (err) {
        console.error('Error creating new user account by admin:', err.message);
        if (err.name === 'ValidationError') {
            // Mongoose validation errors (e.g., required fields missing, enum mismatch)
            return res.status(400).json({ msg: err.message });
        }
        res.status(500).send('Server Error');
    }
});


/**
 * @route   GET /api/admin/users/:id
 * @desc    Get user by ID (Admin Only)
 * @access  Private (Admin Only)
 */
router.get('/:id', async (req, res) => {
    try {
        if (req.admin.role !== 'admin' && req.admin.role !== 'superadmin') {
            return res.status(403).json({ msg: 'Authorization denied: Insufficient role.' });
        }

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid user ID format.' });
        }

        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        res.json(user);
    } catch (err) {
        console.error('Error fetching user by ID for admin:', err.message);
        res.status(500).send('Server Error');
    }
});


/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user details by ID (Admin Only)
 * @access  Private (Admin Only)
 */
router.put('/:id', async (req, res) => {
    try {
        if (req.admin.role !== 'admin' && req.admin.role !== 'superadmin') {
            return res.status(403).json({ msg: 'Authorization denied: Insufficient role.' });
        }

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid user ID format.' });
        }

        const { password, ...updateFields } = req.body; // Destructure password to handle separately

        // If password is provided, hash it before updating
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ msg: 'New password must be at least 6 characters long.' });
            }
            const salt = await bcrypt.genSalt(10);
            updateFields.password = await bcrypt.hash(password, salt);
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true, runValidators: true } // `new: true` returns the updated document, `runValidators: true` runs schema validators
        ).select('-password');

        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        res.json({ message: 'User updated successfully!', user });
    } catch (err) {
        console.error('Error updating user by admin:', err.message);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ msg: err.message });
        }
        res.status(500).send('Server Error');
    }
});


/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete user by ID (Admin Only)
 * @access  Private (Admin Only)
 */
router.delete('/:id', async (req, res) => {
    try {
        if (req.admin.role !== 'admin' && req.admin.role !== 'superadmin') {
            return res.status(403).json({ msg: 'Authorization denied: Insufficient role.' });
        }

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid user ID format.' });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        // Optional: Implement logic to prevent an admin from deleting themselves or the last superadmin
        // if (user.id === req.admin.id) {
        //     return res.status(400).json({ msg: 'Cannot delete your own admin account through this route.' });
        // }

        await User.deleteOne({ _id: req.params.id });

        res.json({ msg: 'User deleted successfully!' });
    } catch (err) {
        console.error('Error deleting user by admin:', err.message);
        res.status(500).send('Server Error');
    }
});


module.exports = router;