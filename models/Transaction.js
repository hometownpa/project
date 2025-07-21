const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model
        required: true
    },
    type: {
        type: String,
        enum: ['deposit', 'withdrawal', 'transfer', 'bill_payment', 'loan_repayment'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        // Removed `min: 0.01`. The amount field will store negative for outgoing, positive for incoming.
    },
    currency: {
        type: String,
        default: 'USD', // Or your primary currency
        trim: true
    },
    status: {
        type: String,
        // Added 'processing' to the enum
        enum: ['pending', 'approved', 'processing', 'limit_exceeded', 'failed', 'completed', 'cancelled', 'rejected',],
        default: 'pending',
        required: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    // Source/Destination for transfers
    // These will store account number strings from the user's embedded accounts or external accounts
    fromAccount: {
        type: String, // Can be checking, savings account number, or external source
        trim: true
    },
    toAccount: {
        type: String, // Can be checking, savings account number, or external destination
        trim: true
    },
    // If it's a transfer to another user within the system
    recipientUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    // For external transfers, details about the external bank/recipient
    externalRecipientName: { type: String, trim: true },
    externalRecipientBank: { type: String, trim: true }, // Can store bank name
    // Add specific fields for international/domestic details if you want more granularity
    externalRoutingNumber: { type: String, trim: true },
    externalSwiftCode: { type: String, trim: true },
    externalIban: { type: String, trim: true },

    // Balance after this transaction (optional, but useful for quick ledger queries)
    balanceAfterTransaction: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Index for faster lookup by user and date
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);