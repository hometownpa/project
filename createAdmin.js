// createAdmin.js

require('dotenv').config();
const mongoose = require('mongoose');
// Correct: Require the Admin model, assuming its file path is correct relative to createAdmin.js
const Admin = require('./models/Admin'); // <--- IMPORTANT CHANGE HERE! Adjust path if needed

// Configuration for your NEW admin user
const adminUsername = 'AdminBobo'; // <--- CHANGE THIS to your desired new username
const adminEmail = 'hometownbankpa@gmail.com'; // <--- CHANGE THIS to your desired new email
const adminPassword = 'Boboskie1229'; // <--- CHANGE THIS to a STRONG password for the new user!

async function createAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            // useNewUrlParser: true, // No longer needed in Mongoose 6+
            // useUnifiedTopology: true, // No longer needed in Mongoose 6+
        });
        console.log('MongoDB Connected to:', process.env.MONGODB_URI.split('@')[1].split('/')[1]);

        // Check if this NEW admin user already exists using the Admin model
        let adminUser = await Admin.findOne({ username: adminUsername.toLowerCase() }); // <--- IMPORTANT: Use Admin here

        if (adminUser) {
            // If an admin with this username exists, it will UPDATE it
            adminUser.password = adminPassword; // Assign PLAINTEXT here - pre-save hook in Admin model will hash it
            adminUser.email = adminEmail.toLowerCase();
            adminUser.role = 'admin'; // Ensure role is admin
            adminUser.fullName = 'New Administrator Name'; // <--- Set full name for new admin
            await adminUser.save();
            console.log(`Admin user '${adminUsername}' found. Password and details UPDATED successfully in 'admins' collection!`);
        } else {
            // Otherwise, CREATE a new admin user using the Admin model
            const newAdmin = new Admin({ // <--- IMPORTANT: Use Admin here
                username: adminUsername.toLowerCase(),
                email: adminEmail.toLowerCase(),
                password: adminPassword, // Assign PLAINTEXT here - pre-save hook in Admin model will hash it
                role: 'admin',
                fullName: 'New Administrator Name' // <--- Set full name for new admin
            });
            await newAdmin.save();
            console.log(`Admin user '${adminUsername}' CREATED successfully in 'admins' collection!`);
        }

    } catch (error) {
        console.error('Error creating/updating admin user:', error);
    } finally {
        mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
}

createAdmin();