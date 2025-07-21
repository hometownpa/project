// cards.js

const API_BASE_URL = 'http://localhost:5000/api'; // IMPORTANT: Replace with your actual backend API URL

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element Selections ---
    const userCardList = document.getElementById('userCardList');
    const cardsLoadingMessage = document.getElementById('cardsLoadingMessage');
    const noCardsMessage = document.getElementById('noCardsMessage');
    const orderCardForm = document.getElementById('orderCardForm');
    const orderCardSubmitButton = orderCardForm ? orderCardForm.querySelector('button[type="submit"]') : null;

    // --- Custom Message Box Implementation ---
    // Dynamically create the message box if it doesn't exist in HTML
    let messageBoxOverlay = document.getElementById('messageBoxOverlay');
    let messageBoxContentElement; // Renamed to avoid conflict with function parameter

    if (!messageBoxOverlay) { // This block will run if the HTML element is not found
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
        messageBoxOverlay.classList.add('active'); // Use class to toggle opacity/visibility

        // Remove previous listeners and attach new one to prevent multiple calls
        const newMessageBoxButton = messageBoxButton.cloneNode(true);
        messageBoxButton.parentNode.replaceChild(newMessageBoxButton, messageBoxButton);

        newMessageBoxButton.addEventListener('click', () => {
            messageBoxOverlay.classList.remove('active');
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

    // --- Fetch and Render User Cards ---
    async function fetchUserCards() {
        if (cardsLoadingMessage) cardsLoadingMessage.style.display = 'block';
        if (noCardsMessage) noCardsMessage.style.display = 'none'; // Hide "no cards" message initially
        if (userCardList) userCardList.innerHTML = ''; // Clear previous cards

        try {
            const response = await fetch(`${API_BASE_URL}/user/cards`, { // Assuming this is your endpoint for user cards
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    showCustomMessageBox('Session expired or unauthorized. Please log in again.', () => {
                        localStorage.clear(); // Clear all user data
                        sessionStorage.clear();
                        window.location.href = 'index.html';
                    });
                } else {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
            }

            const data = await response.json();
            console.log('Fetched user cards:', data);

            renderCards(data.cards || []); // Ensure 'cards' array is handled, even if empty

        } catch (error) {
            console.error('Error fetching user cards:', error);
            showCustomMessageBox('Failed to load your cards. Please try again later.');
            if (userCardList) userCardList.innerHTML = '<p class="no-data-message">Failed to load cards.</p>';
        } finally {
            if (cardsLoadingMessage) cardsLoadingMessage.style.display = 'none';
        }
    }

    function renderCards(cards) {
        if (!userCardList) return;

        userCardList.innerHTML = ''; // Clear existing cards

        if (cards.length === 0) {
            if (noCardsMessage) noCardsMessage.style.display = 'block';
            return;
        } else {
            if (noCardsMessage) noCardsMessage.style.display = 'none';
        }

        cards.forEach(card => {
            const cardElement = document.createElement('div');
            // Add classes based on card type and status for styling
            cardElement.classList.add('card-item', `${card.network?.toLowerCase()}-card`, `${card.type?.toLowerCase()}-card`, card.status?.toLowerCase());
            cardElement.dataset.cardId = card.id; // Store card ID for actions

            // Mask card number for display
            const displayedCardNumber = card.cardNumber ? `**** **** **** ${String(card.cardNumber).slice(-4)}` : '**** **** **** ****';
            
            // Format expiry date
            let formattedExpiry = 'N/A';
            if (card.expiryDate) {
                if (card.expiryDate.includes('-')) { // Assuming YYYY-MM-DD
                    const [year, month] = card.expiryDate.split('-');
                    formattedExpiry = `${month}/${year.slice(-2)}`;
                } else if (card.expiryDate.includes('/')) { // Assuming MM/YY or MM/YYYY
                     formattedExpiry = card.expiryDate;
                } else { // Assume it's just a YYYYMMDD string or similar, take last 4 as MMYY
                    const year = String(card.expiryDate).slice(-2);
                    const month = String(card.expiryDate).slice(-4, -2);
                    formattedExpiry = `${month}/${year}`;
                }
            }

            // Determine Freeze/Unfreeze button text and class
            const isFrozen = card.status?.toLowerCase() === 'frozen';
            const freezeButtonText = isFrozen ? '<i class="fas fa-snowflake"></i> Unfreeze' : '<i class="fas fa-snowflake"></i> Freeze';
            const freezeButtonClass = isFrozen ? 'unfreeze-btn' : 'freeze-btn';

            cardElement.innerHTML = `
                <div class="card-chip"></div>
                <div class="card-network-logo">${card.network ? card.network.toUpperCase() : 'CARD'}</div>
                <p class="card-number">${displayedCardNumber}</p>
                <div class="card-details-row">
                    <p class="card-holder-name">Holder: <span>${card.cardHolderName || 'N/A'}</span></p>
                    <p class="card-expiry">Expires: <span>${formattedExpiry}</span></p>
                </div>
                <div class="card-type-status">
                    <p class="card-type">${card.type || 'Generic'} Card</p>
                    <p class="card-status ${card.status ? card.status.toLowerCase() : 'active'}">Status: ${card.status || 'Active'}</p>
                </div>
                <div class="card-actions">
                    <button class="action-btn ${freezeButtonClass}" data-action="toggle-freeze">${freezeButtonText}</button>
                    <button class="action-btn report-btn" data-action="report-lost-stolen"><i class="fas fa-exclamation-triangle"></i> Report Lost/Stolen</button>
                    </div>
            `;
            userCardList.appendChild(cardElement);
        });

        // Attach event listeners to newly rendered action buttons
        userCardList.querySelectorAll('.action-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const cardId = event.target.closest('.card-item').dataset.cardId;
                const action = event.target.dataset.action;
                handleCardAction(cardId, action);
            });
        });
    }

    // --- Card Management Actions (Freeze/Unfreeze, Report Lost/Stolen) ---
    async function handleCardAction(cardId, action) {
        let endpoint = '';
        let method = 'PUT'; // Most status changes are PUT
        let body = {};
        let confirmationMessage = '';
        let successMessage = '';

        const currentCardElement = userCardList.querySelector(`[data-card-id="${cardId}"]`);
        const currentStatus = currentCardElement ? currentCardElement.classList.contains('frozen') ? 'frozen' : 'active' : 'active'; // Simple check

        switch (action) {
            case 'toggle-freeze':
                const newStatus = currentStatus === 'frozen' ? 'active' : 'frozen';
                endpoint = `${API_BASE_URL}/cards/${cardId}/status`;
                body = { status: newStatus };
                confirmationMessage = `Are you sure you want to ${newStatus === 'frozen' ? 'freeze' : 'unfreeze'} this card?`;
                successMessage = `Card successfully ${newStatus === 'frozen' ? 'frozen' : 'unfrozen'}.`;
                break;
            case 'report-lost-stolen':
                endpoint = `${API_BASE_URL}/cards/${cardId}/status`;
                body = { status: 'lost' }; // Or 'stolen'
                confirmationMessage = `Are you sure you want to report this card as lost/stolen? This action is usually irreversible.`;
                successMessage = 'Card reported as lost/stolen. A new card order may be initiated.';
                break;
            case 'view-pin': // Example for a sensitive action, typically not direct display
                showCustomMessageBox('PIN retrieval is not available for security reasons. Please contact customer service or request a PIN reminder via mail if available.');
                return; // Exit as no API call needed for this placeholder
            default:
                showCustomMessageBox('Unknown card action.');
                return;
        }

        showCustomMessageBox(confirmationMessage, async () => {
            try {
                // Disable button during processing
                const actionButton = currentCardElement.querySelector(`[data-action="${action}"]`);
                if(actionButton) {
                    actionButton.disabled = true;
                    actionButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; // Show spinner
                }

                const response = await fetch(endpoint, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(body)
                });

                const result = await response.json();

                if (response.ok) {
                    showCustomMessageBox(successMessage, fetchUserCards); // Re-fetch cards to update display
                } else {
                    let errorMessage = result.message || `Failed to perform action: ${action}`;
                    showCustomMessageBox(errorMessage);
                }
            } catch (error) {
                console.error('Error performing card action:', error);
                showCustomMessageBox('Network error or server unreachable. Please try again.');
            } finally {
                // Re-enable button regardless of success/failure
                const actionButton = currentCardElement.querySelector(`[data-action="${action}"]`);
                if(actionButton) {
                    actionButton.disabled = false;
                    // Reset button text based on action and potential new status
                    // Note: This won't reflect the *new* status if the fetchUserCards hasn't completed and re-rendered
                    // For a more immediate visual update without re-fetching, you'd update the specific card's DOM elements here.
                    if (action === 'toggle-freeze') {
                         actionButton.innerHTML = (currentStatus === 'frozen') ? '<i class="fas fa-snowflake"></i> Freeze' : '<i class="fas fa-snowflake"></i> Unfreeze';
                    } else if (action === 'report-lost-stolen') {
                        actionButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Report Lost/Stolen';
                    }
                }
            }
        });
    }

    // --- Order New Card Functionality ---
    if (orderCardForm) {
        orderCardForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const cardType = document.getElementById('cardType').value;
            const cardNetwork = document.getElementById('cardNetwork').value;
            const shippingAddress = document.getElementById('shippingAddress').value.trim();

            if (!cardType || !cardNetwork || !shippingAddress) {
                showCustomMessageBox('Please fill in all fields to order a new card.');
                return;
            }

            const orderData = {
                cardType: cardType,
                cardNetwork: cardNetwork,
                shippingAddress: shippingAddress
            };

            showCustomMessageBox('Confirm card order: \n' +
                                  `Type: ${cardType} ${cardNetwork}\n` +
                                  `Ship to: ${shippingAddress}\n\n` +
                                  'Do you want to proceed?', async () => {
                try {
                    if (orderCardSubmitButton) {
                        orderCardSubmitButton.disabled = true;
                        orderCardSubmitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ordering...';
                    }

                    const response = await fetch(`${API_BASE_URL}/cards/order`, { // Assuming this is your card order endpoint
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(orderData)
                    });

                    const result = await response.json();

                    if (response.ok) {
                        // Enhanced success message
                        showCustomMessageBox('Your new card order has been placed successfully!\n\n' +
                                            'It will be delivered to your address within 7 business days.\n' +
                                            'A confirmation email has also been sent to your registered account.', () => {
                            orderCardForm.reset(); // Clear form
                            fetchUserCards(); // Re-fetch cards to show the newly ordered one (if backend instantly adds it)
                        });
                    } else {
                        let errorMessage = result.message || 'Failed to place card order. Please try again.';
                        showCustomMessageBox(errorMessage);
                    }

                } catch (error) {
                    console.error('Error placing card order:', error);
                    showCustomMessageBox('Network error or server unreachable. Please try again.');
                } finally {
                    if (orderCardSubmitButton) {
                        orderCardSubmitButton.disabled = false;
                        orderCardSubmitButton.innerHTML = '<i class="fas fa-credit-card" style="margin-right: 8px;"></i> Place Card Order';
                    }
                }
            });
        });
    }

    // --- Initial Data Load ---
    fetchUserCards();
});