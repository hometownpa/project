// server.js
console.log("SERVER.JS IS STARTING UP NOW!");

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

require('./utils/emailService'); // This line ensures emailService.js is loaded on server start

const app = express();
const PORT = process.env.PORT || 5000;


// --- Middleware ---

// CORS Configuration for Production
// VERY IMPORTANT: Replace 'https://hometownbankpa.netlify.app' with your actual Netlify domain
// You might also want to include your local development URL (e.g., http://localhost:5500) during development
const allowedOrigins = [
    'https://hometownbankpa.netlify.app', // REPLACE THIS with your actual Netlify URL (e.g., https://hometownbankpa.netlify.app)
    'http://localhost:5500', // For local development with Live Server
    'http://127.0.0.1:5500' // Another common local Live Server address
    // Add other frontend domains if your app grows (e.g., if you have another admin panel)
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, Postman, or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // Ensure all used methods are allowed
    credentials: true // Allow cookies, authorization headers
}));

app.use(express.json()); // For parsing application/json


// --- MongoDB Connection ---
const DB_URI = process.env.MONGODB_URI;

console.log('Attempting to connect to MongoDB with URI:', DB_URI ? '****** (URI hidden)' : 'URI is UNDEFINED. Check .env');

mongoose.connect(DB_URI, {})
    .then(() => {
        console.log('MongoDB connected successfully!');
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        // In a production environment, you might not want to exit immediately,
        // but rather log and try to recover or restart. For now, exit is fine.
        process.exit(1);
    });

// --- Import Middleware ---
const authMiddleware = require('./middleware/auth');
const adminAuthMiddleware = require('./middleware/adminAuthMiddleware');

// --- Import Routes ---
const authRoutes = require('./routes/auth');
const adminAuthRoutes = require('./routes/adminAuth');
const userRoutes = require('./routes/user');
const adminUserRoutes = require('./routes/admin/users'); // For admin user management
const adminGeneralRoutes = require('./routes/admin'); // For other general admin dashboard routes
const transactionRoutes = require('./routes/transactions'); // Make sure to include this route if you have it!

// --- API Routes ---

// 1. Authentication Routes (User and Admin Login)
app.use('/api/auth', authRoutes);
app.use('/api/auth', adminAuthRoutes);

// 2. Protected Admin Routes
app.use('/api/admin/users', adminAuthMiddleware, adminUserRoutes);
app.use('/api/admin', adminAuthMiddleware, adminGeneralRoutes); // General admin routes
app.use('/api/transactions', adminAuthMiddleware, transactionRoutes); // Example: if transactions are admin-managed


// 3. Protected User Routes (General Users)
app.use('/api/user', authMiddleware, userRoutes);


// --- Serve Static Frontend Files ---
// This assumes the 'public' folder contains ALL your frontend assets (including 'admin' subfolder)
// and that `server.js` is in the root of your `hometownbankpa` directory.
// If you implement the `client` restructuring as recommended, this path will change to:
// app.use(express.static(path.join(__dirname, 'client')));
// For now, let's assume `public` is the root for static content
app.use(express.static(path.join(__dirname, 'public')));


// --- Serve Uploaded Files (if applicable) ---
// Ensure this folder exists and is accessible. On some hosting platforms, persistent storage
// for uploads might require a different strategy (e.g., cloud storage like S3).
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// --- Frontend Routing (Specific HTML pages) ---
// These routes assume your HTML files are directly inside the 'public' folder or its 'admin' subfolder.
// If you restructure and serve from a 'client' folder, adjust `path.join(__dirname, 'client', ...)`
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/user-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user-dashboard.html'));
});

app.get('/cards.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cards.html'));
});

app.get('/customer-service.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'customer-service.html'));
});

app.get('/deposit.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'deposit.html'));
});

app.get('/transfer-form.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'transfer-form.html'));
});


// Admin specific HTML pages
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'admin-login.html'));
});

app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'admin-dashboard.html'));
});


// --- Catch-all for API routes not found ---
// This should come BEFORE your frontend wildcard route if you have one.
app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ message: 'API endpoint not found.' });
    }
    next();
});

// --- Catch-all for frontend routes (if using a SPA or single entry point) ---
// If you have a single `index.html` and use client-side routing, this would serve `index.html`
// for all non-API requests. For your multi-page app, this might not be strictly necessary
// if all HTML files are explicitly routed, but it's good for handling undefined paths.
// If not explicitly routed above, it will default to index.html
app.get('*', (req, res) => {
    // This will catch any request not handled by previous routes and serve index.html
    // Useful for client-side routing or just providing a fallback.
    // Ensure this doesn't conflict with your actual static files.
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error('Global Error Handler:', err.stack); // Log the full stack trace
    res.status(err.statusCode || 500).json({ // Use custom status code if available
        message: err.message || 'Something went wrong on the server.',
        error: process.env.NODE_ENV === 'production' ? {} : err.message // Don't send full error in production
    });
});


// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});