// models/Admin.js
// This file defines the Mongoose schema and model for an Admin user.

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    email: { // Admins might also have an email
        type: String,
        required: false, // Or true, depending on your requirements
        unique: true,
        trim: true,
        lowercase: true,
        sparse: true // Allows null values for unique fields
    },
    password: {
        type: String,
        required: true
    },
    role: { // To define different levels of admin access if needed
        type: String,
        enum: ['superadmin', 'admin', 'moderator'], // Example roles
        default: 'admin'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save hook to hash the password before saving a new admin or updating their password
AdminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare entered password with hashed password in the database
AdminSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Export the Admin Mongoose model
module.exports = mongoose.model('Admin', AdminSchema);