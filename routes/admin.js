// routes/admin.js (Complete and Updated Version)
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // Ensure your User model has 'cards' and 'routingNumber' fields
const Transaction = require('../models/Transaction');
const Message = require('../models/Message');
const mongoose = require('mongoose');
const AdminAuth = require('../middleware/adminAuthMiddleware'); // <--- IMPORTANT: Use the correct name and path
const authorize = require('../middleware/authorize'); 
const protectAdmin = require('../middleware/protectAdmin'); // Adjust path as necessary
const crypto = require('crypto'); // Ensure crypto is imported for card number generation

// --- Helper function to generate unique 10-digit account number (Server-side) ---
async function generateUniqueAccountNumber() {
    let accountNumber = '';
    let isUnique = false;
    while (!isUnique) {
        accountNumber = '';
        for (let i = 0; i < 10; i++) {
            accountNumber += Math.floor(Math.random() * 10);
        }
        const existingUser = await User.findOne({
            $or: [
                { 'checkingAccount.accountNumber': accountNumber },
                { 'savingsAccount.accountNumber': accountNumber }
            ]
        });
        if (!existingUser) {
            isUnique = true;
        } else {
            console.log(`[Admin Route] Generated duplicate account number: ${accountNumber}. Retrying...`);
        }
    }
    return accountNumber;
}

// --- Helper function to generate a random 4-digit transfer PIN ---
function generateRandomTransferPin() {
    return Math.floor(1000 + Math.random() * 9000).toString(); // Generates a number between 1000 and 9999
}

// --- Helper functions for Bank Card Generation (Backend-side) ---
// These helpers are specific to creating card details and can be placed here
// or in a separate utility file if they become more complex/reused.

/**
 * Generates a unique 16-digit card number using the Luhn algorithm for validity.
 * Ensures the generated number does not already exist in the database.
 * @returns {string} A unique 16-digit credit card number.
 */
async function generateLuhnValidCardNumber() {
    let cardNumber;
    let isUnique = false;

    // Function to calculate Luhn checksum
    const calculateLuhn = (num) => {
        let sum = 0;
        let parity = num.length % 2; // For 16 digits, length is even, so parity is 0. Check sum of digits.

        for (let i = 0; i < num.length; i++) {
            let digit = parseInt(num[i]);
            if (i % 2 === parity) { // Double every second digit (from the right, or 'odd' positions if counting from left starting at 1)
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
        }
        return (sum % 10);
    };

    while (!isUnique) {
        // Generate 15 random digits and prepend a '4' (common for Visa) or other prefix
        let partialCard = '4' + Array(14).fill(0).map(() => Math.floor(Math.random() * 10)).join('');

        // Calculate the checksum digit
        let checksumDigit = (10 - calculateLuhn(partialCard)) % 10;
        cardNumber = partialCard + checksumDigit; // Append the checksum digit

        // Check for uniqueness in the database (across all users' cards)
        const existingUser = await User.findOne({ 'cards.cardNumber': cardNumber });
        if (!existingUser) {
            isUnique = true;
        } else {
            console.log(`[Admin Route] Generated duplicate card number (Luhn): ${cardNumber}. Retrying...`);
        }
    }
    return cardNumber;
}

/**
 * Generates a random CVV of specified length (3 for debit, 4 for credit).
 * @param {number} length - The desired length of the CVV (3 or 4).
 * @returns {string} A random CVV string.
 */
const generateCVV = (length = 3) => {
    return Array(length).fill(0).map(() => Math.floor(Math.random() * 10)).join('');
};

/**
 * Generates an expiry date (MM/YY) for 5 years from the current date.
 * @returns {string} The expiry date in MM/YY format.
 */
const generateExpiryDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 5); // Set expiry 5 years from now
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
    const year = date.getFullYear().toString().substring(2); // Get last two digits of the year
    return `${month}/${year}`;
};

// Placeholder for your email service (replace with actual implementation)
// This function needs to be defined or imported from somewhere, e.g., '../utils/emailService'
const sendEmail = async (to, subject, htmlContent) => {
    console.log(`[Email Service] Attempting to send email to: ${to}`);
    console.log(`[Email Service] Subject: ${subject}`);
    // console.log(`[Email Service] Content: ${htmlContent}`); // Uncomment for debugging email content
    // Implement your actual email sending logic here (e.g., using Nodemailer)
    // For now, it just simulates success.
    return true; // Simulate success
};


// ========================================================================
// === IMPORTANT: Router paths assume this file is mounted at /api/admin ===
// === e.g., in server.js: app.use('/api/admin', require('./routes/admin')); ===
// ========================================================================


// --- CORE ROUTES (POST/GET all users) ---
// --- @route   POST /api/admin/ (maps to router.post('/') ) ---
// @desc    Admin creates a new user account and profile
// @access  Private (Admin Only)
router.post('/', authorize('admin'), async (req, res) => {
    console.log('[Admin Route] === ATTEMPTING USER CREATION ROUTE ===');
    console.log('[Admin Route] Request Body:', req.body);
    try {
        const {
            email,
            password,
            fullName,
            username,
            homeAddress,
            phone,
            gender,
            nationality,
            occupation,
            currency,
            wireTransferLimit,
            achTransferLimit,
            profilePicture,
            routingNumber // Include routingNumber for new user creation
        } = req.body;

        if (!username || !email || !password || !fullName || !phone || !homeAddress || !gender || !nationality || !occupation || !currency) {
            return res.status(400).json({ msg: 'Please enter all required fields: username, email, password, full name, phone, home address, gender, nationality, occupation, and currency.' });
        }

        let user = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] });
        if (user) {
            return res.status(400).json({ msg: 'User with this email or username already exists.' });
        }

        const newCheckingAccountNumber = await generateUniqueAccountNumber();
        const newSavingsAccountNumber = await generateUniqueAccountNumber();
        const generatedTransferPin = generateRandomTransferPin(); // Generate the transfer PIN

        user = new User({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password: password, // Password will be hashed by a pre-save hook in your User model
            transferPin: generatedTransferPin, // Assign the generated transfer PIN
            role: 'user',
            fullName,
            homeAddress,
            phone,
            gender,
            nationality,
            occupation,
            profilePicture: profilePicture || '',
            routingNumber: routingNumber || Math.floor(100000000 + Math.random() * 900000000).toString(), // Assign default or provided routing number
            checkingAccount: {
                accountNumber: newCheckingAccountNumber,
                balance: 0.00,
                currency: currency
            },
            savingsAccount: {
                accountNumber: newSavingsAccountNumber,
                balance: 0.00,
                currency: currency
            },
            wireTransferLimit: parseFloat(wireTransferLimit) || 10000.00,
            achTransferLimit: parseFloat(achTransferLimit) || 5000.00,
            accountStatus: 'Active',
            isVerified: false,
            kycStatus: 'Pending',
            cards: [] // Initialize cards array for new user
        });

        await user.save();

        console.log('[Admin Route] User created successfully:', user.email);

        // Optionally, send an email to the user with their initial transfer PIN
        // WARNING: Sending sensitive info like PINs via email is not best practice.
        // It's generally better to have the user set it themselves on first login,
        // or provide a secure way to retrieve/reset it. For this example, we'll include it.
        const emailSubject = `Welcome to Hometown Bank! Your New Account Details`;
        const emailHtmlContent = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #0056b3;">Welcome to Hometown Bank!</h2>
                <p>Dear ${user.fullName},</p>
                <p>Your account has been successfully created by our administrator. Here are your details:</p>
                <ul>
                    <li><strong>Username:</strong> ${user.username}</li>
                    <li><strong>Email:</strong> ${user.email}</li>
                    <li><strong>Checking Account Number:</strong> ${user.checkingAccount.accountNumber}</li>
                    <li><strong>Savings Account Number:</strong> ${user.savingsAccount.accountNumber}</li>
                    <li><strong>Routing Number:</strong> ${user.routingNumber}</li>
                </ul>
                <p>You can log in using your username and the password provided by the administrator.</p>
                <p>If you have any questions, please do not hesitate to contact our support team.</p>
                <p>Thank you,</p>
                <p>The Hometown Bank</p>
                <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;">
                <p style="font-size: 0.8em; color: #777;">This is an automated email, please do not reply.</p>
            </div>
        `;
        await sendEmail(user.email, emailSubject, emailHtmlContent);


        res.status(201).json({
            msg: 'User account and profile created successfully!',
            user: {
                _id: user._id,
                email: user.email,
                username: user.username,
                fullName: user.fullName,
                checkingAccount: user.checkingAccount,
                savingsAccount: user.savingsAccount,
                role: user.role,
                accountStatus: user.accountStatus,
                wireTransferLimit: user.wireTransferLimit,
                achTransferLimit: user.achTransferLimit,
                routingNumber: user.routingNumber, // Include routingNumber in creation response
                // Do NOT return the raw transferPin in the response for security reasons
            }
        });

    } catch (err) {
        console.error('[Admin Route] Error creating user:', err.message);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ msg: messages.join(', ') });
        }
        res.status(500).send('Server error during user creation.');
    }
});

// --- @route   GET /api/admin/ (maps to router.get('/') ) ---
// @desc    Get all users with optional search
// @access  Private (Admin Only)
router.get('/', authorize('admin'), async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query = {
                $or: [
                    { fullName: searchRegex },
                    { email: searchRegex },
                    { username: searchRegex },
                    { 'checkingAccount.accountNumber': searchRegex },
                    { 'savingsAccount.accountNumber': searchRegex },
                    { routingNumber: searchRegex } // Allow search by routing number
                ]
            };
        }

        const users = await User.find(query)
            .select('-password -twoFactorCode -twoFactorCodeExpires -__v -transferPin') // Exclude transferPin
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        console.error('[Admin Route] Error fetching users:', err.message);
        res.status(500).send('Server Error');
    }
});

// --- ADMIN SPECIFIC STATIC ROUTES (MUST BE BEFORE PARAMETERIZED :id ROUTES) ---

// --- @route   GET /api/admin/profile ---
// @desc    Get admin's own profile (the logged-in admin)
// @access  Private (Admin Only)
router.get('/profile', authorize('admin'), async (req, res) => {
    try {
        console.log('[Admin Profile Route] Current req.admin object:', req.admin);
        console.log('[Admin Profile Route] Value of req.admin.id:', req.admin ? req.admin.id : 'req.admin is null/undefined');
        if (!req.admin) {
            console.error('[Admin Profile Route] Error: req.admin object is missing after AdminAuth middleware.');
            return res.status(404).json({ msg: 'Admin profile data not found in request context.' });
        }
        // Assuming req.admin already contains the necessary admin details from the authorize middleware.
        // If not, you might need to fetch the admin user from the DB using req.admin.id here.
        res.json(req.admin);
    } catch (err) {
        console.error('[Admin Route] Unexpected error during admin profile fetch:', err.message);
        res.status(500).send('Server error during admin profile fetch.');
    }
});


// --- @route   GET /api/admin/find-user ---
// @desc    Find a user by email, username, or account number (distinct path for specific lookup)
// @access  Private (Admin Only)
router.get('/find-user', authorize('admin'), async (req, res) => {
    try {
        const { identifier } = req.query;
        if (!identifier) {
            return res.status(400).json({ msg: 'Identifier (email, username, account number, or routing number) is required.' });
        }

        let user = null;
        const identifierRegex = new RegExp(`^${identifier}$`, 'i'); // Case-insensitive exact match

        user = await User.findOne({ email: identifierRegex }).select('-password -twoFactorCode -twoFactorCodeExpires -__v -transferPin'); // Exclude transferPin
        if (!user) {
            user = await User.findOne({ username: identifierRegex }).select('-password -twoFactorCode -twoFactorCodeExpires -__v -transferPin'); // Exclude transferPin
        }
        if (!user) {
            user = await User.findOne({ 'checkingAccount.accountNumber': identifierRegex }).select('-password -twoFactorCode -twoFactorCodeExpires -__v -transferPin'); // Exclude transferPin
        }
        if (!user) {
            user = await User.findOne({ 'savingsAccount.accountNumber': identifierRegex }).select('-password -twoFactorCode -twoFactorCodeExpires -__v -transferPin'); // Exclude transferPin
        }
        if (!user) {
            user = await User.findOne({ routingNumber: identifierRegex }).select('-password -twoFactorCode -twoFactorCodeExpires -__v -transferPin'); // Exclude transferPin
        }

        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }
        res.json({ user });
    } catch (err) {
        console.error('[Admin Route] Error finding user by identifier:', err.message);
        res.status(500).json({ msg: 'Server Error. Could not find user.' });
    }
});


// --- @route   GET /api/admin/transactions ---
// @desc    Get all transactions (with optional filters/search)
// @access  Private (Admin Only)
router.get('/transactions', authorize('admin'), async (req, res) => {
    try {
        const { status, search, limit } = req.query;
        let query = {};

        if (status && status !== 'All Statuses') {
            query.status = status;
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { description: searchRegex },
                { transactionId: searchRegex }, // Assuming you have this field in your Transaction model
                // You might also want to search by account numbers here
                { fromAccount: searchRegex },
                { toAccount: searchRegex }
            ];
        }

        let transactionsQuery = Transaction.find(query);

         transactionsQuery = transactionsQuery
            .populate('userId', 'fullName email checkingAccount savingsAccount')
            .populate('recipientUserId', 'fullName email checkingAccount savingsAccount'); // <-- CORRECTED LINE!

        transactionsQuery = transactionsQuery.sort({ createdAt: -1 });

        const parsedLimit = parseInt(limit);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
            transactionsQuery = transactionsQuery.limit(parsedLimit);
        }

        const transactions = await transactionsQuery.exec();

        res.json(transactions);
    } catch (err) {
        console.error('[Admin Route] Error fetching transactions:', err.message);
        res.status(500).send('Server Error');
    }
});

// --- @route   PUT /api/admin/transactions/:id/status ---
// @desc    Update a transaction's status
// @access  Private (Admin Only)
router.put('/transactions/:id/status', authorize('admin'), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid transaction ID format.' });
        }

        const { newStatus, adminNoteMessage, sendTransactionStatusEmail } = req.body;
        const transactionId = req.params.id;

        const allowedTransactionStatuses = ['pending', 'completed', 'appproved', 'rejected', 'failed', 'limit_exceeded', 'processing', 'cancelled'];
        if (!newStatus || !allowedTransactionStatuses.includes(newStatus)) {
            return res.status(400).json({ msg: `Invalid transaction status provided. Must be one of: ${allowedTransactionStatuses.join(', ')}.` });
        }

        const transaction = await Transaction.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({ msg: 'Transaction not found.' });
        }

        const oldStatus = transaction.status;

        if (oldStatus === newStatus && !adminNoteMessage && !sendTransactionStatusEmail) {
            return res.status(200).json({ msg: `Transaction status is already '${newStatus}'. No update needed.`, transaction: transaction });
        }

        transaction.status = newStatus;
        if (!transaction.adminNotes) {
            transaction.adminNotes = [];
        }
        if (adminNoteMessage) {
            transaction.adminNotes.push({ note: adminNoteMessage, timestamp: new Date(), adminId: req.admin.id }); // Assuming req.admin.id holds admin's ID
        }
        await transaction.save();

        const user = await User.findById(transaction.userId); // CORRECTED: Use transaction.userId based on your Transaction model's field for the sender/main user

        if (sendTransactionStatusEmail && user && user.email) {
            const subject = `Update on Your Transaction (ID: ${transaction.transactionId})`;

            let htmlContent = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2 style="color: #0056b3;">Your Hometown Bank Transaction Update</h2>
                    <p>Dear ${user.fullName || user.email},</p>
                    <p>This is to inform you about an update to your transaction:</p>
                    <ul>
                        <li><strong>Transaction ID:</strong> ${transaction.transactionId}</li>
                        <li><strong>Amount:</strong> ${transaction.currency} ${transaction.amount.toFixed(2)}</li>
                        <li><strong>Description:</strong> ${transaction.description || 'N/A'}</li>
                        <li><strong>Old Status:</strong> <span style="color: grey;">${oldStatus}</span></li>
                        <li><strong>New Status:</strong> <span style="color: ${newStatus === 'completed' ? 'green' : (newStatus === 'failed' || newStatus === 'restricted' || newStatus === 'cancelled' ? 'red' : 'orange')}; font-weight: bold;">${newStatus}</span></li>
                    </ul>
            `;

            if (adminNoteMessage) {
                htmlContent += `
                    <p><strong>Hometown Bank Message:</strong></p>
                    <p style="background-color: #f0f0f0; padding: 10px; border-left: 3px solid #0056b3; margin-left: 20px;">
                        ${adminNoteMessage}
                    </p>
                `;
            }

            htmlContent += `
                    <p>If you have any questions, please contact our support team.</p>
                    <p>Thank you,</p>
                    <p>The Hometown Bank</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;">
                    <p style="font-size: 0.8em; color: #777;">This is an automated email, please do not reply.</p>
                </div>
            `;

            const emailSent = await sendEmail(user.email, subject, htmlContent);
            if (emailSent) {
                console.log(`Transaction status email sent successfully to ${user.email}.`);
            } else {
                console.error(`Failed to send transaction status email to ${user.email}.`);
            }
        } else if (sendTransactionStatusEmail && (!user || !user.email)) {
            console.warn(`Attempted to send transaction status email for transaction ${transactionId}, but user or user email was missing.`);
        }

        res.json({ msg: 'Transaction status updated successfully!', transaction: transaction });

    } catch (err) {
        console.error('[Admin Route] Error updating transaction status:', err.message);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ msg: messages.join(', ') });
        }
        res.status(500).send('Server error during transaction status update.');
    }
});

router.get('/transactions/:id', authorize('admin'), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid transaction ID format.' });
        }

        const transaction = await Transaction.findById(req.params.id)
                                            .populate('userId', 'fullName email') // IMPORTANT: Populate main user details
                                            .populate('recipientUserId', 'fullName email') // If you also need recipient details
                                            ;

        if (!transaction) {
            return res.status(404).json({ msg: 'Transaction not found.' });
        }

        res.json(transaction); // Send the populated transaction object

    } catch (err) {
        console.error('[Admin Route] Error fetching single transaction:', err.message);
        res.status(500).send('Server error during single transaction fetch.');
    }
});

// --- @route   GET /api/admin/messages ---
// @desc    Get all messages/support tickets
// @access  Private (Admin Only)
router.get('/messages', authorize('admin'), async (req, res) => {
    try {
        const messages = await Message.find()
            .populate('senderId', 'fullName email')
            .populate('recipientId', 'fullName email')
            .sort({ createdAt: -1 });
        res.json(messages);
    } catch (err) {
        console.error('[Admin Route] Error fetching messages:', err.message);
        res.status(500).send('Server Error');
    }
});

// --- @route   GET /api/admin/messages/:id ---
// @desc    Get a single message/ticket by ID and mark as read
// @access  Private (Admin Only)
router.get('/messages/:id', authorize('admin'), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid message ID format.' });
        }

        const message = await Message.findById(req.params.id)
            .populate('senderId', 'fullName email')
            .populate('recipientId', 'fullName email');
        if (!message) {
            return res.status(404).json({ msg: 'Message not found.' });
        }
        if (!message.readByRecipient) {
            message.readByRecipient = true;
            await message.save();
        }
        res.json(message);
    } catch (err) {
        console.error(`[Admin Route] Error fetching message ${req.params.id}:`, err.message);
        res.status(500).send('Server Error');
    }
});

// --- @route   PUT /api/admin/messages/:id/status ---
// @desc    Update a message/ticket status
// @access  Private (Admin Only)
router.put('/messages/:id/status', authorize('admin'), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid message ID format.' });
        }

        const { ticketStatus } = req.body;
        const allowedTicketStatuses = ['open', 'in_progress', 'resolved', 'closed'];
        if (!ticketStatus || !allowedTicketStatuses.includes(ticketStatus)) {
            return res.status(400).json({ msg: `Invalid ticket status provided. Must be one of: ${allowedTicketStatuses.join(', ')}.` });
        }

        const updatedMessage = await Message.findByIdAndUpdate(
            req.params.id,
            { $set: { ticketStatus: ticketStatus } },
            { new: true, runValidators: true }
        ).populate('senderId', 'fullName email');

        if (!updatedMessage) {
            return res.status(404).json({ msg: 'Message/ticket not found.' });
        }

        res.json({ msg: 'Message/ticket status updated successfully!', message: updatedMessage });

    } catch (err) {
        console.error('[Admin Route] Error updating message status:', err.message);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ msg: messages.join(', ') });
        }
        res.status(500).send('Server error during message status update.');
    }
});

// --- @route   POST /api/admin/messages/reply/:ticketId ---
// @desc    Admin replies to a support ticket (distinct path)
// @access  Private (Admin Only)
router.post('/messages/reply/:ticketId', protectAdmin, authorize('admin'), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.ticketId)) {
            return res.status(400).json({ msg: 'Invalid ticket ID format.' });
        }

        const { body } = req.body;
        const { ticketId } = req.params;

        // CHANGE THIS TO req.admin.id for consistency in admin routes
        if (!req.admin || !req.admin.id) {
            return res.status(401).json({ msg: 'Admin authentication required. (No admin ID found on request)' });
        }

        if (!body) {
            return res.status(400).json({ msg: 'Reply body is required.' });
        }

        const originalTicket = await Message.findById(ticketId);
        if (!originalTicket) {
            return res.status(404).json({ msg: 'Original ticket not found.' });
        }

        const replyMessage = new Message({
            senderId: req.admin.id, // <--- CHANGE TO req.admin.id
            recipientId: originalTicket.senderId,
            subject: `RE: ${originalTicket.subject}`,
            body: body,
            type: 'reply',
            ticketStatus: originalTicket.ticketStatus === 'open' ? 'in_progress' : originalTicket.ticketStatus
        });

        await replyMessage.save();

        if (originalTicket.ticketStatus === 'open') {
            originalTicket.ticketStatus = 'in_progress';
            await originalTicket.save();
        }

        res.status(201).json({ msg: 'Reply sent successfully!', reply: replyMessage });

    } catch (err) {
        console.error('[Admin Route] Error sending reply:', err.message);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ msg: messages.join(', ') });
        }
        res.status(500).send('Server error when sending reply.');
    }
});

// --- PARAMETERIZED ROUTES (order among these matters less than general vs. specific, but keeping similar patterns together is good) ---

// --- @route   GET /api/admin/:id (maps to router.get('/:id') ) ---
// @desc    Get single user by ID
// @access  Private (Admin Only)
router.get('/:id', authorize('admin'), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid user ID format.' });
        }
        const user = await User.findById(req.params.id)
            .select('-password -twoFactorCode -twoFactorCodeExpires -__v -transferPin'); // This will still return cards and routingNumber if they exist on the schema and are not explicitly excluded
        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }
        res.json(user);
    } catch (err) {
        console.error(`[Admin Route] Error fetching user ${req.params.id}:`, err.message);
        res.status(500).send('Server Error');
    }
});

// --- @route   PUT /api/admin/:id (maps to router.put('/:id') ) ---
// @desc    Update user profile by ID
// @access  Private (Admin Only)
router.put('/:id', authorize('admin'), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid user ID format.' });
        }

        const {
            fullName, homeAddress, phone, gender, nationality, occupation,
            currency,
            wireTransferLimit, achTransferLimit, role, email, username,
            accountStatus, profilePicture,
            checkingAccount,
            savingsAccount,
            routingNumber // Allow routingNumber to be updated
        } = req.body;

        const userId = req.params.id;
        let user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        if (fullName !== undefined) user.fullName = fullName;
        if (homeAddress !== undefined) user.homeAddress = homeAddress;
        if (phone !== undefined) user.phone = phone;
        if (gender !== undefined) user.gender = gender;
        if (nationality !== undefined) user.nationality = nationality;
        if (occupation !== undefined) user.occupation = occupation;
        if (profilePicture !== undefined) user.profilePicture = profilePicture;
        if (routingNumber !== undefined) user.routingNumber = routingNumber; // Update routing number

        if (currency !== undefined) {
            user.checkingAccount.currency = currency;
            user.savingsAccount.currency = currency;
        }

        if (checkingAccount && checkingAccount.accountNumber !== undefined) {
            user.checkingAccount.accountNumber = checkingAccount.accountNumber;
        }
        if (savingsAccount && savingsAccount.accountNumber !== undefined) {
            user.savingsAccount.accountNumber = savingsAccount.accountNumber;
        }

        if (wireTransferLimit !== undefined) user.wireTransferLimit = parseFloat(wireTransferLimit);
        if (achTransferLimit !== undefined) user.achTransferLimit = parseFloat(achTransferLimit);

        if (role && ['user', 'admin'].includes(role)) {
            user.role = role;
        }

        const allowedStatuses = ['active', 'blocked', 'restricted', 'limited', 'suspended', 'pending'];
        if (accountStatus !== undefined) {
            if (!allowedStatuses.includes(accountStatus)) {
                return res.status(400).json({ msg: `Invalid account status provided. Must be one of: ${allowedStatuses.join(', ')}.` });
            }
            user.accountStatus = accountStatus;
        }

        if (email && email.toLowerCase() !== user.email) {
            const existingUserWithEmail = await User.findOne({ email: email.toLowerCase(), _id: { $ne: userId } });
            if (existingUserWithEmail) {
                return res.status(400).json({ msg: 'Another user already exists with this email.' });
            }
            user.email = email.toLowerCase();
        }
        if (username && username.toLowerCase() !== user.username) {
            const existingUserWithUsername = await User.findOne({ username: username.toLowerCase(), _id: { $ne: userId } });
            if (existingUserWithUsername) {
                return res.status(400).json({ msg: 'Another user already exists with this username.' });
            }
            user.username = username.toLowerCase();
        }

        await user.save();

        const updatedUserResponse = user.toObject();
        delete updatedUserResponse.password;
        delete updatedUserResponse.twoFactorCode;
        delete updatedUserResponse.twoFactorCodeExpires;
        delete updatedUserResponse.__v;
        delete updatedUserResponse.transferPin; // Ensure transferPin is not sent back

        res.json({ msg: 'User updated successfully!', user: updatedUserResponse });

    } catch (err) {
        console.error('[Admin Route] Error updating user:', err.message);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ msg: messages.join(', ') });
        }
        res.status(500).send('Server error during user update.');
    }
});

// --- NEW ROUTE: @route   PUT /api/admin/:id/transfer-pin ---
// @desc    Admin resets or sets a user's transfer PIN
// @access  Private (Admin Only)
router.put('/:id/transfer-pin', authorize('admin'), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid user ID format.' });
        }

        const { newPin, sendEmailNotification } = req.body;
        const userId = req.params.id;

        if (!newPin || !/^\d{4}$/.test(newPin)) { // Validate for a 4-digit numeric PIN
            return res.status(400).json({ msg: 'A 4-digit numeric transfer PIN is required.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        // The pre-save hook in the User model will handle hashing the newPin
        user.transferPin = newPin;
        await user.save();

        console.log(`[Admin Route] User ${user.email}'s Transfer PIN has been reset.`);

        if (sendEmailNotification && user.email) {
            const subject = `Your Hometown Bank Transfer PIN Reset`;
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2 style="color: #0056b3;">Your Hometown Bank Account Update</h2>
                    <p>Dear ${user.fullName || user.email},</p>
                    <p>Your transfer PIN has been reset by an administrator.</p>
                    <p>Your new transfer PIN is: <strong style="color: #d9534f;">${newPin}</strong></p>
                    <p>For security, please consider changing your PIN after logging in.</p>
                    <p>If you did not request this change, please contact our support immediately.</p>
                    <p>Thank you,</p>
                    <p>The Hometown Bank</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;">
                    <p style="font-size: 0.8em; color: #777;">This is an automated email, please do not reply.</p>
                </div>
            `;
            await sendEmail(user.email, subject, htmlContent);
        }

        res.json({ msg: 'User transfer PIN updated successfully!' });

    } catch (err) {
        console.error('[Admin Route] Error updating user transfer PIN:', err.message);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ msg: messages.join(', ') });
        }
        res.status(500).send('Server error during transfer PIN update.');
    }
});

// --- @route   DELETE /api/admin/:id (maps to router.delete('/:id') ) ---
// @desc    Delete a user and their associated data atomically
// @access  Private (Admin Only)
router.delete('/:id', authorize('admin'), async (req, res) => {
    const userId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ msg: 'Invalid user ID format.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findById(userId).session(session);
        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ msg: 'User not found.' });
        }

        // Delete all associated data using the user's ID
        await Transaction.deleteMany({ userId: userId }, { session });
        await Message.deleteMany({ $or: [{ senderId: userId }, { recipientId: userId }] }, { session });

        // Also remove any cards associated with this user (if cards were a separate collection)
        // If cards are embedded in the User model, deleting the user deletes the cards automatically.
        // If you had a separate BankCard model that referenced userId, you would add:
        // await BankCard.deleteMany({ userId: userId }, { session });

        await User.findByIdAndDelete(userId, { session });

        await session.commitTransaction();
        session.endSession();

        res.json({ msg: 'User and associated data deleted successfully.' });

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error('[Admin Route] Error deleting user:', err.message);
        res.status(500).send('Server error during user deletion.');
    }
});

// --- @route   POST /api/admin/funds/:userId ---
// @desc    Credit or Debit funds from a user's account (distinct path)
// @access  Private (Admin Only)
router.post('/funds/:userId', authorize('admin'), async (req, res) => {
        console.log('Backend req.body received:', req.body); // <--- ADD THIS LINE
        console.log('--- FUND UPDATE ROUTE: CODE IS RUNNING HERE ---'); // <--- ADD THIS LINE EXACTLY


    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
            return res.status(400).json({ msg: 'Invalid user ID format.' });
        }

        const { accountType, type: transactionType, amount, description } = req.body;       
         const userId = req.params.userId;

       /* if (!accountType || !transactionType || amount === undefined || !description) {
           return res.status(400).json({ msg: 'Account type, transaction type, amount, and description are required.' });
        
        }*/

        if (!['checking', 'savings'].includes(accountType)) {
            return res.status(400).json({ msg: 'Invalid account type. Must be "checking" or "savings".' });
        }
        if (!['credit', 'debit'].includes(transactionType)) {
            return res.status(400).json({ msg: 'Invalid transaction type. Must be "credit" or "debit".' });
        }
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ msg: 'Amount must be a positive number.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        let currentBalancePath;
        let accountNumberPath;

        if (accountType === 'checking') {
            currentBalancePath = 'checkingAccount.balance';
            accountNumberPath = 'checkingAccount.accountNumber';
        } else {
            currentBalancePath = 'savingsAccount.balance';
            accountNumberPath = 'savingsAccount.accountNumber';
        }

        let currentBalance = user.get(currentBalancePath);
        let newBalance = currentBalance;

        if (transactionType === 'credit') {
            newBalance += numericAmount;
        } else {
            if (currentBalance < numericAmount) {
                return res.status(400).json({ msg: `Insufficient funds in ${accountType} account. Current balance: ${currentBalance.toFixed(2)}` });
            }
            newBalance -= numericAmount;
        }

        user.set(currentBalancePath, newBalance);
        await user.save();

        const newTransaction = new Transaction({
            userId: user._id,
            type: transactionType === 'credit' ? 'deposit' : 'withdrawal',
            accountType: accountType,
            amount: numericAmount,
            currency: user[accountType + 'Account'].currency,
            description: ` ${transactionType} - ${description}`, // Frontend sends just description, this prepends admin context
            status: 'completed',
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            transactionId: `ADM-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        });
        await newTransaction.save();

        res.json({
            msg: `Funds successfully ${transactionType === 'credit' ? 'credited to' : 'debited from'} user's ${accountType} account.`,
            newBalance: newBalance,
            accountNumber: user.get(accountNumberPath),
            user: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                checkingAccount: user.checkingAccount,
                savingsAccount: user.savingsAccount,
            }
        });

    } catch (err) {
        console.error('[Admin Route] Error managing user funds:', err.message);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ msg: messages.join(', ') });
        }
        res.status(500).send('Server error during fund management.');
    }
});


// --- @route   POST /api/admin/mock-transactions/:userId ---
// @desc    Generate mock financial transactions for a user (distinct path)
// @access  Private (Admin Only)
router.post('/mock-transactions/:userId', authorize('admin'), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
            return res.status(400).json({ msg: 'Invalid user ID format.' });
        }

        const { mockStartDate, mockEndDate, numberOfMockTransactions } = req.body;
        const userId = req.params.userId;

        if (!mockStartDate || !mockEndDate) {
            return res.status(400).json({ msg: 'Start and end dates are required for mock transaction generation.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        const startDate = new Date(mockStartDate);
        const endDate = new Date(mockEndDate);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ msg: 'Invalid date format provided.' });
        }

        if (startDate > endDate) {
            return res.status(400).json({ msg: 'Start date cannot be after end date.' });
        }

        const transactionCount = parseInt(numberOfMockTransactions);
        const finalTransactionCount = (isNaN(transactionCount) || transactionCount <= 0) ? Math.floor(Math.random() * 50) + 1 : transactionCount;

        const mockTransactions = [];
        const transactionTypes = ['deposit', 'withdrawal', 'transfer'];
        const descriptions = [
            'Online Purchase', 'Grocery Store', 'Restaurant Bill', 'Salary Deposit',
            'Utility Bill Payment', 'Cash Withdrawal', 'Inter-bank Transfer',
            'Subscription Service', 'Loan Repayment', 'ATM Deposit', 'Bill Pay',
            'Service Fee', 'Refund', 'Payroll', 'Investment'
        ];
        const accountTypes = ['checking', 'savings'];

        for (let i = 0; i < finalTransactionCount; i++) {
            const randomDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
            const randomAmount = parseFloat((Math.random() * 5000 + 10).toFixed(2));
            const randomType = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
            const randomDescription = descriptions[Math.floor(Math.random() * descriptions.length)];
            const randomAccountType = accountTypes[Math.floor(Math.random() * accountTypes.length)];

            let currentBalance = user[`${randomAccountType}Account`].balance;
            let balanceAfter = currentBalance;

            // Adjust balance for mock transactions
            if (randomType === 'deposit') {
                balanceAfter += randomAmount;
            } else if (randomType === 'withdrawal' || randomType === 'transfer') {
                // Ensure balance doesn't go negative for mock withdrawals/transfers
                if (currentBalance >= randomAmount) {
                    balanceAfter -= randomAmount;
                } else {
                    // If insufficient funds, make it a deposit or skip this transaction for realism
                    // For simplicity here, we'll just not subtract if it would go negative.
                    // Or you could make it a 'failed' transaction status.
                    balanceAfter = currentBalance; // Keep balance same if withdrawal/transfer can't happen
                    // You might want to log this or adjust logic to make it a 'failed' transaction
                    console.warn(`Mock transaction: Insufficient funds for ${randomType} of ${randomAmount} in ${randomAccountType} for user ${user._id}. Skipping balance deduction.`);
                }
            }
            // Update user's balance in memory for subsequent mock transactions within the loop
            user[`${randomAccountType}Account`].balance = balanceAfter;

            mockTransactions.push({
                userId: user._id,
                type: randomType,
                accountType: randomAccountType,
                amount: randomAmount,
                currency: user[randomAccountType + 'Account'].currency,
                description: randomDescription,
                status: 'completed', // Or 'failed' based on balance deduction logic
                createdAt: randomDate,
                balanceBefore: currentBalance,
                balanceAfter: parseFloat(balanceAfter.toFixed(2)),
                transactionId: `MOCK-${Date.now()}-${i}-${Math.floor(Math.random() * 9999)}`
            });
        }

        // Save updated user balances and insert mock transactions in a transaction for atomicity
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            await Transaction.insertMany(mockTransactions, { session });
            await user.save({ session }); // Save the user with updated balances

            await session.commitTransaction();
            session.endSession();
        } catch (sessionError) {
            await session.abortTransaction();
            session.endSession();
            throw sessionError; // Re-throw to be caught by the outer catch block
        }

        res.status(201).json({
            msg: `${finalTransactionCount} mock transactions generated successfully for ${user.fullName}.`,
            generatedTransactions: mockTransactions.length,
            userBalances: {
                checking: user.checkingAccount.balance,
                savings: user.savingsAccount.balance
            }
        });

    } catch (err) {
        console.error('[Admin Route] Error generating mock transactions:', err.message);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ msg: messages.join(', ') });
        }
        res.status(500).send('Server error during mock transaction generation.');
    }
});


// --- @route   POST /api/admin/generate-card/:userId ---
// @desc    Generate a bank card (credit/debit) for a user
// @access  Private (Admin Only)
router.post('/generate-card/:userId', authorize('admin'), async (req, res) => {
    try {
        // Validate if the ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
            return res.status(400).json({ msg: 'Invalid user ID format.' });
        }

        const { cardType, cardDesign, linkedAccountId } = req.body; // Added linkedAccountId
        const userId = req.params.userId;

        if (!cardType || !['debit', 'credit'].includes(cardType)) {
            return res.status(400).json({ msg: 'Card type (debit or credit) is required and must be "debit" or "credit".' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        let actualLinkedAccountId = undefined; // Initialize for non-debit cards or if not found
        if (cardType === 'debit') {
            if (!linkedAccountId) {
                return res.status(400).json({ msg: 'For debit cards, a linked account ID (account number) is required in the request body.' });
            }
            if (user.checkingAccount && user.checkingAccount.accountNumber === linkedAccountId) {
                actualLinkedAccountId = user.checkingAccount.accountNumber;
            } else if (user.savingsAccount && user.savingsAccount.accountNumber === linkedAccountId) {
                actualLinkedAccountId = user.savingsAccount.accountNumber;
            } else {
                return res.status(400).json({ msg: `Linked account with number "${linkedAccountId}" not found for this user.` });
            }
        }


        // --- Use the more robust helper functions for card details ---
        const cardNumber = await generateLuhnValidCardNumber(); // Ensures uniqueness and Luhn validity
        const cvv = generateCVV(cardType === 'credit' ? 4 : 3); // 3 for debit, 4 for credit
        const expires = generateExpiryDate(); // MM/YY format (e.g., "07/29")
        const lastFourDigits = cardNumber.slice(-4); // Extract last 4 digits

        const newCard = {
            cardType: cardType,
            cardNumber: cardNumber,
            lastFourDigits: lastFourDigits,
            cardHolderName: user.fullName,
            expires: expires,
            cvv: cvv,
            status: 'active',
            design: cardDesign || 'standard',
            issuedAt: new Date(),
            linkedAccount: actualLinkedAccountId // Now correctly assigned
        };

        // Initialize cards array if it doesn't exist (though it's defined in schema, good defensive coding)
        if (!user.cards) {
            user.cards = [];
        }
        user.cards.push(newCard);
        await user.save(); // Save the user with the new embedded card

        res.status(201).json({
            msg: `${cardType} card generated successfully for ${user.fullName}.`,
            card: { // Return limited card details (don't send CVV back)
                id: newCard._id, // Mongoose adds an _id to embedded documents automatically on push/save
                cardType: newCard.cardType,
                cardNumber: newCard.cardNumber,
                lastFourDigits: newCard.lastFourDigits,
                cardHolderName: newCard.cardHolderName,
                expires: newCard.expires,
                design: newCard.design,
                status: newCard.status,
                issuedAt: newCard.issuedAt,
                linkedAccount: newCard.linkedAccount
            }
        });

    } catch (error) {
        console.error('Error generating card:', error);
        // Check for specific error types from generateLuhnValidCardNumber if it throws on non-unique retry exhaustion
        if (error.message.includes('Could not generate a unique card number')) {
            return res.status(500).json({ msg: error.message });
        }
        res.status(500).json({ msg: 'Server error while generating card.', error: error.message });
    }
});


module.exports = router;