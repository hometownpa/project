// public/admin/admin-script.js

document.addEventListener('DOMContentLoaded', () => {
    const adminLoginForm = document.querySelector('.admin-login-form');
    const adminUsernameInput = document.getElementById('adminUsername'); // This is the username input (was email)
    const adminPasswordInput = document.getElementById('adminPassword');
    const bankLogo = document.querySelector('.bank-logo img');

    // Optional: Add a subtle fade-in animation for the logo
    if (bankLogo) {
        bankLogo.style.opacity = 0;
        setTimeout(() => {
            bankLogo.style.transition = 'opacity 1s ease-out';
            bankLogo.style.opacity = 1;
        }, 100);
    }

    // Function to display messages (error/success)
    function displayMessage(message, type = 'error') {
        // Remove any existing message first
        const existingMessage = document.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;

        // Insert the message before the form
        adminLoginForm.insertBefore(messageDiv, adminLoginForm.firstChild);

        // Optionally, hide the message after a few seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000); // Message disappears after 5 seconds
    }

    // Handle form submission
    adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent the default browser form submission

        // Changed 'email' to 'username' here
        const username = adminUsernameInput.value.trim();
        const password = adminPasswordInput.value.trim();

        // Basic client-side validation - changed message
        if (!username || !password) {
            displayMessage('Please enter both username and password.');
            return;
        }

        const BACKEND_API_BASE_URL = 'http://localhost:5000'; // Replace with your deployed backend URL
        const ADMIN_LOGIN_ENDPOINT = `${BACKEND_API_BASE_URL}/api/auth/admin-login`;

        try {
            const response = await fetch(ADMIN_LOGIN_ENDPOINT, { // Use the admin endpoint
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Changed 'email' to 'username' in the body
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json(); // Parse the JSON response from the server

            if (response.ok) { // Check if the HTTP status code is 2xx (success)
                localStorage.setItem('adminToken', data.token); // Store the JWT token

                // --- ADDED THIS CRITICAL CONSOLE.LOG ---
                console.log('[Frontend admin-login.js] Token successfully saved to localStorage:', data.token);
                // --- END ADDED CONSOLE.LOG ---

                displayMessage('Login successful! Redirecting to dashboard...', 'success');

                setTimeout(() => {
                    window.location.href = '/admin/admin-dashboard.html';
                }, 1500); // Redirect after 1.5 seconds
            } else {
                // The backend now returns 'message' instead of 'msg'
                const errorMessage = data.message || 'Login failed. Please check your credentials.';
                displayMessage(errorMessage);
                console.error('Admin Login error:', errorMessage);
            }
        } catch (error) {
            console.error('Network error or server unreachable:', error);
            displayMessage('An error occurred. Please try again later. (Check server connection)');
        }
    });
});

// Add styles for the message div to your admin-style.css (if not already there):
/*
.message {
    padding: 12px 20px;
    margin-bottom: 20px;
    border-radius: 8px;
    font-size: 0.95rem;
    text-align: center;
    font-weight: 500;
}

.message.error {
    background-color: #fcebeb; // Light red
    color: #cc0000;           // Dark red
    border: 1px solid #e0b4b4;
}

.message.success {
    background-color: #ebf9eb; // Light green
    color: #008000;           // Dark green
    border: 1px solid #b4e0b4;
}
*/