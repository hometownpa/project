// user-dashboard.js

// Declare API_BASE_URL outside DOMContentLoaded if it's a global constant
const API_BASE_URL = 'http://localhost:5000/api'; // IMPORTANT: Replace with your actual backend API URL in production

// This array will hold user account data fetched from the backend
let userAccounts = [];

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element Selections ---
    // Select all elements that need to be interacted with or updated.
    // Ensure these IDs/classes match your user-dashboard.html precisely.

    // Header & Profile
    const userNameGreeting = document.getElementById('userNameGreeting');
    const headerProfilePic = document.getElementById('headerProfilePic');

    // Account Section
    const accountCardsContainer = document.querySelector('.account-cards-container');
    const accountPagination = document.querySelector('.account-pagination');
    const accountsLoadingMessage = document.getElementById('accountsLoadingMessage');

    // Action Buttons
    const actionButtons = document.querySelectorAll('.action-button');
    const transferButton = document.getElementById('transferButton');
    const messageButton = document.getElementById('messageButton');
    const depositButton = document.getElementById('depositButton');

    // Transfer Modal Elements (Initial selection modal - this stays on dashboard)
    const transferModalOverlay = document.getElementById('transferModalOverlay');
    const closeTransferModalButton = document.getElementById('closeTransferModal');
    const transferOptionButtons = document.querySelectorAll('.transfer-option'); // These now trigger redirect

    // Bank Cards Section
    const userCardList = document.getElementById('userCardList');
    const viewCardsButton = document.getElementById('viewMyCardsButton');
    const cardsLoadingMessage = document.getElementById('cardsLoadingMessage');
    const manageCardsButton = document.getElementById('manageCardsButton');

    // Transactions Section
    const transactionList = document.querySelector('.transaction-list');
    const seeMoreButton = document.querySelector('.see-more-button');
    const transactionsLoadingMessage = document.getElementById('transactionsLoadingMessage');

    // Sidebar Elements
    const menuIcon = document.getElementById('menuIcon');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const logoutButton = document.getElementById('logoutButton');
    const sidebarProfilePic = document.querySelector('.sidebar-profile-pic');
    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarUserEmail = document.getElementById('sidebarUserEmail');

    // --- Custom Message Box Implementation ---
    // Dynamically create the message box if it doesn't exist in HTML
    let messageBoxOverlay = document.getElementById('messageBoxOverlay');
    let messageBoxContentElement; // Renamed to avoid conflict with function parameter

    if (!messageBoxOverlay) {
        messageBoxOverlay = document.createElement('div');
        messageBoxOverlay.id = 'messageBoxOverlay';
        messageBoxOverlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.6); display: flex; justify-content: center;
            align-items: center; z-index: 1000; opacity: 0; visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        `;
        document.body.appendChild(messageBoxOverlay);

        const messageBox = document.createElement('div');
        messageBox.id = 'messageBox';
        messageBox.style.cssText = `
            background: #fff; padding: 25px; border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3); text-align: center;
            max-width: 350px; width: 90%; transform: translateY(-20px);
            transition: transform 0.3s ease;
        `;
        messageBoxOverlay.appendChild(messageBox);

        messageBoxContentElement = document.createElement('p'); // Assign to the newly named variable
        messageBoxContentElement.id = 'messageBoxContent';
        messageBoxContentElement.style.cssText = `
            font-size: 1.1rem; color: #333; margin-bottom: 20px;
        `;
        messageBox.appendChild(messageBoxContentElement);

        const messageBoxButton = document.createElement('button');
        messageBoxButton.id = 'messageBoxButton';
        messageBoxButton.textContent = 'OK';
        messageBoxButton.style.cssText = `
            background: linear-gradient(45deg, #2575fc, #6a11cb); color: #fff;
            border: none; padding: 10px 25px; border-radius: 8px; cursor: pointer;
            font-size: 1rem; font-weight: 600; transition: all 0.2s ease;
        `;
        messageBox.appendChild(messageBoxButton);
    } else {
        // If messageBoxOverlay already exists, get the content element
        messageBoxContentElement = document.getElementById('messageBoxContent');
    }

    // Function to show custom message box
    function showCustomMessageBox(message, callback = null) {
        const messageBoxButton = document.getElementById('messageBoxButton');

        if (!messageBoxContentElement || !messageBoxOverlay || !messageBoxButton) {
            console.error('Message box elements not found!');
            alert(message); // Fallback to browser alert if custom box elements aren't ready
            if (callback) callback();
            return;
        }

        messageBoxContentElement.textContent = message;
        messageBoxOverlay.style.opacity = '1';
        messageBoxOverlay.style.visibility = 'visible';
        document.getElementById('messageBox').style.transform = 'translateY(0)';

        // Remove previous listeners and attach new one to prevent multiple calls
        const newMessageBoxButton = messageBoxButton.cloneNode(true);
        messageBoxButton.parentNode.replaceChild(newMessageBoxButton, messageBoxButton);

        newMessageBoxButton.addEventListener('click', () => {
            messageBoxOverlay.style.opacity = '0';
            messageBoxOverlay.style.visibility = 'hidden';
            document.getElementById('messageBox').style.transform = 'translateY(-20px)';
            if (callback) {
                callback();
            }
        });
    }

    // --- Authentication Check on Page Load ---
    const token = localStorage.getItem('token');
    if (!token) {
        showCustomMessageBox('You are not logged in. Redirecting to login page.', () => {
            window.location.href = 'index.html'; // Assuming index.html is your login page
        });
        return; // Stop further script execution
    }

    // --- Dynamic Data Fetching and Rendering ---

    async function fetchUserData() {
        // Show loading messages
        if (accountsLoadingMessage) accountsLoadingMessage.style.display = 'block';
        if (transactionsLoadingMessage) transactionsLoadingMessage.style.display = 'block';
        if (cardsLoadingMessage) cardsLoadingMessage.style.display = 'block';

        try {
            const response = await fetch(`${API_BASE_URL}/user/dashboard`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`, // Send JWT token for authentication
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    showCustomMessageBox('Session expired or unauthorized. Please log in again.', () => {
                        localStorage.removeItem('token');
                        localStorage.removeItem('userRole'); // Clear all related local storage
                        localStorage.removeItem('userId');
                        localStorage.removeItem('username');
                        localStorage.removeItem('fullName');
                        sessionStorage.removeItem('userAccounts'); // Clear session storage too
                        window.location.href = 'index.html';
                    });
                } else {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
            }

            const data = await response.json();
            console.log('Fetched user data:', data);

            // Hide loading messages
            if (accountsLoadingMessage) accountsLoadingMessage.style.display = 'none';
            if (transactionsLoadingMessage) transactionsLoadingMessage.style.display = 'none';
            if (cardsLoadingMessage) cardsLoadingMessage.style.display = 'none';

            // Populate User Greeting and Sidebar Info
            const userName = data.user.firstName || data.user.fullName?.split(' ')[0] || 'User'; // Prioritize firstName, then first name from fullName
            if (userNameGreeting) userNameGreeting.textContent = userName;
            if (sidebarUserName) sidebarUserName.textContent = data.user.fullName || userName; // Prefer fullName if available
            if (sidebarUserEmail) sidebarUserEmail.textContent = data.user.email || 'N/A';

            // Update profile pictures if dynamic URLs are provided
            const profilePicPath = data.user.profilePicUrl || '/images/default-profile.png';
            if (headerProfilePic) headerProfilePic.src = profilePicPath;
            if (sidebarProfilePic) sidebarProfilePic.src = profilePicPath;

            // Store accounts globally for use in transfer forms (will be passed to transfer-form.html)
            userAccounts = data.accounts || []; // Ensure it's an array even if empty

            // *** IMPORTANT ADDITION: Store userAccounts in sessionStorage ***
            // This makes the data available to other pages like transfer-form.html
            sessionStorage.setItem('userAccounts', JSON.stringify(userAccounts));

            renderAccounts(userAccounts); // Populate Account Cards and update form dropdowns

            // Populate Transactions
            renderTransactions(data.transactions || []); // Ensure it's an array even if empty

            // Populate Bank Cards
            renderBankCards(data.cards || []); // Ensure it's an array even if empty

        } catch (error) {
            console.error('Error fetching user data:', error);
            // Show appropriate fallback messages if data fetch fails
            if (accountsLoadingMessage) accountsLoadingMessage.textContent = 'Failed to load accounts.';
            if (transactionsLoadingMessage) transactionsLoadingMessage.textContent = 'Failed to load transactions.';
            if (cardsLoadingMessage) cardsLoadingMessage.textContent = 'Failed to load cards.';
            showCustomMessageBox('Failed to load dashboard data. Please try again later.');
        }
    }

    function renderAccounts(accounts) {
        if (!accountCardsContainer || !accountPagination) return; // Defensive check

        accountCardsContainer.innerHTML = ''; // Clear existing static accounts
        accountPagination.innerHTML = ''; // Clear existing pagination dots

        if (accounts.length === 0) {
            accountCardsContainer.innerHTML = '<p class="no-data-message">No accounts found.</p>';
            return;
        }

        accounts.forEach((account, index) => {
            const accountCard = document.createElement('div');
            accountCard.classList.add('account-card', `${account.type.toLowerCase()}-account`);
            if (index === 0) { // Set the first account as active by default
                accountCard.classList.add('active-account');
            }
            accountCard.dataset.accountIndex = index;
            accountCard.dataset.accountId = account.id; // Store actual account ID from backend
            accountCard.dataset.accountType = account.type.toLowerCase(); // Store account type

            accountCard.innerHTML = `
                <div class="account-details">
                    <p class="account-type">${account.type}</p>
                    <p class="account-number">x${String(account.accountNumber).slice(-4)}</p>
                </div>
                <div class="account-balance">
                    <p class="balance-amount">$${parseFloat(account.balance).toFixed(2)}</p>
                    <p class="balance-status">Available</p>
                </div>
            `;
            accountCardsContainer.appendChild(accountCard);

            const dot = document.createElement('span');
            dot.classList.add('dot');
            if (index === 0) {
                dot.classList.add('active');
            }
            dot.dataset.accountIndex = index;
            accountPagination.appendChild(dot);
        });

        // Re-attach event listeners for dynamically created account cards and pagination dots
        const allAccountCards = document.querySelectorAll('.account-card');
        const allDots = document.querySelectorAll('.dot');

        function updateActiveAccount(activeIndex) {
            allAccountCards.forEach(card => card.classList.remove('active-account'));
            allDots.forEach(dot => dot.classList.remove('active'));

            const activeCard = document.querySelector(`.account-card[data-account-index="${activeIndex}"]`);
            const activeDot = document.querySelector(`.dot[data-account-index="${activeIndex}"]`);

            if (activeCard) activeCard.classList.add('active-account');
            if (activeDot) activeDot.classList.add('active');
        }

        allAccountCards.forEach(card => {
            card.addEventListener('click', () => {
                const index = card.dataset.accountIndex;
                updateActiveAccount(index);
            });
        });

        allDots.forEach(dot => {
            dot.addEventListener('click', () => {
                const index = dot.dataset.accountIndex;
                updateActiveAccount(index);
            });
        });

        // Handle desktop view: if screen is wide enough, disable pagination and show all cards
        if (window.innerWidth >= 768) { // Based on your CSS media query
            allAccountCards.forEach(card => {
                card.style.display = 'flex'; // Ensure all cards are visible
                card.classList.add('active-account'); // Mark all as 'active' for consistent styling
            });
            accountPagination.style.display = 'none'; // Hide pagination dots
        }
    }

    function renderTransactions(transactions) {
        if (!transactionList) return; // Defensive check
        transactionList.innerHTML = ''; // Clear existing static transactions

        if (transactions.length === 0) {
            transactionList.innerHTML = '<p class="no-data-message">No transactions to display.</p>';
            return;
        }

        // Sort transactions by date, newest first
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        transactions.forEach(transaction => {
            const transactionItem = document.createElement('div');
            transactionItem.classList.add('transaction-item');

            // Determine if it's a deposit based on the backend 'type' or amount
            if (transaction.type === 'deposit' || parseFloat(transaction.amount) > 0) {
                transactionItem.classList.add('deposit');
            }

            const transactionDate = new Date(transaction.date); // Assuming ISO 8601 date string from backend
            const formattedDate = transactionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            // Find the account type string from the userAccounts array
            const relatedAccount = userAccounts.find(acc => acc.id === transaction.accountId);
            const accountTypeName = relatedAccount ? relatedAccount.type : 'Unknown';

            const displayAmount = parseFloat(transaction.amount).toFixed(2);
            const amountPrefix = parseFloat(transaction.amount) < 0 ? '-' : '+';
            const amountClass = parseFloat(transaction.amount) < 0 ? '' : 'deposit-amount';

            // Determine the display name for the transaction
            let transactionDisplayName = transaction.name;
            // You need a way to identify admin/system transactions from your backend data.
            // Assuming your backend sends a 'source' field (e.g., 'User', 'Admin', 'System')
            // or an 'is_admin_adjusted' boolean.
            if (transaction.source === 'Admin' || transaction.source === 'System' || transaction.is_admin_adjusted) {
                // If it's an admin/system adjustment, only show the description
                // and prepend it with "Adjustment" for clarity if desired.
                transactionDisplayName = transaction.description || 'Account Adjustment'; // Use description if available, otherwise a generic term
            } else {
                // For regular user transactions, show the transaction name
                transactionDisplayName = transaction.name;
            }

            // ADDED: Transaction Status Display
            let statusHtml = '';
            if (transaction.status) {
                let statusClass = '';
                switch (transaction.status.toLowerCase()) {
                    case 'pending':
                    case 'processing':
                    case 'initiated': // Add 'initiated' for deposits
                    case 'awaiting_funds': // Add 'awaiting_funds' for deposits
                        statusClass = 'status-processing';
                        break;
                    case 'approved':
                    case 'completed':
                        statusClass = 'status-completed';
                        break;
                    case 'rejected':
                        statusClass = 'status-rejected';
                        break;
                    default:
                        statusClass = 'status-unknown';
                }
                statusHtml = `<span class="transaction-status ${statusClass}">${transaction.status.replace(/_/g, ' ')}</span>`; // Replace underscores for better display
            }


            transactionItem.innerHTML = `
                <div class="transaction-details">
                    <p class="transaction-name">${transactionDisplayName}</p>
                    <p class="transaction-info">${formattedDate}, ${accountTypeName} ${statusHtml}</p>
                </div>
                <p class="transaction-amount ${amountClass}">
                    ${amountPrefix}$${Math.abs(displayAmount)}
                </p>
            `;
            transactionList.appendChild(transactionItem);
        });
    }

    // --- renderBankCards function ---
    function renderBankCards(cards) {
        if (!userCardList) return; // Defensive check
        userCardList.innerHTML = ''; // Clear existing content (e.g., "No cards found" message)

        if (cards.length === 0) {
            userCardList.innerHTML = '<p class="no-cards-message">No bank cards found. You can request one from your profile settings.</p>';
            // Show the manage cards button even if no cards, so user can go to cards.html to request one.
            if (manageCardsButton) manageCardsButton.style.display = 'flex'; // Ensure it's visible
            // If no cards, the "View My Cards" button isn't needed for toggling, so hide it.
            if (viewCardsButton) viewCardsButton.style.display = 'none';
        } else {
            // If cards are found, ensure the manage cards button is visible
            if (manageCardsButton) manageCardsButton.style.display = 'flex';
            // And ensure the "View My Cards" toggle is visible
            if (viewCardsButton) viewCardsButton.style.display = 'flex';
            // Reset the toggle button text if cards are now loaded
            if (viewCardsButton && !userCardList.classList.contains('show')) {
                viewCardsButton.innerHTML = '<i class="fas fa-credit-card"></i> Show Cards';
            }
        }

        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.classList.add('bank-card-item');
            cardElement.classList.add(`${card.network.toLowerCase()}-card`); // e.g., 'visa-card', 'mastercard-card'
            cardElement.classList.add(`${card.type.toLowerCase()}-card`); // e.g., 'credit-card', 'debit-card'

            // Mask card number for display (show last 4 digits)
            const displayedCardNumber = `**** **** **** ${String(card.cardNumber).slice(-4)}`;
            // Format expiry date (assuming expiryDate from backend is 'YYYY-MM-DD' or 'MM/YY')
            let formattedExpiry = card.expiryDate;
            if (card.expiryDate && card.expiryDate.includes('-')) { // If YYYY-MM-DD
                const [year, month] = card.expiryDate.split('-');
                formattedExpiry = `${month}/${year.slice(-2)}`;
            } else if (!card.expiryDate) {
                formattedExpiry = 'N/A'; // Fallback if no expiry date
            }

            cardElement.innerHTML = `
                <div class="card-chip"></div>
                <div class="card-logo">${card.network ? card.network.toUpperCase() : 'CARD'}</div>
                <p class="card-number">${displayedCardNumber}</p>
                <div class="card-holder-expiry">
                    <p class="card-holder">Card Holder: ${card.cardHolderName ? card.cardHolderName.toUpperCase() : 'N/A'}</p>
                    <p class="card-expiry">Expires: ${formattedExpiry}</p>
                </div>
                <p class="card-type">${card.type} Card</p>
                <p class="card-status ${card.status ? card.status.toLowerCase() : 'active'}">Status: ${card.status || 'Active'}</p>
            `;
            userCardList.appendChild(cardElement);

            // Add an event listener to the card item itself (e.g., to view more details or activate/deactivate)
            cardElement.addEventListener('click', () => {
                showCustomMessageBox(`Card Details:\nType: ${card.type} Card\nNetwork: ${card.network}\nLast 4: ${String(card.cardNumber).slice(-4)}\nStatus: ${card.status || 'Active'}\n(More card actions/details here)`);
            });
        });
    }


    // --- Event Listeners ---

    // Handle the Deposit button click
    if (depositButton) {
        depositButton.addEventListener('click', () => {
            window.location.href = 'deposit.html'; // Redirect to the deposit page
        });
    }

    // Handle the Manage Cards button click
    if (manageCardsButton) {
        manageCardsButton.addEventListener('click', () => {
            window.location.href = 'cards.html'; // Redirect to the cards management page
        });
    }

    // Generic Action Buttons (e.g., Pay Bill, ATM Locator - if they don't have specific handlers)
    actionButtons.forEach(button => {
        // Exclude 'transferButton', 'messageButton', 'depositButton', AND 'manageCardsButton' from this generic handler
        if (button.id !== 'transferButton' && button.id !== 'messageButton' && button.id !== 'depositButton' && button.id !== 'manageCardsButton') {
            button.addEventListener('click', () => {
                const actionText = button.querySelector('p').textContent;
                showCustomMessageBox(`You clicked ${actionText}! (Functionality not implemented in this demo)`);
            });
        }
    });

    // See More Transactions Button
    if (seeMoreButton) {
        seeMoreButton.addEventListener('click', () => {
            showCustomMessageBox('Loading more transactions... (Functionality not implemented in this demo)');
        });
    }

    // "View My Cards" button (for toggling card list visibility)
    if (viewCardsButton) {
        viewCardsButton.addEventListener('click', () => {
            if (userCardList) { // Ensure userCardList exists before toggling
                userCardList.classList.toggle('show'); // 'show' class will control display via CSS
                if (userCardList.classList.contains('show')) {
                    viewCardsButton.innerHTML = '<i class="fas fa-chevron-up"></i> Hide Cards';
                } else {
                    viewCardsButton.innerHTML = '<i class="fas fa-credit-card"></i> Show Cards';
                }
            }
        });
    }

    // --- Transfer Modals Functionality ---

    // Show initial transfer type selection modal
    if (transferButton) {
        transferButton.addEventListener('click', () => {
            if (transferModalOverlay) {
                transferModalOverlay.classList.add('active');
            }
        });
    }

    // Close initial transfer type selection modal
    if (closeTransferModalButton) {
        closeTransferModalButton.addEventListener('click', () => {
            if (transferModalOverlay) {
                transferModalOverlay.classList.remove('active');
            }
        });
    }

    // Close initial transfer type selection modal by clicking overlay
    if (transferModalOverlay) {
        transferModalOverlay.addEventListener('click', (event) => {
            if (event.target === transferModalOverlay) {
                transferModalOverlay.classList.remove('active');
            }
        });
    }

    // Handle clicks on transfer type buttons (from initial selection modal)
    transferOptionButtons.forEach(optionButton => {
        optionButton.addEventListener('click', () => {
            const transferType = optionButton.dataset.transferType;
            if (transferModalOverlay) transferModalOverlay.classList.remove('active'); // Hide initial selection modal

            // Redirect to transfer-form.html with the selected transfer type as a query parameter
            window.location.href = `transfer-form.html?type=${encodeURIComponent(transferType)}`;
        });
    });

    // --- Sidebar Functionality ---
    if (menuIcon) {
        menuIcon.addEventListener('click', () => {
            if (sidebar) sidebar.classList.add('active');
            if (sidebarOverlay) sidebarOverlay.classList.add('active');
        });
    }

    const closeSidebar = () => {
        if (sidebar) sidebar.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    };

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeSidebar);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // Logout Functionality
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();

            // Optional: Call logout API endpoint if you have one
            try {
                // Sending a POST request to logout is a good practice for invalidating sessions on the server
                await fetch(`${API_BASE_URL}/auth/logout`, { // Assuming a logout endpoint
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}` // Send token for server to invalidate it
                    }
                });
            } catch (error) {
                console.error('Error during logout API call (might be expected if token invalid or server unreachable):', error);
                // Continue with client-side logout even if API call fails
            }

            showCustomMessageBox('You have been logged out.', () => {
                // Clear all user session data from localStorage and sessionStorage
                localStorage.removeItem('token');
                localStorage.removeItem('userRole');
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                localStorage.removeItem('fullName');
                sessionStorage.removeItem('userAccounts'); // Clear accounts from session storage

                // Redirect to the login page (index.html)
                window.location.href = 'index.html';
            });
        });
    }

    // Customer Service Button
    if (messageButton) {
        messageButton.addEventListener('click', () => {
            // Redirect to the dedicated customer service page
            window.location.href = 'customer-service.html';
        });
    }

    // --- Initial Data Load ---
    fetchUserData();
});