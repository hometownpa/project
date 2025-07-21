// routes/admin/users.js

const express = require('express');
const router = express.Router();
const AdminAuth = require('../../middleware/adminAuthMiddleware'); // Ensure this path is correct
const User = require('../../models/User'); // Ensure User model is imported correctly
console.log('Mongoose User Schema accountStatus enum at load time:', User.schema.paths.accountStatus.enumValues);
// const Account = require('../../models/Account'); 
const { generateUniqueAccountNumber } = require('../../utils/accountNumberGenerator'); // Make sure this utility exists
const bcrypt = require('bcryptjs'); // For password hashing
const mongoose = require('mongoose'); // For ObjectId.isValid or other Mongoose utilities

// --- Middleware to ensure admin role for all routes in this file ---
// All routes defined below this line will use the AdminAuth middleware
router.use(AdminAuth);

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
    console.log('Backend received request body for new user:', req.body);

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
        profilePicture
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
        // 1. Check if user with given email or username already exists
        let userExists = await User.findOne({ $or: [{ email }, { username }] });
        if (userExists) {
            return res.status(400).json({ msg: 'User with that email or username already exists.' });
        }

        // 2. Generate unique account numbers for checking and savings
        const checkingAccountNumber = await generateUniqueAccountNumber('checking');
        const savingsAccountNumber = await generateUniqueAccountNumber('savings');

        // <<< CORRECT PLACEMENT FOR console.log STATEMENTS >>>
        console.log('Generated Checking Account Number:', checkingAccountNumber);
        console.log('Generated Savings Account Number:', savingsAccountNumber);

        // 3. Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

       // 4. Create a new User instance (ONLY ONE DECLARATION)
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
    currency, // This is the user's primary currency, also used for default account currency
    routingNumber,
    wireTransferLimit: wireTransferLimit || 10000,
    achTransferLimit: achTransferLimit || 5000,
    profilePicture: profilePicture || null,

    // <<< CRUCIAL CHANGE HERE: Assign directly to checkingAccount and savingsAccount objects >>>
    // This matches how your User Schema defines these fields
    checkingAccount: {
        type: 'checking', // This 'type' field is now supported by the updated AccountSchema
        accountNumber: checkingAccountNumber,
        balance: 0,
        currency: currency // Use the user's selected currency for the account
    },
    savingsAccount: {
        type: 'savings', // This 'type' field is now supported by the updated AccountSchema
        accountNumber: savingsAccountNumber,
        balance: 0,
        currency: currency // Use the user's selected currency for the account
    },
    // The top-level 'accounts' array that you had here before is NOT defined in your User Schema.
    // Therefore, it has been removed to match your schema's structure.
    // createdAt will be added by timestamps option in schema if enabled
    // updatedAt will be added by timestamps option in schema if enabled
});

// 5. Save the new user to the database
await newUser.save();

// 6. Respond with the created user's details (excluding password)
res.status(201).json({
    message: 'User account created successfully!',
    user: {
        _id: newUser._id,
        username: newUser.username,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        // <<< MODIFIED: Access the specific embedded account objects, not a non-existent 'accounts' array >>>
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
        profilePicture: newUser.profilePicture,
        createdAt: newUser.createdAt
    }
});

    } catch (err) {
        console.error('Error creating new user account by admin:', err.message);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ msg: err.message });
        }
        res.status(500).send('Server Error');
    }
});

/**
 * @route   GET /api/admin/users/search
 * @desc    Search for a user by ID or Email (specific endpoint for frontend)
 * @access  Private (Admin Only)
 * @query   q (required) - User ID or Email to search for
 */
router.get('/search', async (req, res) => { // <-- THIS IS THE ROUTE YOU NEED TO ADD!
    try {
        // AdminAuth middleware should have already set req.admin.
        if (req.admin.role !== 'admin' && req.admin.role !== 'superadmin') {
            return res.status(403).json({ msg: 'Authorization denied: Insufficient role.' });
        }

        const { q } = req.query; // The 'q' parameter from your frontend

        if (!q) {
            return res.status(400).json({ msg: 'Search query (q) is required.' });
        }

        let user;

        // 1. Try to find by MongoDB ObjectId
        if (mongoose.Types.ObjectId.isValid(q)) {
            user = await User.findById(q).select('-password');
        }

        // 2. If not found by ID or it wasn't a valid ID, try searching by email
        if (!user) {
            user = await User.findOne({ email: q.toLowerCase() }).select('-password');
        }

        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        // Send back relevant user details
        res.json({
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            accountStatus: user.accountStatus,
            checkingAccount: user.checkingAccount,
            savingsAccount: user.savingsAccount,
            currency: user.currency
            // Include any other user fields your frontend (admin-dashboard.js) expects from this search
        });

    } catch (err) {
        console.error('[Admin Route /users/search] Error searching user:', err.message);
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

// Inside routes/admin/users.js (after your PUT /:id route, or anywhere logical)

/**
 * @route   PUT /api/admin/users/:id/status
 * @desc    Update a user's account status (e.g., active, suspended)
 * @access  Private (Admin Only)
 */
router.put('/:id/status', async (req, res) => {
    try {
        if (req.admin.role !== 'admin' && req.admin.role !== 'superadmin') {
            return res.status(403).json({ msg: 'Authorization denied: Insufficient role.' });
        }

        const userId = req.params.id;
        const { accountStatus } = req.body; // Expecting { "accountStatus": "active" } or { "accountStatus": "suspended" }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ msg: 'Invalid user ID format.' });
        }

        if (!accountStatus || !['active', 'suspended', 'pending', 'blocked', 'restricted', 'limited'].includes(accountStatus)) {
            return res.status(400).json({ msg: 'Invalid or missing account status. Must be active, suspended, pending, blocked, restricted or limited.' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        user.accountStatus = accountStatus;
        await user.save();

        res.json({ message: 'User account status updated successfully!', user: { _id: user._id, accountStatus: user.accountStatus } });

    } catch (err) {
        console.error('Error updating user status by admin:', err.message);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ msg: err.message });
        }
        res.status(500).send('Server Error');
    }
});


module.exports = router;