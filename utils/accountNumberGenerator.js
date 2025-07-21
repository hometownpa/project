// utils/accountNumberGenerator.js

const User = require('../models/User'); // Adjust path if your User model is elsewhere

/**
 * Generates a unique 10-digit account number.
 * It checks against existing user accounts to ensure uniqueness.
 * @param {string} accountType - 'checking' or 'savings' (or any other type if needed)
 * @returns {string} - A unique 10-digit account number as a string.
 */
async function generateUniqueAccountNumber(accountType) {
    let accountNumber;
    let isUnique = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 10; // Prevent infinite loop in highly unlikely scenario

    while (!isUnique && attempts < MAX_ATTEMPTS) {
        // Generate a random 10-digit number.
        // Math.random() gives 0-0.999..., multiply by 9 billion to get 1-9 billion, add 1 billion to make it 10 digits
        accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();

        // Check if this account number already exists in any user's accounts array
        // We look for any user where an account in their 'accounts' array has this accountNumber
        const userWithAccount = await User.findOne({ "accounts.accountNumber": accountNumber });

        if (!userWithAccount) {
            isUnique = true; // Found a unique number
        }
        attempts++;
    }

    if (!isUnique) {
        // This is a rare edge case, but good to handle
        console.error(`Failed to generate a unique account number after ${MAX_ATTEMPTS} attempts.`);
        throw new Error('Could not generate a unique account number. Please try again.');
    }

    return accountNumber;
}

module.exports = {
    generateUniqueAccountNumber
};