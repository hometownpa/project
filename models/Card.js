const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // This links the card to a specific user
        required: true,
        index: true // Add an index for faster lookups by user
    },
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account', // Link to the user's account (checking/savings)
        required: true,
        index: true // Add an index for faster lookups by account
    },
    cardType: { // e.g., 'Debit', 'Credit' (though typically debit for bank accounts)
        type: String,
        enum: ['Debit', 'Credit'], // Define allowed types
        default: 'Debit',
        required: true
    },
    cardNumber: {
        type: String,
        required: true,
        unique: true, // Card numbers should be unique
        // In a real application, you would encrypt this or only store a tokenized version.
        // For development, we might store a hash or just the last 4 digits.
        // For now, storing full number for simplicity, but acknowledge the security risk.
        // Consider storing only the last 4 and tokenizing the rest for real apps.
    },
    lastFourDigits: { // Useful for displaying masked card numbers
        type: String,
        required: true
    },
    expiryMonth: {
        type: String, // Stored as 'MM'
        required: true,
        match: /^(0[1-9]|1[0-2])$/ // Regex for valid month 01-12
    },
    expiryYear: {
        type: String, // Stored as 'YY' or 'YYYY'
        required: true,
        match: /^\d{2}$|^\d{4}$/ // Regex for 2 or 4 digit year
    },
    cvv: {
        type: String, // Stored as hashed/encrypted in real apps. For dev, simple string.
        required: true
    },
    cardHolderName: {
        type: String,
        required: true
    },
    status: { // e.g., 'active', 'inactive', 'blocked', 'requested'
        type: String,
        enum: ['active', 'inactive', 'blocked', 'requested'],
        default: 'active',
        required: true
    },
    issueDate: {
        type: Date,
        default: Date.now
    },
    // Optional: for physical card delivery
    deliveryAddress: {
        street: String,
        city: String,
        state: String,
        zip: String,
        country: String
    },
    // Timestamp for creation and last update
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware to update `updatedAt` field on save
CardSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Card', CardSchema);