document.addEventListener('DOMContentLoaded', async () => {
    // --- Global Variables ---
    const adminToken = localStorage.getItem('adminToken');
    const BACKEND_API_BASE_URL = 'http://localhost:5000'; // Adjust if your backend is elsewhere
    let currentLoggedInAdmin = null; // To store admin user info

    // --- Dashboard Sections ---
    const dashboardSections = document.querySelectorAll('.dashboard-section');

    // Sidebar and Navigation
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const navLinks = document.querySelectorAll('.sidebar-nav a[data-section]');
    const logoutLink = document.querySelector('.logout-link');

    // User Search/Filter controls (for main User Management table)
    const userSearchInput = document.getElementById('userSearchInput');
    const searchUsersBtn = document.getElementById('searchUsersBtn');
    const refreshUsersBtn = document.getElementById('refreshUsersBtn');
    const usersTableBody = document.getElementById('usersTableBody');

    // --- Modals and General Modal Controls ---
    const editUserModal = document.getElementById('editUserModal');
    const editTransactionModal = document.getElementById('editTransactionModal');
    const closeButtons = document.querySelectorAll('.modal .close-button');
    const modals = document.querySelectorAll('.modal');

    // --- User Management Elements (for Edit User Modal) ---
    const editUserForm = document.getElementById('editUserForm');
    const editUserIdInput = document.getElementById('editUserId');
    const editUsernameInput = document.getElementById('editUsername');
    const editFullNameInput = document.getElementById('editFullName');
    const editEmailInput = document.getElementById('editEmail');
    const editPhoneNumberInput = document.getElementById('editPhoneNumber');
    const editAddressInput = document.getElementById('editAddress');
    const editCheckingBalanceInput = document.getElementById('editCheckingBalance');
    const editSavingsBalanceInput = document.getElementById('editSavingsBalance');
    const editCheckingAccountNumberInput = document.getElementById('editCheckingAccountNumber');
    const editSavingsAccountNumberInput = document.getElementById('editSavingsAccountNumber');
    const editAccountStatusSelect = document.getElementById('editAccountStatus');
    const editIsVerifiedCheckbox = document.getElementById('editIsVerified');
    // const saveUserBtn = document.getElementById('saveUserBtn'); // Confirm if you need this
    const deleteUserBtn = document.getElementById('deleteUserBtn'); // Confirm if you need this

    // --- Fund Management Elements ---
    let currentFundManagementUser = null;
    const fundRecipientIdentifierInput = document.getElementById('fundRecipientIdentifier');
    const findUserForFundsBtn = document.getElementById('findUserForFundsBtn');
    const fundUserDetailsDiv = document.getElementById('fundUserDetails');
    const manageFundsForm = document.getElementById('manageFundsForm');
    const fundAccountTypeSelect = document.getElementById('fundAccountType');
    const fundTransactionTypeSelect = document.getElementById('fundTransactionType');
    const fundAmountInput = document.getElementById('fundAmount');
    const fundDescriptionInput = document.getElementById('fundDescription');
    const processTransactionBtn = manageFundsForm.querySelector('button[type="submit"]');
    const selectedFundUserIdInput = document.getElementById('selectedFundUserId');

    // --- User Status Management Elements ---
    let currentStatusManagementUser = null;
    const statusUserIdOrEmailInput = document.getElementById('statusUserIdOrEmail'); // Based on your provided code
    const lookupStatusUserBtn = document.getElementById('lookupStatusUserBtn'); // Based on your provided code
    const statusUserDetailsDiv = document.getElementById('statusUserDetails'); // Based on your provided code
    const selectedStatusUserIdInput = document.getElementById('selectedStatusUserId'); // Based on your provided code
    const manageStatusForm = document.getElementById('manageStatusForm'); // Based on your provided code
    const newAccountStatusSelect = document.getElementById('newAccountStatus'); // Corrected to match your HTML ID
    const statusEmailNotificationMessageInput = document.getElementById('statusEmailNotificationMessage'); // Corrected to match your HTML ID
    const sendStatusEmailNotificationCheckbox = document.getElementById('sendStatusEmailNotification'); // Corrected to match your HTML ID
    const submitStatusChangeBtn = manageStatusForm.querySelector('button[type="submit"]'); // Relies on manageStatusForm being defined above

    // --- Transaction Management Elements ---
    const transactionsTableBody = document.getElementById('transactionsTableBody');
    const editTransactionForm = document.getElementById('editTransactionForm');
    const editTransactionIdInput = document.getElementById('editTransactionId');
    const editTransactionUserIdInput = document.getElementById('editTransactionUserId');
    const editTransactionAccountTypeSelect = document.getElementById('editTransactionAccountType');
    const editTransactionTypeSelect = document.getElementById('editTransactionType');
    const editTransactionAmountInput = document.getElementById('editTransactionAmount');
    const editTransactionStatusSelect = document.getElementById('editTransactionStatus');
    const editTransactionDateInput = document.getElementById('editTransactionDate');
    const updateTransactionBtn = document.getElementById('updateTransactionBtn'); // This is critical for the other issue!
    const deleteTransactionBtn = document.getElementById('deleteTransactionBtn');

    // Bank Card Management Elements
    let currentCardManagementUser = null;
    const generateCardSection = document.getElementById('generateCardSection');
    const userLookupIdentifierInput = document.getElementById('userLookupIdentifier');
    console.log('Value of userLookupIdentifierInput:', userLookupIdentifierInput); // Add this line!
    const lookupUserForCardBtn = document.getElementById('lookupUserForCardBtn');
    const cardManagementUserDetailsDiv = document.getElementById('cardManagementUserDetails');
    const cardUserNameSpan = document.getElementById('cardUserName');
    const cardUserEmailSpan = document.getElementById('cardUserEmail');
    const cardUserIdSpan = document.getElementById('cardUserId');
    const cardUserExistingCardsSpan = document.getElementById('cardUserExistingCards');
    const selectedCardUserIdInput = document.getElementById('selectedCardUserId');
    const generateCardForm = document.getElementById('generateCardForm');
    const newCardTypeSelect = document.getElementById('newCardType');
    const linkedAccountGroup = document.getElementById('linkedAccountGroup');
    const linkedAccountIdInput = document.getElementById('linkedAccountIdInput');
    const newCardDesignInput = document.getElementById('newCardDesign');
    const generateBankCardBtn = document.getElementById('generateBankCardBtn');
    const cardGenerationStatusDiv = document.getElementById('cardGenerationStatus');


    // --- PIN Management Elements ---
    let currentPinManagementUser = null;
    const pinUserIdOrEmailInput = document.getElementById('pinUserIdOrEmailInput');
    const lookupPinUserBtn = document.getElementById('lookupPinUserBtn');
    const pinUserDetailsDiv = document.getElementById('pinUserDetails');
    const selectedPinUserId = document.getElementById('selectedPinUserId');
    const setTransferPinForm = document.getElementById('setTransferPinForm');
    const newTransferPinInput = document.getElementById('newTransferPinInput');
    const confirmTransferPinInput = document.getElementById('confirmTransferPinInput');
    const clearPinBtn = document.getElementById('clearPinBtn');

    // --- Create User Form elements (Need to be defined here if they are only used in event listeners) ---
    // I noticed `createUserForm` was used in an event listener but not declared as a const.
    // Assuming it exists in your HTML, declare it here:
    const createUserForm = document.getElementById('createUserForm'); // Make sure your HTML has an id="createUserForm"


    // --- Initial Authentication Check ---
    if (!adminToken) {
        alert('You must be logged in to access the admin dashboard.');
        window.location.href = 'admin-login.html';
        return;
    }

    // --- Helper Functions ---

    // Function to check response status and handle 401/403
    async function handleAuthError(response) {
        if (response.status === 401 || response.status === 403) {
            alert('Session expired or unauthorized. Please log in again.');
            localStorage.removeItem('adminToken');
            window.location.href = 'admin-login.html';
            return true;
        }
        return false;
    }

    // Function to fetch and display admin profile
    async function fetchAdminProfile() {
        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/admin/profile`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });

            if (await handleAuthError(response)) return;

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.msg || 'Failed to fetch admin profile.');
            }

            const admin = await response.json();
            document.getElementById('adminName').textContent = admin.username;
        } catch (error) {
            console.error('Error fetching admin profile:', error);
            alert(`Error fetching admin profile: ${error.message}`);
        }
    }

    // Function to fetch and display users
    async function fetchAndDisplayUsers(searchTerm = '') {
        try {
            const url = searchTerm ? `${BACKEND_API_BASE_URL}/api/admin/users/search?q=${encodeURIComponent(searchTerm)}` : `${BACKEND_API_BASE_URL}/api/admin/users`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });

            if (await handleAuthError(response)) return;

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.msg || 'Failed to fetch users.');
            }

            const users = await response.json();
            usersTableBody.innerHTML = ''; // Clear existing table rows

            if (users.length === 0) {
                usersTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No users found.</td></tr>';
                return;
            }

            users.forEach(user => {
                const row = usersTableBody.insertRow();
                row.innerHTML = `
                    <td>${user.fullName || 'N/A'}</td>  <td>${user.email || 'N/A'}</td>      <td>${user.phone || 'N/A'}</td>      <td>${user.homeAddress || 'N/A'}</td><td>${user.checkingAccount && user.checkingAccount.accountNumber ? user.checkingAccount.accountNumber : 'N/A'}</td> <td>${user.savingsAccount && user.savingsAccount.accountNumber ? user.savingsAccount.accountNumber : 'N/A'}</td>   <td>${user.accountStatus || (user.isVerified ? 'Verified' : 'Pending')}</td> <td>
                        <button class="btn btn-sm btn-info edit-user-btn" data-id="${user._id}">Edit</button>
                        <button class="btn btn-sm btn-danger delete-user-btn" data-id="${user._id}">Delete</button>
                    </td>
                `;
            });

            // Add event listeners to new edit buttons
            document.querySelectorAll('.edit-user-btn').forEach(button => {
                button.addEventListener('click', (e) => editUser(e.target.dataset.id));
            });
            // If you also have delete buttons, you'd need to re-attach listeners for them here too,
            // or use event delegation on 'usersTableBody'.

        } catch (error) {
            console.error('Error fetching users:', error);
            alert(`Error fetching users: ${error.message}`);
        }
    }

    // Function to edit a user
    async function editUser(userId) {
        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/admin/users/${userId}`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });

            if (await handleAuthError(response)) return;

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.msg || 'Failed to fetch user details.');
            }

            const user = await response.json();

            // Populate the modal fields based on the HTML you provided
            editUserIdInput.value = user._id;
            editUsernameInput.value = user.username || '';
            editFullNameInput.value = user.fullName || '';
            editEmailInput.value = user.email;
            editPhoneNumberInput.value = user.phone || '';
            editAddressInput.value = user.homeAddress || '';
            editCheckingAccountNumberInput.value = user.checkingAccount?.accountNumber || '';
            editCheckingBalanceInput.value = user.checkingAccount?.balance || 0;
            editSavingsAccountNumberInput.value = user.savingsAccount?.accountNumber || '';
            editSavingsBalanceInput.value = user.savingsAccount?.balance || 0;
            editAccountStatusSelect.value = user.accountStatus || 'Active';
            editIsVerifiedCheckbox.checked = user.isVerified;

            // Hide the loading message if it's there
            const loadingMessageRow = document.querySelector('#usersTableBody .loading-message');
            if (loadingMessageRow) {
                loadingMessageRow.style.display = 'none';
            }

            editUserModal.style.display = 'block'; // Show the modal

        } catch (error) {
            console.error('Error loading user for edit:', error);
            alert(`Error loading user for edit: ${error.message}`);
        }
    }

    // Function to fetch and display transactions
    async function fetchAndDisplayTransactions() {
        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/admin/transactions`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });

            if (await handleAuthError(response)) return;

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.msg || 'Failed to fetch transactions.');
            }

            const transactions = await response.json();
            transactionsTableBody.innerHTML = ''; // Clear existing table rows

            if (transactions.length === 0) {
                transactionsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No transactions found.</td></tr>';
                return;
            }

            transactions.forEach(transaction => {
                const row = transactionsTableBody.insertRow();

                // Format date for display using 'createdAt' (from your timestamps: true)
                const date = new Date(transaction.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });

                // --- REFINED LOGIC FOR 'Account' COLUMN ---
                let displayAccount = 'N/A';
                if (transaction.userId) {
                    if (transaction.type === 'deposit' || transaction.type === 'withdrawal' || transaction.type === 'loan_repayment') {
                        // For deposits, withdrawals, loan repayments, prioritize transaction-specific accounts, then user's own accounts
                        if (transaction.toAccount) { // If there's a specific destination account in the transaction
                            displayAccount = `To: ${transaction.toAccount}`;
                        } else if (transaction.fromAccount) { // If there's a specific source account in the transaction
                            displayAccount = `From: ${transaction.fromAccount}`;
                        } else if (transaction.userId.checkingAccount && transaction.userId.checkingAccount.accountNumber) {
                            // If no specific transaction account, use user's checking account as default
                            displayAccount = `Checking: ${transaction.userId.checkingAccount.accountNumber}`;
                        } else if (transaction.userId.savingsAccount && transaction.userId.savingsAccount.accountNumber) {
                            // Or user's savings account if checking is not available
                            displayAccount = `Savings: ${transaction.userId.savingsAccount.accountNumber}`;
                        } else {
                            displayAccount = transaction.type; // Fallback to type if no account number found
                        }
                    } else if (transaction.type === 'transfer') {
                        // For transfers, show both from/to accounts if available on the transaction
                        displayAccount = `${transaction.fromAccount || 'N/A'} -> ${transaction.toAccount || 'N/A'}`;
                    } else {
                        displayAccount = transaction.type; // Default for other transaction types
                    }
                } else {
                    displayAccount = transaction.type || 'N/A'; // Fallback if userId isn't populated for some reason
                }
                // --- END REFINED LOGIC ---

                row.innerHTML = `
                    <td>${transaction.userId ? transaction.userId.fullName : 'N/A'} (${transaction.userId ? transaction.userId.email : 'N/A'})</td>
                    <td>${displayAccount}</td>
                    <td>${transaction.amount.toFixed(2)}</td>
                    <td>${transaction.currency}</td>
                    <td>${transaction.description || 'N/A'}</td>
                    <td>${transaction.status}</td>
                    <td>${date}</td>
                    <td>
                        <button class="btn btn-sm btn-info edit-transaction-btn" data-id="${transaction._id}">Edit</button>
                    </td>
                `;
            });

            document.querySelectorAll('.edit-transaction-btn').forEach(button => {
                button.addEventListener('click', (e) => editTransaction(e.target.dataset.id));
            });

        } catch (error) {
            console.error('Error fetching transactions:', error);
            alert(`Error fetching transactions: ${error.message}`);
        }
    }

    // Function to edit a transaction
    async function editTransaction(transactionId) {
        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/admin/transactions/${transactionId}`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });

            if (await handleAuthError(response)) return;

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.msg || 'Failed to fetch transaction details.');
            }

            const transaction = await response.json();

            // --- Populate the HIDDEN input fields (for form submission) ---
            document.getElementById('updateTransactionId').value = transaction._id;
            document.getElementById('updateTransactionUserId').value = transaction.userId ? transaction.userId._id : ''; // Store just the ID
            document.getElementById('updateTransactionEmail').value = transaction.userId ? transaction.userId.email : ''; // Store user email for potential use
            document.getElementById('updateTransactionAmount').value = transaction.amount;
            document.getElementById('updateTransactionAccountType').value = transaction.accountType;
            document.getElementById('updateTransactionCurrency').value = transaction.currency;


            // --- Populate the VISIBLE display spans in the modal ---
            document.getElementById('displayUpdateTransactionId').textContent = transaction._id;
            document.getElementById('displayUpdateFullName').textContent = transaction.userId ? transaction.userId.fullName : 'N/A';
            document.getElementById('displayUpdateEmail').textContent = transaction.userId ? transaction.userId.email : 'N/A';
            document.getElementById('displayUpdateAmount').textContent = transaction.amount.toFixed(2);
            document.getElementById('displayUpdateCurrency').textContent = transaction.currency;
            document.getElementById('displayUpdateDescription').textContent = transaction.description || 'N/A';
            document.getElementById('displayUpdateCurrentStatus').textContent = transaction.status;


            // Populate the select dropdown for new status
            document.getElementById('newTransactionStatus').value = transaction.status; // Set initial value to current status

            // If you have a separate edit form (as per your initial element declarations)
            // ensure you're using the correct modal elements for display
            // Based on your HTML, 'transactionUpdateModal' is the one we're populating.
            // Assuming editTransactionModal refers to transactionUpdateModal from your HTML.
            const transactionUpdateModal = document.getElementById('transactionUpdateModal');
            if (transactionUpdateModal) {
                transactionUpdateModal.style.display = 'block';
            } else {
                console.error("Error: transactionUpdateModal element not found!");
            }


        } catch (error) {
            console.error('Error loading transaction for edit:', error);
            alert(`Error loading transaction for edit: ${error.message}`);
        }
    }


    async function findUserForFunds() {
        const query = fundRecipientIdentifierInput.value.trim();
        if (!query) {
            alert('Please enter a User ID or Email to search for funds.');
            return;
        }

        fundUserDetailsDiv.innerHTML = '<p>Searching for user...</p>';
        disableFundTransactionForm(); // Disable the form elements while searching

        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/admin/find-user?identifier=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });

            if (await handleAuthError(response)) {
                fundUserDetailsDiv.innerHTML = '<p style="color: red;">Authentication error. Please log in again.</p>';
                return;
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.msg || 'User not found.');
            }

            const { user } = await response.json();
            currentFundManagementUser = user;
            console.log("User object received and being used for display:", user);

            fundUserDetailsDiv.innerHTML = `
                <p><strong>Name:</strong> ${user.fullName || user.username}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>User ID:</strong> ${user._id}</p>
                <p><strong>Checking Account:</strong> ${user.checkingAccount?.accountNumber || 'N/A'} (Balance: $${(user.checkingAccount?.balance || 0).toFixed(2)})</p>
                <p><strong>Savings Account:</strong> ${user.savingsAccount?.accountNumber || 'N/A'} (Balance: $${(user.savingsAccount?.balance || 0).toFixed(2)})</p>
                <p><strong>Routing Number:</strong> ${user.routingNumber || 'N/A'}</p>
            `;
            if (selectedFundUserIdInput) {
                selectedFundUserIdInput.value = user._id;
            }


            enableFundTransactionForm(); // Enable the form elements after successful lookup

        } catch (error) {
            console.error('Error finding user for funds:', error);
            alert(`Error finding user: ${error.message}`);
            fundUserDetailsDiv.innerHTML = '<p class="text-danger">User not found or an error occurred.</p>';
            currentFundManagementUser = null;
            if (selectedFundUserIdInput) {
                selectedFundUserIdInput.value = '';
            }
            manageFundsForm.reset(); // Reset the form fields
            disableFundTransactionForm(); // Disable the form elements
        }
    }

    function disableFundTransactionForm() {
        fundAccountTypeSelect.disabled = true;
        fundTransactionTypeSelect.disabled = true;
        fundAmountInput.disabled = true;
        fundDescriptionInput.disabled = true;
        processTransactionBtn.disabled = true;

        fundAccountTypeSelect.value = '';
        fundTransactionTypeSelect.value = '';
        fundAmountInput.value = '';
        fundDescriptionInput.value = '';
        fundUserDetailsDiv.innerHTML = '<p>Search for a user to manage their funds.</p>';
        currentFundManagementUser = null;
    }

    function enableFundTransactionForm() {
        fundAccountTypeSelect.disabled = false;
        fundTransactionTypeSelect.disabled = false;
        fundAmountInput.disabled = false;
        fundDescriptionInput.disabled = false;
        processTransactionBtn.disabled = false;
    }

    // Function to find user for Status Management section
async function findUserForStatus() {
    const query = statusUserIdOrEmailInput.value.trim(); // Assuming this is your search input field
    if (!query) {
        alert('Please enter a User ID or Email to search for status.');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/api/admin/users/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        if (await handleAuthError(response)) return;

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'User not found.');
        }

        const user = await response.json();
        currentStatusManagementUser = user;

        const statusColor = user.accountStatus === 'Active' ? 'text-success' : 'text-danger';

        // --- CORRECTED LINES BELOW ---
        // Use user._id as sent by backend, as per your other functions
        statusUserDetailsDiv.innerHTML = `
            <p><strong>Name:</strong> ${user.fullName || user.username}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>User ID:</strong> ${user._id}</p>
            <p><strong>Checking Account:</strong> ${user.checkingAccount ? user.checkingAccount.accountNumber : 'N/A'}</p>
            <p><strong>Savings Account:</strong> ${user.savingsAccount ? user.savingsAccount.accountNumber : 'N/A'}</p>
            <p><strong>Current Status:</strong> <span class="${statusColor}">${user.accountStatus}</span></p>
        `;
        selectedStatusUserIdInput.value = user._id; // <--- This is the crucial line for the PUT request
        // --- END CORRECTED LINES ---

        // Assuming these are the correct variable names for your select/input fields
        accountStatusSelect.value = user.accountStatus; // Pre-select current status (used in the form submit)

        // Enable the form elements
        accountStatusSelect.disabled = false; // The select for changing status
        statusNotificationMessage.disabled = false; // The input for the notification message
        sendStatusEmailCheckbox.disabled = false; // The checkbox for sending email
        submitStatusChangeBtn.disabled = false; // The submit button

    } catch (error) {
        console.error('Error finding user for status:', error);
        alert(`Error finding user: ${error.message}`);
        statusUserDetailsDiv.innerHTML = '<p class="text-danger">User not found or an error occurred.</p>';
        currentStatusManagementUser = null;
        selectedStatusUserIdInput.value = ''; // Clear the hidden input on error
        manageStatusForm.reset(); // Reset the form fields
        // Disable the form elements on error
        accountStatusSelect.disabled = true;
        statusNotificationMessage.disabled = true;
        sendStatusEmailCheckbox.disabled = true;
        submitStatusChangeBtn.disabled = true;
    }
}


    // --- Function to Find User for Card Generation section ---
    async function findUserForCard() {
        const query = userLookupIdentifierInput.value.trim();
        if (!query) {
            alert('Please enter a User ID or Email to search for card management.');
            return;
        }

        // Reset UI before new lookup
        cardManagementUserDetailsDiv.style.display = 'none';
        cardUserNameSpan.textContent = '';
        cardUserEmailSpan.textContent = '';
        cardUserIdSpan.textContent = '';
        cardUserExistingCardsSpan.innerHTML = 'None';
        selectedCardUserIdInput.value = '';
        newCardTypeSelect.disabled = true;
        linkedAccountGroup.style.display = 'none'; // Hide linked account input
        linkedAccountIdInput.value = ''; // Clear linked account input
        newCardDesignInput.value = ''; // Clear design input
        generateBankCardBtn.disabled = true;
        if (generateCardForm) {
            generateCardForm.reset();
        }
        currentCardManagementUser = null;
        cardGenerationStatusDiv.textContent = ''; // Clear status messages

        try {
            // 1. Fetch User Details
            const userResponse = await fetch(`${BACKEND_API_BASE_URL}/api/admin/users/search?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });

            if (await handleAuthError(userResponse)) return;

            if (!userResponse.ok) {
                const errorData = await userResponse.json();
                throw new Error(errorData.msg || 'User not found.');
            }

            const user = await userResponse.json();
            currentCardManagementUser = user;

            // 2. Display User Basic Details
            cardUserNameSpan.textContent = user.fullName || user.username || 'N/A';
            cardUserEmailSpan.textContent = user.email || 'N/A';
            cardUserIdSpan.textContent = user._id || 'N/A';
            selectedCardUserIdInput.value = user._id;

            // 3. Fetch User's Cards
            const cardsResponse = await fetch(`${BACKEND_API_BASE_URL}/api/admin/cards/user/${user._id}`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });

            if (await handleAuthError(cardsResponse)) return;

            let cardsHtml = '';
            if (cardsResponse.ok) {
                const cards = await cardsResponse.json();
                if (cards.length > 0) {
                    cardsHtml += '<ul>';
                    cards.forEach(card => {
                        const statusColor = card.status === 'active' ? 'green' : (card.status === 'inactive' ? 'orange' : 'red');
                        const expDate = card.expires ? `Exp: ${card.expires}` : '';
                        cardsHtml += `<li><strong>${card.cardType} Card:</strong> **** ${card.lastFourDigits || 'N/A'} ${expDate} <span style="color: ${statusColor};">(${card.status})</span></li>`;
                    });
                    cardsHtml += '</ul>';
                } else {
                    cardsHtml += 'No cards found for this user.';
                }
            } else {
                console.error(`Failed to fetch existing cards: ${(await cardsResponse.json()).msg || 'Error'}`);
                cardsHtml += `<p class="text-danger">Failed to load existing cards.</p>`;
            }
            cardUserExistingCardsSpan.innerHTML = cardsHtml;

            // 4. Show User Details Section and Enable Form
            cardManagementUserDetailsDiv.style.display = 'block';
            newCardTypeSelect.disabled = false;
            generateBankCardBtn.disabled = false;

            // Set initial state for linked account input based on default selected card type
            if (newCardTypeSelect.value === 'debit') {
                linkedAccountGroup.style.display = 'block';
            } else {
                linkedAccountGroup.style.display = 'none';
            }

        } catch (error) {
            console.error('Error finding user for card management:', error);
            alert(`Error finding user or fetching cards: ${error.message}`);
            cardGenerationStatusDiv.textContent = `Error: ${error.message}`;
            cardManagementUserDetailsDiv.style.display = 'none';
            currentCardManagementUser = null;
            selectedCardUserIdInput.value = '';
            if (generateCardForm) {
                generateCardForm.reset();
            }
            newCardTypeSelect.disabled = true;
            linkedAccountGroup.style.display = 'none';
            linkedAccountIdInput.value = '';
            newCardDesignInput.value = '';
            generateBankCardBtn.disabled = true;
        }
    }

    // --- Function to Generate Bank Card ---
    async function generateBankCard(event) {
        event.preventDefault(); // Prevent default form submission

        if (!currentCardManagementUser || !currentCardManagementUser._id) {
            alert('Please lookup and select a user first.');
            return;
        }

        const userId = currentCardManagementUser._id;
        const cardType = newCardTypeSelect.value;
        const cardDesign = newCardDesignInput.value.trim();

        if (!cardType) {
            alert('Please select a card type.');
            return;
        }

        const payload = {
            cardType: cardType,
            cardDesign: cardDesign || 'standard'
        };

        // Add linkedAccountId only if cardType is debit
        if (cardType === 'debit') {
            const linkedAccountId = linkedAccountIdInput.value.trim();
            if (!linkedAccountId) {
                alert('For debit cards, you must provide a linked account number.');
                return;
            }
            payload.linkedAccountId = linkedAccountId;
        }

        cardGenerationStatusDiv.textContent = 'Generating card...';
        cardGenerationStatusDiv.style.color = 'blue'; // Indicate processing
        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/admin/generate-card/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify(payload)
            });

            if (await handleAuthError(response)) return;

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.msg || 'Failed to generate bank card.');
            }

            const data = await response.json();
            cardGenerationStatusDiv.textContent = `Success! ${data.msg}`;
            cardGenerationStatusDiv.style.color = 'green';

            // Reset UI after successful generation, and re-lookup to show the new card
            await findUserForCard(); // Re-run lookup to refresh user details and card list


        } catch (error) {
            console.error('Error during card generation:', error);
            cardGenerationStatusDiv.textContent = `Error generating card: ${error.message}`;
            cardGenerationStatusDiv.style.color = 'red';
            alert(`Error generating card: ${error.message}`);
        }
    }

    // Function to find user for PIN Management section
    async function findUserForPin() {
        const query = pinUserIdOrEmailInput.value.trim();
        if (!query) {
            alert('Please enter a User ID or Email to search for PIN management.');
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/admin/users/search?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });

            if (await handleAuthError(response)) return;

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.msg || 'User not found.');
            }

            const user = await response.json();
            currentPinManagementUser = user;

            // Check if transferPinExists (assuming the user object has this property from backend)
            // Or you might need a separate endpoint to check PIN status securely.
            // For now, let's assume `user.hasTransferPin` is a boolean from the backend.
            const pinStatus = user.hasTransferPin ? '<span class="text-success">Set</span>' : '<span class="text-danger">Not Set</span>';

            pinUserDetailsDiv.innerHTML = `
                <p><strong>Name:</strong> ${user.fullName || user.username}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>User ID:</strong> ${user._id}</p>
                <p><strong>Transfer PIN Status:</strong> ${pinStatus}</p>
                <p><strong>Account Number:</strong> ${user.checkingAccount?.accountNumber || user.savingsAccount?.accountNumber || 'N/A'}</p>
                <p><strong>Routing Number:</strong> ${user.routingNumber || 'N/A'}</p>
            `;
            selectedPinUserId.value = user._id;

            // Enable PIN management forms
            newTransferPinInput.disabled = false;
            confirmTransferPinInput.disabled = false;
            document.getElementById('setPinBtn').disabled = false; // Assuming you have this button
            clearPinBtn.disabled = !user.hasTransferPin; // Enable clear only if PIN is set

        } catch (error) {
            console.error('Error finding user for PIN management:', error);
            alert(`Error finding user: ${error.message}`);
            pinUserDetailsDiv.innerHTML = '<p class="text-danger">User not found or an error occurred.</p>';
            currentPinManagementUser = null;
            selectedPinUserId.value = '';
            setTransferPinForm.reset();
            newTransferPinInput.disabled = true;
            confirmTransferPinInput.disabled = true;
            document.getElementById('setPinBtn').disabled = true;
            clearPinBtn.disabled = true;
        }
    }

    // --- Initial Load: Display Dashboard Section ---
    // Ensure the dashboard section is visible and its link is active on page load
    const initialActiveLink = document.querySelector('.sidebar-nav li.active a');
    if (initialActiveLink) {
        const initialDataSection = initialActiveLink.dataset.section;

        let initialSectionIdToLoad;
        switch (initialDataSection) {
            case 'dashboard':
                initialSectionIdToLoad = 'dashboardHomeSection';
                break;
            default:
                initialSectionIdToLoad = 'dashboardHomeSection'; // Fallback
        }

        const initialSection = document.getElementById(initialSectionIdToLoad);
        if (initialSection) {
            initialSection.classList.remove('hidden');
        }
    } else {
        if (dashboardSections.length > 0) {
            dashboardSections[0].classList.remove('hidden');
            const firstLink = document.querySelector(`.sidebar-nav a[data-section="${dashboardSections[0].id}"]`);
            if (firstLink) firstLink.parentElement.classList.add('active');
        }
    }

    // Initial data fetches for relevant sections (if they are the default visible ones)
    fetchAdminProfile();
    fetchAndDisplayUsers();
    fetchAndDisplayTransactions();

    // --- Event Listeners ---

    // Sidebar Toggle
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            document.body.classList.toggle('sidebar-open');
        });
    }

    // Close Buttons for Modals
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            modals.forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });

    window.addEventListener('click', (event) => {
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    // --- Section Switching Functionality ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            const targetSectionId = link.dataset.section;
            console.log('Clicked Link data-section:', targetSectionId);

            let actualSectionIdToShow;
            switch (targetSectionId) {
                case 'dashboard':
                    actualSectionIdToShow = 'dashboardHomeSection';
                    break;
                case 'create-user-account':
                    actualSectionIdToShow = 'createUserAccountSection';
                    break;
                case 'manage-users':
                    actualSectionIdToShow = 'manageUsersSection';
                    break;
                case 'manage-funds':
                    actualSectionIdToShow = 'manageFundsSection';
                    break;
                case 'manage-user-status':
                    actualSectionIdToShow = 'manageStatusSection';
                    break;
                case 'user-transaction-update':
                    actualSectionIdToShow = 'manageTransactionsSection';
                    break;
                case 'generate-mock-transaction':
                    actualSectionIdToShow = 'generateMockTransactionSection';
                    break;
                case 'generate-bank-card':
                    actualSectionIdToShow = 'generateCardSection';
                    break;
                case 'manage-user-transfer-pin':
                    actualSectionIdToShow = 'managePinSection';
                    break;
                default:
                    console.warn(`No mapping found for data-section: ${targetSectionId}. Assuming direct ID.`);
                    actualSectionIdToShow = targetSectionId;
                    break;
            }

            console.log('Mapped HTML Section ID (actualSectionIdToShow):', actualSectionIdToShow);


            if (actualSectionIdToShow) {
                // Hide all sections
                dashboardSections.forEach(section => {
                    section.classList.add('hidden');
                });

                // Show the target section
                const targetSection = document.getElementById(actualSectionIdToShow);

                console.log('Target HTML element found by ID:', targetSection);

                if (targetSection) {
                    targetSection.classList.remove('hidden');
                    console.log('Successfully showed section with ID:', targetSection.id);

                    // Trigger data fetching for the newly active section
                    if (actualSectionIdToShow === 'manageUsersSection') {
                        fetchAndDisplayUsers();
                    } else if (actualSectionIdToShow === 'manageTransactionsSection') {
                        fetchAndDisplayTransactions();
                    } else if (actualSectionIdToShow === 'manageFundsSection') {
                        fundUserDetailsDiv.innerHTML = '<p class="text-info">Search for a user by ID or Email.</p>';
                        fundRecipientIdentifierInput.value = '';
                        selectedFundUserIdInput.value = '';
                        currentFundManagementUser = null;
                        manageFundsForm.reset();
                        disableFundTransactionForm(); // Call the explicit disable function
                    } else if (actualSectionIdToShow === 'manageStatusSection') {
                        statusUserDetailsDiv.innerHTML = '<p class="text-info">Search for a user by ID or Email.</p>';
                        statusUserIdOrEmailInput.value = '';
                        selectedStatusUserIdInput.value = '';
                        currentStatusManagementUser = null;
                        manageStatusForm.reset();
                        newAccountStatusSelect.disabled = true;
                        statusEmailNotificationMessageInput.disabled = true;
                        sendStatusEmailNotificationCheckbox.disabled = true;
                        submitStatusChangeBtn.disabled = true;
                    } else if (actualSectionIdToShow === 'generateCardSection') {
                        cardManagementUserDetailsDiv.style.display = 'none'; // Ensure it starts hidden
                        userLookupIdentifierInput.value = '';
                        selectedCardUserIdInput.value = '';
                        currentCardManagementUser = null;
                        generateCardForm.reset();
                        newCardTypeSelect.disabled = true;
                        linkedAccountGroup.style.display = 'none';
                        linkedAccountIdInput.value = '';
                        newCardDesignInput.value = '';
                        generateBankCardBtn.disabled = true;
                        cardGenerationStatusDiv.textContent = '';
                    } else if (actualSectionIdToShow === 'managePinSection') {
                        pinUserDetailsDiv.innerHTML = '<p class="text-info">Search for a user by ID or Email to manage their transfer PIN.</p>';
                        pinUserIdOrEmailInput.value = '';
                        selectedPinUserId.value = '';
                        currentPinManagementUser = null;
                        setTransferPinForm.reset();
                        newTransferPinInput.disabled = true;
                        confirmTransferPinInput.disabled = true;
                        document.getElementById('setPinBtn').disabled = true;
                        clearPinBtn.disabled = true;
                    }
                    // Add other specific section loading logic here as needed
                } else {
                    console.error('ERROR: HTML section element with ID "' + actualSectionIdToShow + '" was not found in the DOM.');
                    console.error('Please check your admin-dashboard.html for missing or misspelled IDs.');
                }

                // Update active class on sidebar links
                navLinks.forEach(navLink => navLink.parentElement.classList.remove('active'));
                link.parentElement.classList.add('active');

                // For mobile: close sidebar after clicking a link
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('active');
                    document.body.classList.remove('sidebar-open');
                }
            }
        });
    });

    // --- User Management Event Listeners ---
    if (searchUsersBtn) {
        searchUsersBtn.addEventListener('click', () => fetchAndDisplayUsers(userSearchInput.value));
    }

    if (userSearchInput) {
        userSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                fetchAndDisplayUsers(userSearchInput.value);
            }
        });
    }

    if (refreshUsersBtn) {
        refreshUsersBtn.addEventListener('click', () => fetchAndDisplayUsers());
    }

    if (editUserForm) {
        editUserForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const userId = editUserIdInput.value;
            const updatedData = {
                username: editUsernameInput.value.trim(),
                fullName: editFullNameInput.value.trim(),
                email: editEmailInput.value.trim(),
                phone: editPhoneNumberInput.value.trim(), // Corrected from 'phoneNumber' to 'phone' based on your HTML form
                homeAddress: editAddressInput.value.trim(), // Corrected from 'address' to 'homeAddress'
                checkingAccount: {
                    accountNumber: editCheckingAccountNumberInput.value.trim(),
                    balance: parseFloat(editCheckingBalanceInput.value)
                },
                savingsAccount: {
                    accountNumber: editSavingsAccountNumberInput.value.trim(),
                    balance: parseFloat(editSavingsBalanceInput.value)
                },
                accountStatus: editAccountStatusSelect.value, // Corrected from 'role' to 'accountStatus'
                isVerified: editIsVerifiedCheckbox.checked
            };


            console.log('Attempting to update user:', userId, updatedData);

            try {
                const response = await fetch(`${BACKEND_API_BASE_URL}/api/admin/users/${userId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${adminToken}`
                    },
                    body: JSON.stringify(updatedData)
                });

                if (await handleAuthError(response)) {
                    return;
                }

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.msg || 'Failed to update user.');
                }

                const result = await response.json();
                alert('User updated successfully!');
                console.log('User update successful:', result);

                // Assuming you have a closeModal function for modals
                const transactionUpdateModal = document.getElementById('transactionUpdateModal'); // Assuming this is your general modal
                if (editUserModal) {
                    editUserModal.style.display = 'none'; // Close the edit user modal
                }
                if (transactionUpdateModal) {
                    transactionUpdateModal.style.display = 'none'; // Also ensure other modals are closed
                }

                fetchAndDisplayUsers(); // Refresh the user list to show updated data

            } catch (error) {
                console.error('Error updating user:', error);
                alert(`Error updating user: ${error.message}`);
            }
        });
    }

    // --- Create User Form Event Listener ---
    if (createUserForm) {
        createUserForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const username = document.getElementById('newUsername').value.trim();
            const fullName = document.getElementById('newFullName').value.trim();
            const email = document.getElementById('newEmail').value.trim();
            const password = document.getElementById('newPassword').value.trim();
            const role = document.getElementById('newRole').value;
            const homeAddress = document.getElementById('newHomeAddress').value.trim();
            const phone = document.getElementById('newPhone').value.trim();
            const gender = document.getElementById('newGender').value;
            const nationality = document.getElementById('newNationality').value.trim();
            const occupation = document.getElementById('newOccupation').value.trim();
            const currency = document.getElementById('newCurrency').value;
            const routingNumber = document.getElementById('newRoutingNumber').value.trim();

            const wireTransferLimit = document.getElementById('newWireTransferLimit') ? parseFloat(document.getElementById('newWireTransferLimit').value.trim()) : undefined;
            const achTransferLimit = document.getElementById('newAchTransferLimit') ? parseFloat(document.getElementById('newAchTransferLimit').value.trim()) : undefined;
            const profilePicture = document.getElementById('newProfilePicture') ? document.getElementById('newProfilePicture').value.trim() : undefined;


            if (!username || !email || !password || !role || !homeAddress || !phone || !gender || !nationality || !occupation || !currency || !routingNumber) {
                alert('Please fill in all required fields to create a user account.');
                return;
            }

            if (password.length < 6) {
                alert('Password must be at least 6 characters long.');
                return;
            }

            try {
                const response = await fetch(`${BACKEND_API_BASE_URL}/api/admin/users/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${adminToken}`
                    },
                    body: JSON.stringify({
                        username,
                        fullName,
                        email,
                        password,
                        role,
                        homeAddress,
                        phone,
                        gender,
                        nationality,
                        occupation,
                        currency,
                        routingNumber,
                        wireTransferLimit,
                        achTransferLimit,
                        profilePicture
                    })
                });

                if (await handleAuthError(response)) return;

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.msg || 'Failed to create user.');
                }

                alert('User account created successfully!');
                console.log('User created:', result);
                createUserForm.reset();
                fetchAndDisplayUsers(); // Refresh the user list
            } catch (error) {
                console.error('Error creating user:', error);
                alert(`Error creating user: ${error.message}`);
            }
        });
    }

    // --- Fund Management Event Listeners ---
    if (findUserForFundsBtn) {
        findUserForFundsBtn.addEventListener('click', findUserForFunds);
    }

    if (fundRecipientIdentifierInput) {
        fundRecipientIdentifierInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                findUserForFundsBtn.click();
            }
        });
    }

    if (manageFundsForm) {
        manageFundsForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (!currentFundManagementUser || !selectedFundUserIdInput.value) {
                alert('Please find and select a user first.');
                return;
            }

            const userId = selectedFundUserIdInput.value;
            const accountType = fundAccountTypeSelect.value;
            const transactionType = fundTransactionTypeSelect.value;
            const amount = parseFloat(fundAmountInput.value);
            const description = fundDescriptionInput.value.trim();

            if (isNaN(amount) || amount <= 0) {
                alert('Please enter a valid amount.');
                return;
            }
            if (!accountType || !transactionType) {
                alert('Please select account type and transaction type.');
                return;
            }
            if (!description) {
                alert('Please provide a description for the transaction.');
                return;
            }

            let endpoint = '';
            let payload = { amount, description, accountType };

            if (transactionType === 'deposit') {
                endpoint = `${BACKEND_API_BASE_URL}/api/admin/transactions/deposit/${userId}`;
            } else if (transactionType === 'withdrawal') {
                endpoint = `${BACKEND_API_BASE_URL}/api/admin/transactions/withdraw/${userId}`;
            } else {
                alert('Invalid transaction type selected.');
                return;
            }

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${adminToken}`
                    },
                    body: JSON.stringify(payload)
                });

                if (await handleAuthError(response)) return;

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.msg || 'Failed to process transaction.');
                }

                alert(`Transaction ${transactionType} successful!`);
                console.log('Transaction result:', result);
                manageFundsForm.reset();
                findUserForFunds(); // Refresh user details and balances
                fetchAndDisplayTransactions(); // Refresh the transactions table
                disableFundTransactionForm(); // Disable form after submission
            } catch (error) {
                console.error('Error processing fund transaction:', error);
                alert(`Error processing transaction: ${error.message}`);
            }
        });
    }

    // --- User Status Management Event Listeners ---
    if (lookupStatusUserBtn) {
        lookupStatusUserBtn.addEventListener('click', findUserForStatus);
    }

    if (statusUserIdOrEmailInput) {
        statusUserIdOrEmailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                lookupStatusUserBtn.click();
            }
        });
    }

    if (manageStatusForm) {
        manageStatusForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (!currentStatusManagementUser || !selectedStatusUserIdInput.value) {
                alert('Please find and select a user first.');
                return;
            }

            const userId = selectedStatusUserIdInput.value;
            const newStatus = newAccountStatusSelect.value;
            const sendEmail = sendStatusEmailNotificationCheckbox.checked;
            const emailMessage = statusEmailNotificationMessageInput.value.trim();

            if (!newStatus) {
                alert('Please select a new account status.');
                return;
            }

            if (sendEmail && !emailMessage) {
                alert('Please enter a message for the email notification.');
                return;
            }

            const payload = {
                accountStatus: newStatus,
                sendEmailNotification: sendEmail,
                emailNotificationMessage: emailMessage
            };

            try {
                const response = await fetch(`${BACKEND_API_BASE_URL}/api/admin/users/status/${userId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${adminToken}`
                    },
                    body: JSON.stringify(payload)
                });

                if (await handleAuthError(response)) return;

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.msg || 'Failed to update user status.');
                }

                alert('User status updated successfully!');
                console.log('User status update result:', result);
                manageStatusForm.reset();
                findUserForStatus(); // Refresh user details with new status
                fetchAndDisplayUsers(); // Refresh main users table
            } catch (error) {
                console.error('Error updating user status:', error);
                alert(`Error updating user status: ${error.message}`);
            }
        });
    }


    // --- Transaction Management Event Listeners ---
    // Make sure 'updateTransactionBtn' exists in your HTML
    const transactionUpdateModal = document.getElementById('transactionUpdateModal'); // Assuming this is the modal
    if (transactionUpdateModal) {
        // Find the update button INSIDE the modal/form
        const updateBtn = transactionUpdateModal.querySelector('#updateTransactionBtn'); // Use ID if unique, or class/tag if generic
        if (updateBtn) {
            updateBtn.addEventListener('click', async (event) => {
                event.preventDefault(); // Prevent default form submission

                const transactionId = document.getElementById('updateTransactionId').value;
                const newStatus = document.getElementById('newTransactionStatus').value;

                if (!transactionId || !newStatus) {
                    alert('Transaction ID and new status are required.');
                    return;
                }

                const payload = { status: newStatus };

                try {
                    const response = await fetch(`${BACKEND_API_BASE_URL}/api/admin/transactions/${transactionId}/status`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${adminToken}`
                        },
                        body: JSON.stringify(payload)
                    });

                    if (await handleAuthError(response)) return;

                    const result = await response.json();

                    if (!response.ok) {
                        throw new Error(result.msg || 'Failed to update transaction status.');
                    }

                    alert('Transaction status updated successfully!');
                    console.log('Transaction status update result:', result);
                    if (transactionUpdateModal) {
                        transactionUpdateModal.style.display = 'none'; // Close the modal
                    }
                    fetchAndDisplayTransactions(); // Refresh the transactions table
                } catch (error) {
                    console.error('Error updating transaction status:', error);
                    alert(`Error updating transaction status: ${error.message}`);
                }
            });
        }
    }


    // --- Event Listeners for Card Generation Section ---
    if (lookupUserForCardBtn) {
        lookupUserForCardBtn.addEventListener('click', findUserForCard);
    }

    if (userLookupIdentifierInput) {
        userLookupIdentifierInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                lookupUserForCardBtn.click();
            }
        });
        // Also ensure your 'input' event listener for userLookupIdentifierInput is here
        userLookupIdentifierInput.addEventListener('input', () => {
            cardManagementUserDetailsDiv.style.display = 'none';
            generateBankCardBtn.disabled = true;
            currentCardManagementUser = null;
            selectedCardUserIdInput.value = '';
            newCardTypeSelect.value = 'debit';
            newCardDesignInput.value = '';
            linkedAccountGroup.style.display = 'none';
            linkedAccountIdInput.value = '';
            cardGenerationStatusDiv.textContent = '';
        });
    }

    if (generateCardForm) {
        generateCardForm.addEventListener('submit', generateBankCard);
    }

    if (newCardTypeSelect) {
        newCardTypeSelect.addEventListener('change', () => {
            if (newCardTypeSelect.value === 'debit') {
                linkedAccountGroup.style.display = 'block';
            } else {
                linkedAccountGroup.style.display = 'none';
                linkedAccountIdInput.value = '';
            }
        });
    }

    // --- PIN Management Event Listeners ---
    if (lookupPinUserBtn) {
        lookupPinUserBtn.addEventListener('click', findUserForPin);
    }

    if (pinUserIdOrEmailInput) {
        pinUserIdOrEmailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                lookupPinUserBtn.click();
            }
        });
        // Reset UI when identifier input changes for PIN section
        pinUserIdOrEmailInput.addEventListener('input', () => {
            pinUserDetailsDiv.innerHTML = '<p class="text-info">Search for a user by ID or Email to manage their transfer PIN.</p>';
            selectedPinUserId.value = '';
            currentPinManagementUser = null;
            setTransferPinForm.reset();
            newTransferPinInput.disabled = true;
            confirmTransferPinInput.disabled = true;
            document.getElementById('setPinBtn').disabled = true;
            clearPinBtn.disabled = true;
        });
    }

    if (setTransferPinForm) {
        setTransferPinForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (!currentPinManagementUser || !selectedPinUserId.value) {
                alert('Please find and select a user first for PIN management.');
                return;
            }

            const userId = selectedPinUserId.value;
            const newPin = newTransferPinInput.value.trim();
            const confirmPin = confirmTransferPinInput.value.trim();

            if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
                alert('PIN must be exactly 4 digits.');
                return;
            }
            if (newPin !== confirmPin) {
                alert('New PIN and confirmation PIN do not match.');
                return;
            }

            try {
                const response = await fetch(`${BACKEND_API_BASE_URL}/api/admin/users/${userId}/pin`, {
                    method: 'PUT', // or POST, depending on your API
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${adminToken}`
                    },
                    body: JSON.stringify({ transferPin: newPin })
                });

                if (await handleAuthError(response)) return;

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.msg || 'Failed to set transfer PIN.');
                }

                alert('Transfer PIN set successfully!');
                console.log('PIN set result:', result);
                setTransferPinForm.reset();
                findUserForPin(); // Refresh user details and PIN status
            } catch (error) {
                console.error('Error setting transfer PIN:', error);
                alert(`Error setting transfer PIN: ${error.message}`);
            }
        });
    }

    if (clearPinBtn) {
        clearPinBtn.addEventListener('click', async () => {
            if (!currentPinManagementUser || !selectedPinUserId.value) {
                alert('Please find and select a user first to clear their PIN.');
                return;
            }

            if (!confirm('Are you sure you want to clear this user\'s transfer PIN?')) {
                return;
            }

            const userId = selectedPinUserId.value;

            try {
                const response = await fetch(`${BACKEND_API_BASE_URL}/api/admin/users/${userId}/pin`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${adminToken}`
                    }
                });

                if (await handleAuthError(response)) return;

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.msg || 'Failed to clear transfer PIN.');
                }

                alert('Transfer PIN cleared successfully!');
                console.log('PIN clear result:', result);
                findUserForPin(); // Refresh user details and PIN status
            } catch (error) {
                console.error('Error clearing transfer PIN:', error);
                alert(`Error clearing transfer PIN: ${error.message}`);
            }
        });
    }


    // --- Logout Functionality ---
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to log out?')) {
                localStorage.removeItem('adminToken');
                window.location.href = 'admin-login.html';
            }
        });
    }

}); // End of DOMContentLoaded