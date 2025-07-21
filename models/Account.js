// models/Account.js (FIXED VERSION)
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const accountSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    accountNumber: {
        type: String,
        required: true,
        unique: true, // KEEP THIS ONE - it handles the unique index
        trim: true
    },
    accountType: {
        type: String,
        enum: ['checking', 'savings', 'loan', 'credit_card', 'investment'],
        required: true
    },
    currentBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'closed', 'frozen'],
        default: 'active'
    },
    currency: {
        type: String,
        default: 'USD',
        trim: true
    },
    interestRate: { type: Number, default: 0 },
    openedDate: { type: Date, default: Date.now },
    closedDate: { type: Date }
}, {
    timestamps: true
});

// Keep this index for userId and accountType if you want unique account types per user
accountSchema.index({ userId: 1, accountType: 1 }, { unique: true });

// REMOVE THIS LINE: accountSchema.index({ accountNumber: 1 }, { unique: true });

module.exports = mongoose.model('Account', accountSchema);