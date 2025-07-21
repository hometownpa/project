const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');

// Define Embedded Account Schema
const AccountSchema = new Schema({
    type: {
        type: String,
        enum: ['checking', 'savings', 'loan', 'creditcard', 'other'], // Common account types
        required: true // Making type required for clarity and validation
    },
    accountNumber: { type: String, required: true, unique: true, trim: true },
    balance: { type: Number, required: true, default: 0 },
    currency: { type: String, default: 'USD' },
    accountStatus: { type: String, enum: ['active', 'suspended', 'pending', 'restricted', 'blocked', 'limited'], default: 'active' },
    openedDate: { type: Date, default: Date.now }
}, { _id: false }); // Set _id to false if you don't want an _id for embedded documents

// Define Embedded Card Schema (reflects structure from your new generate-card route)
const EmbeddedCardSchema = new Schema({
    cardType: { // e.g., 'debit', 'credit'
        type: String,
        enum: ['debit', 'credit'],
        required: true
    },
    cardNumber: {
        type: String,
        required: true,
        // Removed `unique: true` here for embedded documents, as it only enforces uniqueness
        // within the array of a single parent document, not globally across the collection.
        // Global uniqueness is handled by the `generateLuhnValidCardNumber` helper in admin.js.
    },
    lastFourDigits: {
        type: String, // Store last 4 digits for display
        required: true
    },
    cardHolderName: {
        type: String,
        required: true
    },
    expires: { // MM/YY format
        type: String,
        required: true,
        match: /^(0[1-9]|1[0-2])\/\d{2}$/
    },
    cvv: {
        type: String, // Storing as string
        required: true
    },
    status: { // e.g., 'active', 'inactive', 'blocked'
        type: String,
        enum: ['active', 'inactive', 'blocked', 'expired'], // Added 'expired' for comprehensive status
        default: 'active'
    },
    design: { // e.g., 'standard', 'premium', 'custom'
        type: String,
        default: 'standard'
    },
    issuedAt: {
        type: Date,
        default: Date.now
    },
    // For debit cards, link to the account number string
    linkedAccount: {
        type: String, // Stores the account number string (e.g., user.checkingAccount.accountNumber)
        required: function() { return this.cardType === 'debit'; } // Required only for debit cards
    }
}, { _id: true }); // Set _id to true if you want an _id for embedded documents in the array

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        select: false // Always hide password by default
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    profilePictureUrl: String,

    // --- ADDED: Routing Number ---
    routingNumber: {
        type: String,
        unique: true, // Routing number should be unique across users
        required: true, // Or set a default generator if it's always generated
        trim: true
    },

    // --- ADDED: Transfer PIN Field ---
    transferPin: {
        type: String,
        select: false, // CRUCIAL: Do not return by default queries
        default: null // Can be null if not set by the user yet
    },

    // Embedded Accounts
    checkingAccount: {
        type: AccountSchema,
        default: {} // Initialize as an empty object if no checking account
    },
    savingsAccount: {
        type: AccountSchema,
        default: {} // Initialize as an empty object if no savings account
    },
    // Embedded Cards
    cards: [EmbeddedCardSchema], // Array of embedded card objects

    // ... other user fields ...
    homeAddress: String,
    phone: String,
    gender: String,
    nationality: String,
    occupation: String,
    wireTransferLimit: { type: Number, default: 10000 },
    achTransferLimit: { type: Number, default: 5000 },

    // --- Account Status Field ---
    accountStatus: { // Added for the admin update user status endpoint
        type: String,
        enum: ['active', 'blocked', 'restricted', 'limited', 'suspended', 'pending'],
        default: 'active'
    },
    isVerified: { // For email/KYC verification status
        type: Boolean,
        default: false
    },
    kycStatus: { // KYC (Know Your Customer) status
        type: String,
        enum: ['pending', 'approved', 'processing', 'limit_exceeded','failed', 'completed', 'cancelled', 'rejected',],
        default: 'pending'
    },

    // --- 2FA Related Fields ---
    twoFactorEnabled: { // <--- ADD THIS FIELD
        type: Boolean,
        default: true // Set to true to enforce 2FA for all new users
    },
    twoFactorCode: {
        type: String,
        default: null
    },
    twoFactorCodeExpires: {
        type: Date,
        default: null
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

// Password and Transfer PIN hashing pre-save hook
userSchema.pre('save', async function(next) {
    // Hash password if it's new or modified
    console.log('[User Model Pre-Save] Checking if password is modified for user:', this.username);
    if (this.isModified('password')) {
        console.log('[User Model Pre-Save] Password IS modified. Initiating hashing...');
        try {
            // REMOVED: this.password = this.password.trim(); from here
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
            console.log('[User Model Pre-Save] Password successfully hashed. Storing hash (first 10 chars):', this.password.substring(0, 10));
        } catch (error) {
            console.error('[User Model Pre-Save] ERROR during password hashing:', error.message);
            return next(error);
        }
    } else {
        console.log('[User Model Pre-Save] Password NOT modified. Skipping hashing for this save.');
    }

    // Hash transferPin if it's modified and not null/empty
    console.log('[User Model Pre-Save] Checking if transferPin is modified for user:', this.username);
    if (this.isModified('transferPin') && this.transferPin) {
        console.log('[User Model Pre-Save] Transfer PIN IS modified. Initiating hashing...');
        try {
            const salt = await bcrypt.genSalt(10);
            this.transferPin = await bcrypt.hash(this.transferPin, salt);
            console.log('[User Model Pre-Save] Transfer PIN successfully hashed.');
        } catch (error) {
            console.error('[User Model Pre-Save] ERROR during transfer PIN hashing:', error.message);
            return next(error);
        }
    } else {
        console.log('[User Model Pre-Save] Transfer PIN NOT modified or is null. Skipping hashing.');
    }
    next(); // Proceed with saving
});

// Method to compare password
userSchema.methods.matchPassword = async function(enteredPassword) {
    console.log('[User Model MatchPassword] Attempting to match password for user:', this.username);

    // THESE ARE THE NEW CRUCIAL LOGS
    console.log('[User Model MatchPassword] RAW Entered Password (stringified):', JSON.stringify(enteredPassword));
    console.log('[User Model MatchPassword] RAW Stored Hashed Password (stringified):', JSON.stringify(this.password));

    console.log('[User Model MatchPassword] Entered Password (first 5 chars):', enteredPassword ? enteredPassword.substring(0, 5) : '[empty]');
    console.log('[User Model MatchPassword] Stored Hashed Password (first 10 chars):', this.password ? this.password.substring(0, 10) : '[NOT AVAILABLE / EMPTY]');

    // Add an explicit check if the stored password exists before comparing
    if (!this.password) {
        console.error('[User Model MatchPassword] ERROR: Stored hashed password is null or undefined for this user.');
        return false;
    }

    // THIS LINE IS CRUCIAL AND MUST BE PRESENT
    const isMatch = await bcrypt.compare(enteredPassword, this.password);
    console.log(`[User Model MatchPassword] bcrypt.compare result: ${isMatch}`); // This log was already there.
    return isMatch;
};


// Method to compare transfer PIN (remains the same)
userSchema.methods.matchTransferPin = async function(enteredPin) {
    // If no transferPin is set on the user, it can't match.
    // Ensure that `transferPin` is selected in the query when calling this method (e.g., .select('+transferPin'))
    if (!this.transferPin) {
        return false;
    }
    return await bcrypt.compare(enteredPin, this.transferPin);
};

// Ensure uniqueness of card numbers globally (manual check before saving)
// This is an additional safety check, but the generation logic in admin.js is primary.
userSchema.pre('validate', async function(next) {
    if (this.isModified('cards')) {
        const cardNumbers = new Set();
        for (const card of this.cards) {
            if (cardNumbers.has(card.cardNumber)) {
                // This would catch duplicates within a single user's cards array
                return next(new Error('Duplicate card number found for this user.'));
            }
            cardNumbers.add(card.cardNumber);

            // This next part is resource-intensive if done on every save,
            // and is already handled by `generateLuhnValidCardNumber` in `admin.js`.
            // Only uncomment if you absolutely need a server-side pre-save global check,
            // but it's best done at the point of generation.
            /*
            const existingCardHolder = await mongoose.model('User').findOne({
                'cards.cardNumber': card.cardNumber,
                _id: { $ne: this._id } // Exclude current user
            });
            if (existingCardHolder) {
                return next(new Error(`Card number ${card.cardNumber} already exists for another user.`));
            }
            */
        }
    }
    next();
});

module.exports = mongoose.model('User', userSchema);