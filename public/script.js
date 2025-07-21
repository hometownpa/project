// script.js

document.addEventListener('DOMContentLoaded', () => {
    // Select the login form and 2FA form elements
    const loginForm = document.getElementById('loginForm');
    const twoFactorForm = document.getElementById('twoFactorForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const twoFactorCodeInput = document.getElementById('twoFactorCode');
    const resendCodeBtn = document.getElementById('resendCodeBtn');
    const backToLoginBtn = document.getElementById('backToLoginBtn');

    // Message display area
    const messageDiv = document.getElementById('login-message');

    // Variable to store userId temporarily for 2FA verification
    let currentUserId = null;

    // >>> IMPORTANT ADDITION: Define your API Base URL <<<
    // This ensures your frontend knows where to find the backend API,
    // especially if your frontend is being served from a different port
    // (e.g., via Live Server) than your backend (e.g., port 5000).
    const API_BASE_URL = 'http://localhost:5000'; // Adjust this if your backend runs on a different port

    // Function to display messages
    function showMessage(message, type = 'error') {
        messageDiv.textContent = message;
        messageDiv.style.display = 'block';
        if (type === 'error') {
            messageDiv.style.backgroundColor = '#f8d7da';
            messageDiv.style.color = '#721c24';
            messageDiv.style.border = '1px solid #f5c6cb';
        } else if (type === 'success') {
            messageDiv.style.backgroundColor = '#d4edda';
            messageDiv.style.color = '#155724';
            messageDiv.style.border = '1px solid #c3e6cb';
        } else if (type === 'info') {
            messageDiv.style.backgroundColor = '#d1ecf1';
            messageDiv.style.color = '#0c5460';
            messageDiv.style.border = '1px solid #bee5eb';
        } else if (type === 'warning') { // Added warning type
            messageDiv.style.backgroundColor = '#fff3cd';
            messageDiv.style.color = '#856404';
            messageDiv.style.border = '1px solid #ffeeba';
        }
    }

    // Function to hide messages
    function hideMessage() {
        messageDiv.style.display = 'none';
        messageDiv.textContent = '';
    }

    // Function to switch between login and 2FA forms
    function showLoginForm() {
        loginForm.style.display = 'block';
        twoFactorForm.style.display = 'none';
        hideMessage();
        usernameInput.value = ''; // Clear inputs when switching back
        passwordInput.value = '';
        twoFactorCodeInput.value = '';
        currentUserId = null; // Clear stored user ID
    }

    function showTwoFactorForm() {
        loginForm.style.display = 'none';
        twoFactorForm.style.display = 'block';
        twoFactorCodeInput.focus(); // Focus on the 2FA input
        hideMessage(); // Clear any previous messages before showing new info
        showMessage('A verification code has been sent to your email. Please enter it below.', 'info');
    }

    // Add event listener for initial login form submission
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        hideMessage(); // Clear previous messages

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        // Basic client-side validation
        if (!username || !password) {
            showMessage('Please enter both username and password.');
            return;
        }

        try {
            // Send login request to the backend API
            // This endpoint handles regular user login (initiates 2FA)
            // and potentially direct admin login if the same form is used for both.
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, { // <--- UPDATED LINE
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Check if 2FA is required for the user
                if (data.requires2FA) {
                    currentUserId = data.userId; // Store userId for 2FA verification
                    showTwoFactorForm();
                    // Frontend will wait for 2FA input, no token or full user data expected yet.
                } else if (data.token && data.user) {
                    // This block is for scenarios where login is successful directly
                    // without 2FA (e.g., admin login if not using a separate route,
                    // or if 2FA is optional/bypassed for certain accounts on backend).
                    showMessage(data.message || 'Login successful!', 'success');
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('userRole', data.user.role);
                    localStorage.setItem('userId', data.user.id);
                    localStorage.setItem('username', data.user.username);
                    localStorage.setItem('fullName', data.user.fullName);

                    // Redirect based on the user's role
                    if (data.user.role === 'admin') {
                        window.location.href = '/admin-dashboard.html';
                    } else {
                        window.location.href = '/user-dashboard.html';
                    }
                } else {
                    // Unexpected successful response: neither 2FA required nor token/user provided.
                    showMessage(data.message || 'Login successful, but response was unexpected. Please contact support.', 'warning');
                    console.warn('Unexpected successful login response:', data);
                }
            } else {
                // Login failed (e.g., invalid credentials, server error, admin trying regular user login)
                showMessage(data.message || 'Login failed. Please try again.');
                console.error('Login error:', data.message);

                // Optional: If the error message suggests using admin login, provide a hint
                if (data.message && data.message.includes('admin login portal')) {
                    // You could add a button or link to the admin login page here
                    // For example: messageDiv.innerHTML += '<p><a href="/admin-login.html">Go to Admin Login</a></p>';
                }
            }
        } catch (error) {
            // Network error or other unexpected issues
            console.error('Fetch error:', error);
            showMessage('An error occurred. Please try again later.');
        }
    });

    // Add event listener for 2FA form submission
    twoFactorForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        hideMessage(); // Clear previous messages

        const code = twoFactorCodeInput.value.trim();

        if (!code) {
            showMessage('Please enter the 2FA code.');
            return;
        }

        if (!currentUserId) {
            showMessage('Session expired. Please log in again.', 'error');
            showLoginForm(); // Go back to login form if no userId
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/verify-2fa`, { // <--- UPDATED LINE
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: currentUserId, code }),
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(data.message || 'Verification successful!', 'success');
                localStorage.setItem('token', data.token);
                localStorage.setItem('userRole', data.user.role);
                localStorage.setItem('userId', data.user.id);
                localStorage.setItem('username', data.user.username);
                localStorage.setItem('fullName', data.user.fullName);

                // Redirect to user dashboard after successful 2FA
                window.location.href = '/user-dashboard.html';
                // Note: If you have admin 2FA, you might need to check role here
                // if (data.user.role === 'admin') { window.location.href = '/admin-dashboard.html'; }
                // else { window.location.href = '/user-dashboard.html'; }
            } else {
                showMessage(data.message || '2FA code verification failed. Please try again.');
                console.error('2FA verification error:', data.message);
            }
        } catch (error) {
            console.error('Fetch error during 2FA verification:', error);
            showMessage('An error occurred during 2FA verification. Please try again later.');
        }
    });

    // Event listener for Resend Code button
    resendCodeBtn.addEventListener('click', async () => {
        if (!currentUserId) {
            showMessage('Please log in first to resend code.', 'error');
            showLoginForm();
            return;
        }
        showMessage('Resending code...', 'info');

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/resend-2fa-code`, { // <--- UPDATED LINE
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: currentUserId }),
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(data.message || 'A new code has been sent to your email.', 'success');
            } else {
                showMessage(data.message || 'Failed to resend code. Please try again.');
                console.error('Resend 2FA error:', data.message);
            }
        } catch (error) {
            console.error('Fetch error during resend 2FA:', error);
            showMessage('An error occurred while trying to resend the code. Please try again later.');
        }
    });

    // Event listener for Back to Login button
    backToLoginBtn.addEventListener('click', showLoginForm);
});