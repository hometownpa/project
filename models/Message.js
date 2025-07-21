// models/Message.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    senderId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipientId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null // Can be null if it's a general announcement or support ticket
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    body: {
        type: String,
        required: true,
        trim: true
    },
    readByRecipient: {
        type: Boolean,
        default: false
    },
    // For support tickets:
    ticketStatus: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open'
    },
    category: {
        type: String,
        trim: true,
        default: 'General Inquiry'
    }
}, {
    timestamps: true // createdAt (when sent), updatedAt
});

messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ recipientId: 1, createdAt: -1 });
messageSchema.index({ ticketStatus: 1 });

module.exports = mongoose.model('Message', messageSchema);