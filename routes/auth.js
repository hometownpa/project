const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
// Removed direct bcrypt and crypto imports here as they are not needed in auth.js itself
// and are handled by the User/Admin models or server.js.

const { sendVerificationEmail } = require('../utils/emailService');

// Ensure JWT_SECRET is loaded from process.env, which should be set up in server.js's dotenv config
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined. Please set it in your .env file.');
    // In a real production app, you might want to throw an error or handle this more gracefully
    // but for development, process.exit(1) is fine to immediately highlight the issue.
    process.exit(1);
}

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token (and potentially initiate 2FA)
 * @access  Public
 */
router.post('/login', async (req, res) => {
    console.log('[Backend Login Trace] --- Login route entered ---');
    console.log('[Backend Login Trace] Request body:', req.body);

    try {
        let { username, password } = req.body; // Changed const to let to allow trimming

        // --- ADDED: Trim whitespace from username and password for consistency ---
        username = username ? username.trim() : '';
        password = password ? password.trim() : '';
        // --- END ADDED ---

        if (!username || !password) {
            return res.status(400).json({ message: 'Please enter both username and password.' });
        }

        // Use a case-insensitive regular expression for the username lookup.
        let user = await User.findOne({
            $or: [
                { username: new RegExp(`^${username}$`, 'i') },
                { email: username.toLowerCase() }
            ]
        }).select('+password'); // Ensure password is selected for comparison

        if (!user) {
            console.log('[Backend Login Trace] User not found or invalid username/email.');
            return res.status(400).json({ message: 'Invalid Credentials.' });
        }

        console.log('[Backend Login Trace] User found in DB.');
        // console.log('[Backend Login Trace] Full User Object (with password selected):', JSON.stringify(user)); // Kept this commented out as it can be very verbose

        // --- NEW CRUCIAL LOGS HERE for user.password ---
        console.log('[Backend Login Trace] DEBUG: User object "password" property:', user.password);
        console.log('[Backend Login Trace] DEBUG: Type of user.password:', typeof user.password);
        console.log('[Backend Login Trace] DEBUG: Length of user.password:', user.password ? user.password.length : 'N/A');
        console.log('[Backend Login Trace] DEBUG: First 10 chars of user.password:', user.password ? user.password.substring(0, 10) : 'N/A');
        console.log('[Backend Login Trace] DEBUG: user.password === null:', user.password === null);
        console.log('[Backend Login Trace] DEBUG: user.password === undefined:', user.password === undefined);
        console.log('[Backend Login Trace] DEBUG: user.password is a string:', typeof user.password === 'string');
        // --- END NEW CRUCIAL LOGS ---


        const isMatch = await user.matchPassword(password); // Use the method from User model
        if (!isMatch) {
            console.log('[Backend Login Trace] Password mismatch.');
            return res.status(400).json({ message: 'Invalid Credentials.' });
        }

        if (user.twoFactorEnabled) {
            // Moved crypto require here as it's only needed for 2FA code generation
            const crypto = require('crypto'); 
            const verificationCode = crypto.randomInt(100000, 999999).toString();
            user.twoFactorCode = verificationCode;
            user.twoFactorCodeExpires = Date.now() + 10 * 60 * 1000;

            await user.save();

            const emailSent = await sendVerificationEmail(user.email, verificationCode);
            if (!emailSent) {
                console.error(`[Backend Login] Failed to send 2FA email to ${user.email}`);
                return res.status(500).json({ message: 'Failed to send 2FA code. Please try again or contact support.' });
            }

            console.log(`[Backend Login] User ${user.username} requires 2FA. Code sent to ${user.email}`);
            return res.status(200).json({
                message: '2FA required. A verification code has been sent to your email.',
                requires2FA: true,
                userId: user._id
            });
        } else {
            // This path will only be taken if user.twoFactorEnabled is explicitly false.
            const payload = {
                user: {
                    id: user.id,
                    role: user.role
                }
            };

            // Debug log for NON-2FA path
            console.log(`[AUTH Debug] JWT_SECRET value before sign: '${JWT_SECRET}' (Type: ${typeof JWT_SECRET}) - Location: ${__filename} - LOGIN Non-2FA`);

            jwt.sign(
                payload,
                JWT_SECRET,
                { expiresIn: '72h' },
                (err, token) => {
                    if (err) throw err;
                    console.log(`[Backend Login] User '${user.username}' logged in successfully (no 2FA).`);
                    res.json({
                        message: 'Login successful!',
                        token,
                        user: {
                            id: user.id,
                            username: user.username,
                            email: user.email,
                            role: user.role,
                            fullName: user.fullName
                        }
                    });
                }
            );
        }

    } catch (error) {
        console.error('[Backend Login Trace] Error during login:', error.message);
        return res.status(500).json({ message: 'Server error during login.' });
    }
});


/**
 * @route   POST /api/auth/verify-2fa
 * @desc    Verify 2FA code
 * @access  Public
 */
router.post('/verify-2fa', async (req, res) => {
    try {
        const { userId, code } = req.body;
        // Moved crypto require here as it's only needed for 2FA code generation
        const crypto = require('crypto');

        if (!userId || !code) {
            return res.status(400).json({ message: 'User ID and verification code are required.' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (!user.twoFactorCode || user.twoFactorCode !== code || user.twoFactorCodeExpires < Date.now()) {
            return res.status(400).json({ message: 'Invalid or expired verification code.' });
        }

        user.twoFactorCode = undefined;
        user.twoFactorCodeExpires = undefined;
        await user.save();

        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        // Debug log for 2FA verification path
        console.log(`[AUTH Debug] JWT_SECRET value before sign: '${JWT_SECRET}' (Type: ${typeof JWT_SECRET}) - Location: ${__filename} - VERIFY 2FA`);

        jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: '72h' },
            (err, token) => {
                if (err) throw err;
                console.log(`[Backend 2FA] User '${user.username}' 2FA verified successfully.`);
                res.json({
                    message: '2FA verification successful!',
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        role: user.role,
                        fullName: user.fullName
                    }
                });
            }
        );

    } catch (err) {
        console.error('[Backend 2FA] Server error during 2FA verification:', err.message);
        res.status(500).json({ message: 'Server Error.' });
    }
});


/**
 * @route   POST /api/auth/resend-2fa-code
 * @desc    Resend 2FA code
 * @access  Public
 */
router.post('/resend-2fa-code', async (req, res) => {
    try {
        const { userId } = req.body;
        // Moved crypto require here as it's only needed for 2FA code generation
        const crypto = require('crypto');

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required.' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (!user.twoFactorEnabled) {
            return res.status(400).json({ message: '2FA is not enabled for this account.' });
        }

        const verificationCode = crypto.randomInt(100000, 999999).toString();
        user.twoFactorCode = verificationCode;
        user.twoFactorCodeExpires = Date.now() + 10 * 60 * 1000;

        await user.save();

        const emailSent = await sendVerificationEmail(user.email, verificationCode);
        if (!emailSent) {
            console.error(`[Backend Resend 2FA] Failed to send new 2FA email to ${user.email}`);
            return res.status(500).json({ message: 'Failed to resend 2FA code. Please try again or contact support.' });
        }

        console.log(`[Backend Resend 2FA] New 2FA code sent to ${user.email}`);
        res.status(200).json({ message: 'A new verification code has been sent to your email.' });

    } catch (err) {
        console.error('[Backend Resend 2FA] Server error during 2FA resend:', err.message);
        res.status(500).json({ message: 'Server Error.' });
    }
});


/**
 * @route   POST /api/auth/register
 * @desc    Register a new user and initialize their accounts
 * @access  Public
 */
router.post('/register', async (req, res) => {
    console.log('[Backend Register Trace] --- Register route entered ---');
    console.log('[Backend Register Trace] Request body:', req.body);

    try {
        let { email, password, username, fullName, routingNumber, homeAddress, phone, gender, nationality, occupation, profilePictureUrl, wireTransferLimit, achTransferLimit } = req.body;

        // --- ADDED: Trim and normalize inputs early ---
        email = email ? email.toLowerCase().trim() : '';
        password = password ? password.trim() : '';
        username = username ? username.toLowerCase().trim() : '';
        fullName = fullName ? fullName.trim() : '';
        routingNumber = routingNumber ? routingNumber.trim() : '';
        homeAddress = homeAddress ? homeAddress.trim() : '';
        phone = phone ? phone.trim() : '';
        gender = gender ? gender.trim() : '';
        nationality = nationality ? nationality.trim() : '';
        occupation = occupation ? occupation.trim() : '';
        profilePictureUrl = profilePictureUrl ? profilePictureUrl.trim() : '';
        // --- END ADDED ---

        // --- Detailed validation check ---
        if (!email || !password || !username || !fullName || !routingNumber) {
            console.log('[Backend Register] Error: Missing required core fields (email, password, username, fullName, routingNumber).');
            return res.status(400).json({ message: 'Please enter all required fields: email, password, username, full name, and routing number.' });
        }

        console.log('[Backend Register Trace] Checking for existing user...');
        // Use the trimmed and lowercased values for uniqueness checks
        let user = await User.findOne({ $or: [{ email: email }, { username: username }] });
        if (user) {
            if (user.email === email) { // Now comparing trimmed & lowercased emails
                console.log(`[Backend Register] Error: User with email '${email}' already exists.`);
                return res.status(400).json({ message: 'User with this email already exists.' });
            }
            if (user.username === username) { // Now comparing trimmed & lowercased usernames
                console.log(`[Backend Register] Error: User with username '${username}' already exists.`);
                return res.status(400).json({ message: 'User with this username already exists.' });
            }
        }

        // --- Account number generation logic ---
        const generateUniqueAccountNumber = async () => {
            let newAccNum;
            let exists = true;
            while (exists) {
                newAccNum = Math.floor(1000000000 + Math.random() * 9000000000).toString();
                const existingUser = await User.findOne({
                    $or: [
                        { 'checkingAccount.accountNumber': newAccNum },
                        { 'savingsAccount.accountNumber': newAccNum }
                    ]
                });
                exists = !!existingUser;
            }
            console.log(`[Backend Register Trace] Generated unique account candidate: ${newAccNum}`);
            return newAccNum;
        };

        console.log('[Backend Register Trace] Starting account number generation...');
        const checkingAccountNumber = await generateUniqueAccountNumber();
        const savingsAccountNumber = await generateUniqueAccountNumber();
        console.log(`[Backend Register Trace] Final Checking Account Number: ${checkingAccountNumber}`);
        console.log(`[Backend Register Trace] Final Savings Account Number: ${savingsAccountNumber}`);

        console.log('[Backend Register Trace] Creating new User instance...');
        user = new User({
            username: username, // Use the already trimmed and lowercased username
            email: email,       // Use the already trimmed and lowercased email
            password: password, // Password will be hashed by pre-save hook in User model
            role: 'user', // Default role for new registrations
            fullName,
            routingNumber,
            homeAddress,
            phone,
            gender,
            nationality,
            occupation,
            profilePictureUrl,
            wireTransferLimit: wireTransferLimit || 10000,
            achTransferLimit: achTransferLimit || 5000,
            checkingAccount: {
                accountNumber: checkingAccountNumber,
                balance: 0.00,
                currency: 'USD',
                accountStatus: 'active',
                openedDate: new Date(),
                type: 'checking'
            },
            savingsAccount: {
                accountNumber: savingsAccountNumber,
                balance: 0.00,
                currency: 'USD',
                accountStatus: 'active',
                openedDate: new Date(),
                type: 'savings'
            },
            cards: [],
            twoFactorEnabled: true
        });
        console.log('[Backend Register Trace] User instance created. Attempting first save...');

        // --- First save to trigger password hashing and initial user creation ---
        await user.save();
        console.log(`[Backend Register] New user '${username}' registered successfully with initial accounts.`);
        console.log('[Backend Register Trace] User document saved for the first time.');

        // --- Initiate 2FA process immediately after initial save ---
        console.log('[Backend Register Trace] Initiating 2FA for new user...');
        // Moved crypto require here as it's only needed for 2FA code generation
        const crypto = require('crypto');
        const verificationCode = crypto.randomInt(100000, 999999).toString();
        user.twoFactorCode = verificationCode;
        user.twoFactorCodeExpires = Date.now() + 10 * 60 * 1000;

        console.log('[Backend Register Trace] Attempting second save (for 2FA details)...');
        await user.save(); // Save again with 2FA details
        console.log('[Backend Register Trace] 2FA code and expiry saved to user document.');

        console.log('[Backend Register Trace] Attempting to send verification email...');
        const emailSent = await sendVerificationEmail(user.email, verificationCode);
        if (!emailSent) {
            console.error(`[Backend Register] Failed to send initial 2FA email to ${user.email}`);
            return res.status(200).json({ message: 'Registration successful, but failed to send 2FA code. Please contact support.', requires2FA: true, userId: user._id });
        }
        console.log(`[Backend Register Trace] Verification email sent to ${user.email}.`);

        res.status(201).json({
            message: 'Registration successful! A verification code has been sent to your email. Please verify to log in.',
            requires2FA: true,
            userId: user._id
        });

    } catch (error) {
        console.error('[Backend Register] *** UNEXPECTED SERVER ERROR DURING REGISTRATION ***');
        console.error('[Backend Register] Error Name:', error.name);
        console.error('[Backend Register] Error Message:', error.message);
        console.error('[Backend Register] Full Error Object:', error);

        if (error.name === 'ValidationError') {
            const errors = {};
            for (let field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            console.error('[Backend Register] Mongoose Validation Error Details:', errors);
            return res.status(400).json({ message: 'Validation failed.', errors });
        } else if (error.code === 11000) {
            console.error('[Backend Register] Duplicate Key Error: A user with this unique field (e.g., username, email, routingNumber) already exists.');
            return res.status(409).json({ message: 'A user with this unique detail (username, email, or routing number) already exists.' });
        } else if (error.kind === 'ObjectId') {
            console.error('[Backend Register] Invalid ObjectId encountered.');
            return res.status(400).json({ message: 'Invalid ID provided.' });
        }
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

/**
 * @route   POST /api/auth/admin-login
 * @desc    Authenticate admin user & get token
 * @access  Public
 */
router.post('/admin-login', async (req, res) => {
    console.log('[Admin Login Route] Received request body:', req.body);

    let { username, password } = req.body; // Changed const to let to allow trimming

    // --- ADDED: Trim whitespace from username and password for consistency ---
    username = username ? username.trim() : '';
    password = password ? password.trim() : '';
    // --- END ADDED ---

    if (!username || !password) {
        console.log('[Admin Login Route] Missing username or password.');
        return res.status(400).json({ msg: 'Please enter both username and password.' });
    }

    try {
        console.log(`[Admin Login Route] Attempting to find admin in collection: '${Admin.collection.name}'`);
        // Note: For admin login, consider also making the username lookup case-insensitive
        // if your Admin model's username field does not enforce lowercase.
        const adminUser = await Admin.findOne({
            $or: [
                { username: username.toLowerCase() }, // Assuming admin usernames are stored lowercase
                { email: username.toLowerCase() }
            ]
        }).select('+password'); // Ensure password is selected

        if (!adminUser) {
            console.log(`[Admin Login Route] Login failed: Admin user '${username}' not found in '${Admin.collection.name}' collection.`);
            return res.status(400).json({ msg: 'Invalid Credentials.' });
        }

        if (!['admin', 'superadmin', 'moderator'].includes(adminUser.role)) {
            console.log(`[Admin Login Route] Login failed: User '${username}' found, but role '${adminUser.role}' is not an authorized admin role.`);
            return res.status(403).json({ msg: 'Access Denied: Not an authorized admin user.' });
        }

        const isMatch = await adminUser.matchPassword(password); // Use the method from Admin model
        if (!isMatch) {
            console.log('[Admin Login Route] Login failed: Password mismatch.');
            return res.status(400).json({ msg: 'Invalid Credentials.' });
        }

        const payload = {
            admin: {
                id: adminUser.id,
                role: adminUser.role
            }
        };

        // Debug log for Admin Login
        console.log(`[AUTH Debug] JWT_SECRET value before sign: '${JWT_SECRET}' (Type: ${typeof JWT_SECRET}) - Location: ${__filename} - ADMIN LOGIN`);

        jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: '72h' },
            (err, token) => {
                if (err) throw err;
                console.log(`[Backend Admin Login] SUCCESS: Admin '${adminUser.username}' logged in. Token issued.`);
                res.json({ token, msg: 'Admin login successful!' });
            }
        );

    } catch (err) {
        console.error('[Admin Login Route] Server error during admin login:', err.message);
        res.status(500).send('Server Error during admin login.');
    }
});

module.exports = router;