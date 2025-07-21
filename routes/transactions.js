// routes/transactions.js (Revised for AccountSchema with _id: false and Transfer PIN)
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction'); // Your REVISED Transaction model
const authMiddleware = require('../middleware/auth');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For comparing the transfer PIN

// POST /api/transactions/transfer
router.post('/transfer', authMiddleware, async (req, res) => {
    const {
        fromAccountId, // This will now be the ACCOUNT NUMBER STRING (e.g., "1234567890")
        transferType,
        recipientName,
        recipientAccount,
        amount,
        memo,
        bankName,
        routingNumber,
        swiftCode,
        iban,
        transferPin // Add transferPin to the request body
    } = req.body;

    const userId = req.user.id;

    // --- 1. Server-side Validation ---
    if (!fromAccountId || !recipientName || !recipientAccount || !amount || amount <= 0 || !transferPin) {
        return res.status(400).json({ message: 'Missing required transfer fields, invalid amount, or transfer PIN.' });
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
        return res.status(400).json({ message: 'Transfer amount must be a positive number.' });
    }

    // Dynamic validation based on transfer type (same as before)
    if (['Bank to Bank', 'ACH', 'Domestic Wire'].includes(transferType)) {
        if (!bankName || !routingNumber) {
            return res.status(400).json({ message: 'Bank name and routing number are required for this transfer type.' });
        }
        if (!/^\d{9}$/.test(routingNumber)) {
            return res.status(400).json({ message: 'Invalid routing number format. Must be 9 digits.' });
        }
    } else if (['International Bank', 'Wire'].includes(transferType)) {
        if (!bankName || !swiftCode || !iban) {
            return res.status(400).json({ message: 'Bank name, SWIFT/BIC, and IBAN are required for international transfers.' });
        }
        if (!/^[A-Z0-9]{8,11}$/.test(swiftCode)) {
            return res.status(400).json({ message: 'Invalid SWIFT/BIC code format (8 or 11 alphanumeric characters).' });
        }
        if (iban.length < 15 || iban.length > 34) {
            return res.status(400).json({ message: 'Invalid IBAN length (typically 15-34 characters).' });
        }
    }

    let session;
    try {
        session = await mongoose.startSession();
        session.startTransaction();

        // --- 2. Find the User and Verify Transfer PIN ---
        // Populate the transferPin field to compare
        const user = await User.findById(userId).select('+transferPin').session(session); // Select the hashed pin

        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'User not found.' });
        }

        // Verify the provided transfer PIN
        const isMatch = await bcrypt.compare(transferPin, user.transferPin);
        if (!isMatch) {
            await session.abortTransaction();
            session.endSession();
            return res.status(401).json({ message: 'Invalid transfer PIN.' });
        }

        let sourceAccount = null;
        let accountPath = ''; // To dynamically construct the path for update
        let accountType = ''; // To store 'checking' or 'savings' for the transaction record

        if (user.checkingAccount && user.checkingAccount.accountNumber === fromAccountId) {
            sourceAccount = user.checkingAccount;
            accountPath = 'checkingAccount.balance';
            accountType = 'checking';
        } else if (user.savingsAccount && user.savingsAccount.accountNumber === fromAccountId) {
            sourceAccount = user.savingsAccount;
            accountPath = 'savingsAccount.balance';
            accountType = 'savings';
        }

        if (!sourceAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Source account not found or does not belong to user.' });
        }

        // --- 3. Check for Sufficient Funds ---
        if (sourceAccount.balance < transferAmount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Insufficient funds in the selected account.' });
        }

        // --- 4. Deduct Amount from Source Embedded Account ---
        const updateQuery = { $inc: {} };
        updateQuery.$inc[accountPath] = -transferAmount; // Deduct amount

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateQuery,
            { new: true, session: session }
        );

        if (!updatedUser) {
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({ message: 'Failed to update account balance.' });
        }

        // Determine the balance after this transaction for the source account
        let balanceAfterTransactionForSource = 0;
        if (updatedUser.checkingAccount && updatedUser.checkingAccount.accountNumber === fromAccountId) {
            balanceAfterTransactionForSource = updatedUser.checkingAccount.balance;
        } else if (updatedUser.savingsAccount && updatedUser.savingsAccount.accountNumber === fromAccountId) {
            balanceAfterTransactionForSource = updatedUser.savingsAccount.balance;
        }

        // --- 5. Create Transaction Record for Sender ---
        const newTransaction = new Transaction({
            userId: userId,
            type: 'transfer',
            amount: -transferAmount, // Store as negative for outgoing transfers
            currency: sourceAccount.currency || 'USD',
            status: 'processing', // Use 'processing' as per frontend expectation
            description: memo || `Transfer to ${recipientName}`,
            fromAccount: sourceAccount.accountNumber, // Store the source account number string
            toAccount: recipientAccount, // Store the recipient account number string (can be internal or external)
            accountType: accountType, // The type of the sender's account ('checking' or 'savings')

            // Populate external recipient details
            externalRecipientName: recipientName,
            externalRecipientBank: bankName,
            externalRoutingNumber: routingNumber,
            externalSwiftCode: swiftCode,
            externalIban: iban,

            balanceAfterTransaction: balanceAfterTransactionForSource
        });

        const savedTransaction = await newTransaction.save({ session });

        // --- 6. Handle Recipient Side (If internal transfer) ---
        const internalRecipientUser = await User.findOne({
            $or: [
                { 'checkingAccount.accountNumber': recipientAccount },
                { 'savingsAccount.accountNumber': recipientAccount }
            ]
        }).session(session);

        if (internalRecipientUser) {
            // It's an internal transfer within your system
            let recipientAccountPath = '';
            let recipientEmbeddedAccount = null;
            let recipientAccountType = ''; // To store 'checking' or 'savings' for recipient's transaction

            if (internalRecipientUser.checkingAccount && internalRecipientUser.checkingAccount.accountNumber === recipientAccount) {
                recipientEmbeddedAccount = internalRecipientUser.checkingAccount;
                recipientAccountPath = 'checkingAccount.balance';
                recipientAccountType = 'checking';
            } else if (internalRecipientUser.savingsAccount && internalRecipientUser.savingsAccount.accountNumber === recipientAccount) {
                recipientEmbeddedAccount = internalRecipientUser.savingsAccount;
                recipientAccountPath = 'savingsAccount.balance';
                recipientAccountType = 'savings';
            }

            if (recipientEmbeddedAccount) {
                // Atomically update recipient's balance
                const updateRecipientQuery = { $inc: {} };
                updateRecipientQuery.$inc[recipientAccountPath] = transferAmount; // Add amount

                const updatedRecipientUser = await User.findByIdAndUpdate(
                    internalRecipientUser._id,
                    updateRecipientQuery,
                    { new: true, session: session }
                );

                if (!updatedRecipientUser) {
                    throw new Error('Failed to update recipient account balance during internal transfer.');
                }

                // Determine balance after transaction for recipient
                let balanceAfterTransactionForRecipient = 0;
                if (updatedRecipientUser.checkingAccount && updatedRecipientUser.checkingAccount.accountNumber === recipientAccount) {
                    balanceAfterTransactionForRecipient = updatedRecipientUser.checkingAccount.balance;
                } else if (updatedRecipientUser.savingsAccount && updatedRecipientUser.savingsAccount.accountNumber === recipientAccount) {
                    balanceAfterTransactionForRecipient = updatedRecipientUser.savingsAccount.balance;
                }

                // Create a corresponding transaction for the recipient
                const recipientTransaction = new Transaction({
                    userId: internalRecipientUser._id,
                    type: 'transfer',
                    amount: transferAmount, // Positive for incoming
                    currency: recipientEmbeddedAccount.currency || 'USD',
                    status: 'completed', // Incoming internal transfers can be completed immediately
                    description: `Transfer from ${user.fullName} (${sourceAccount.accountNumber})`,
                    fromAccount: sourceAccount.accountNumber, // Sender's account number
                    toAccount: recipientEmbeddedAccount.accountNumber, // Recipient's account number
                    accountType: recipientAccountType, // The type of the recipient's account ('checking' or 'savings')
                    recipientUserId: user._id, // Link back to the sender user
                    balanceAfterTransaction: balanceAfterTransactionForRecipient
                });
                await recipientTransaction.save({ session });

                // Update the original sender's transaction status to 'completed' as well, if it's internal
                savedTransaction.status = 'completed';
                await savedTransaction.save({ session });
            } else {
                console.warn(`Internal transfer to ${recipientAccount} failed to find embedded account on recipient user ${internalRecipientUser._id}. Sender's transaction remains 'processing'.`);
                // If the recipient user was found but their specified account was not (e.g., malformed account number)
                // The sender's transaction status remains 'processing' as it couldn't be fully completed internally.
            }
        } else {
            // It's an external transfer (or an internal recipient account was not found)
            // The transaction status remains 'processing' until confirmed by an external system/manual review.
            console.log(`External transfer or internal recipient account not found. Sender's transaction remains 'processing'.`);
        }

        // --- 7. Commit Transaction ---
        await session.commitTransaction();
        session.endSession();

        // --- 8. Return Success Response ---
        res.status(200).json({
            message: 'Transfer initiated successfully! Your transfer is currently being processed.',
            transactionId: savedTransaction._id,
            status: savedTransaction.status, // Will be 'completed' if internal, 'processing' if external
            newBalance: balanceAfterTransactionForSource // Balance of the sender's account
        });

    } catch (error) {
        console.error('Error during transfer:', error);
        if (session) {
            await session.abortTransaction();
            session.endSession();
        }
        res.status(500).json({ message: 'An internal server error occurred during the transfer.', error: error.message });
    }
});

module.exports = router;