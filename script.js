// --- CONFIGURATION START ---
// NOTE: REPLACE THIS WITH THE ACTUAL URL OF YOUR DEPLOYED GOOGLE APPS SCRIPT WEB APP
const GOOGLE_SHEETS_ENDPOINT = '[YOUR_APPS_SCRIPT_WEB_APP_URL]';
// --- CONFIGURATION END ---

// --- PLACEHOLDER DECK DATA ---
// NOTE: YOU MUST HOST A `decks.json` file in your repository with the real data
const DECK_DATA_URL = 'decks.json';
let DECK_CATALOG = [];
const PREFERENCE_COUNT = 4; // Number of deck choices players must submit
let SUBMITTED_NAMES = []; // Global array to hold names fetched from Google Sheet

// Helper function to map color identity to CSS colors
const COLOR_MAP = {
    'W': 'white', 'U': 'blue', 'B': 'black', 'R': 'red', 'G': 'green', 'C': 'grey'
};

// --- DATA FETCHING & UI RENDERING ---

/**
 * Fetches the static deck data from the hosted JSON file.
 */
async function fetchDeckData() {
    try {
        const response = await fetch(DECK_DATA_URL);
        DECK_CATALOG = await response.json();
        console.log(`Loaded ${DECK_CATALOG.length} decks for selection.`);
    } catch (error) {
        console.error("Could not fetch deck data from decks.json. Using fallback data.", error);
        // Fallback placeholder data if file isn't found
        DECK_CATALOG = [
            { id: '1', name: 'Sliver Swarm (WUBRG)', commander_img: 'https://cards.scryfall.io/art/large/front/d/e/de6495b4-477d-4113-9f87-e6f77cc86725.jpg?1562201979', set_code: 'MOC', color_identity: 'WUBRG' },
            { id: '2', name: 'Blast from the Past (URW)', commander_img: 'https://cards.scryfall.io/art/large/front/a/1/a1608920-b30a-4221-a20c-b26a31517454.jpg?1674141666', set_code: 'C21', color_identity: 'UR' },
            { id: '3', name: 'Eldrazi Unbound (C)', commander_img: 'https://cards.scryfall.io/art/large/front/6/8/6817293a-8610-482a-923f-c1f0b09439c2.jpg?1690003881', set_code: 'LCI', color_identity: 'C' },
        ];
    }
}

/**
 * Fetches the list of submitted player names from the Google Apps Script.
 */
async function fetchSubmissionStatus() {
    try {
        const response = await fetch(GOOGLE_SHEETS_ENDPOINT + '?action=get_players');
        const data = await response.json();
        if (data.players) {
            SUBMITTED_NAMES = data.players.map(name => name.trim()); // Array of submitted names
        }
    } catch (error) {
        console.warn("Could not fetch submission status. Status board may not be accurate.", error);
        // SUBMITTED_NAMES remains an empty array if fetch fails
    }
}

/**
 * Gets the list of players from the organizer's input field.
 */
function getLeaguePlayers() {
    const textarea = document.getElementById('league-players');
    if (!textarea) return [];
    
    // Split the input by new lines, filter out empty lines, and trim whitespace
    return textarea.value.split('\n').map(name => name.trim()).filter(name => name.length > 0);
}

/**
 * Renders the submission status board.
 */
function renderStatus() {
    const container = document.getElementById('player-status-container');
    const allPlayers = getLeaguePlayers(); 
    container.innerHTML = '';

    if (allPlayers.length === 0) {
        container.innerHTML = '<p>The organizer needs to input the full league roster in the assignment section.</p>';
        return;
    }
    
    allPlayers.forEach(player => {
        // Case-insensitive check for submitted status
        const hasSubmitted = SUBMITTED_NAMES.some(submittedName => submittedName.toLowerCase() === player.toLowerCase());
        
        const tag = document.createElement('div');
        tag.className = 'player-status-tag ' + (hasSubmitted ? 'player-submitted' : '');
        tag.textContent = player;
        container.appendChild(tag);
    });
}

/**
 * Renders the deck preference inputs with search and custom options.
 */
function renderPreferenceInputs() {
    const container = document.getElementById('deck-preferences-container');
    container.innerHTML = '';

    for (let i = 1; i <= PREFERENCE_COUNT; i++) {
        const html = `
            <div class="form-group" id="group-${i}">
                <label for="deck-search-${i}">Preference #${i}:</label>
                
                <div class="custom-deck-toggle">
                    <input type="checkbox" id="custom-check-${i}" class="custom-deck-checkbox">
                    <label for="custom-check-${i}">Use Custom Deck Name</label>
                </div>

                <div class="deck-search-area">
                    <input type="text" id="deck-search-${i}" class="deck-search" data-rank="${i}" placeholder="Search for a Commander/Deck" required>
                    <input type="hidden" class="deck-id" name="Deck${i}">
                    <div class="deck-details-preview" id="preview-${i}" style="display:none;"></div>
                    <ul class="autocomplete-list" id="list-${i}"></ul>
                </div>

                <div class="custom-deck-area" style="display:none;">
                    <input type="text" id="custom-name-${i}" class="custom-name-input" placeholder="Enter Custom Deck Name (e.g., K'rrik Mono-Black)">
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    }
}

// --- AUTOCONPLETE AND CUSTOM DECK LOGIC ---

function initAutocomplete() {
    document.querySelectorAll('.deck-search').forEach(input => {
        input.addEventListener('input', (e) => handleSearchInput(e.target));
        input.addEventListener('focus', (e) => handleSearchInput(e.target));
        input.addEventListener('blur', (e) => {
            // Delay to allow click on autocomplete item
            setTimeout(() => e.target.nextElementSibling.nextElementSibling.innerHTML = '', 200);
        });
    });
}

function handleSearchInput(input) {
    const query = input.value.toLowerCase();
    const rank = input.dataset.rank;
    const list = document.getElementById(`list-${rank}`);
    list.innerHTML = '';

    if (query.length < 2) return;

    const filtered = DECK_CATALOG.filter(deck => 
        deck.name.toLowerCase().includes(query)
    ).slice(0, 5); // Show top 5 results

    filtered.forEach(deck => {
        const item = document.createElement('li');
        item.textContent = deck.name;
        item.dataset.deckId = deck.id;
        item.dataset.deckName = deck.name;
        item.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent blur event from firing before click
            selectDeck(input, deck);
        });
        list.appendChild(item);
    });
}

function selectDeck(input, deck) {
    const rank = input.dataset.rank;
    const list = document.getElementById(`list-${rank}`);
    const hiddenInput = document.querySelector(`#group-${rank} .deck-id`);
    const previewDiv = document.getElementById(`preview-${rank}`);

    // Set values
    input.value = deck.name;
    hiddenInput.value = deck.name; // Store the deck name as the preference

    // Clear autocomplete
    list.innerHTML = '';

    // Render preview
    renderDeckPreview(previewDiv, deck);
}

function renderDeckPreview(previewDiv, deck) {
    previewDiv.style.display = 'flex';
    previewDiv.innerHTML = `
        <img src="${deck.commander_img || 'placeholder.jpg'}" alt="${deck.name} Commander">
        <div>
            <strong>${deck.name}</strong><br>
            Set: ${deck.set_code || 'N/A'}<br>
            Colors: ${deck.color_identity.split('').map(c => `<span class="color-identity-icon" style="background-color: ${COLOR_MAP[c] || 'transparent'};"></span>`).join('')}
        </div>
    `;
}

function initCustomDeckListeners() {
    document.querySelectorAll('.custom-deck-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const rank = e.target.id.split('-')[2];
            const group = document.getElementById(`group-${rank}`);
            const searchArea = group.querySelector('.deck-search-area');
            const customArea = group.querySelector('.custom-deck-area');
            const searchInput = group.querySelector('.deck-search');
            const hiddenInput = group.querySelector('.deck-id');
            const customInput = group.querySelector('.custom-name-input');
            const previewDiv = document.getElementById(`preview-${rank}`);

            if (e.target.checked) {
                // Switch to Custom Input
                searchArea.style.display = 'none';
                customArea.style.display = 'block';
                searchInput.removeAttribute('required'); 
                customInput.setAttribute('required', 'required'); 
                searchInput.value = ''; 
                hiddenInput.value = ''; // Clear hidden value too
                previewDiv.style.display = 'none'; 
            } else {
                // Switch back to Search Input
                searchArea.style.display = 'block';
                customArea.style.display = 'none';
                customInput.removeAttribute('required');
                customInput.value = ''; 
                searchInput.setAttribute('required', 'required');
            }
        });
    });
}

/**
 * Handles form submission and sends data to Google Apps Script.
 */
async function handleSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const playerName = document.getElementById('player-name').value.trim();
    
    // Build the data object for the Google Sheet
    const formData = new FormData();
    formData.append('PlayerName', playerName);
    formData.append('Timestamp', new Date().toISOString());
    formData.append('action', 'add_submission'); 

    for (let i = 1; i <= PREFERENCE_COUNT; i++) {
        const checkbox = document.getElementById(`custom-check-${i}`);
        const deckKey = `Deck${i}`;

        if (checkbox && checkbox.checked) {
            // Use custom deck input
            const customInput = document.getElementById(`custom-name-${i}`);
            formData.append(deckKey, customInput.value.trim());
        } else {
            // Use search deck input (hidden input stores the name)
            const searchInput = document.querySelector(`#group-${i} .deck-id`);
            formData.append(deckKey, searchInput.value.trim());
        }
    }
    
    const data = new URLSearchParams(formData);

    try {
        const response = await fetch(GOOGLE_SHEETS_ENDPOINT, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data.toString()
        });
        
        alert(`Success! ${playerName}, your ${PREFERENCE_COUNT} deck choices have been submitted. Thank you!`);
        form.reset();
        document.querySelectorAll('.deck-details-preview').forEach(div => div.style.display = 'none');
        await initApp(); 

    } catch (error) {
        console.error('Submission error:', error);
        alert('There was an error submitting your form. Please check the console or contact the organizer.');
    }
}


// --- DECK ASSIGNMENT LOGIC (Organizer Only) ---

document.getElementById('run-assignment').addEventListener('click', runDynamicAllocation);

/**
 * Implements the Dynamic Random Tie-Breaking Logic.
 */
function runDynamicAllocation() {
    const resultsDiv = document.getElementById('assignment-results');
    resultsDiv.innerHTML = '<h3>Allocation Results:</h3>';
    
    // 1. Parse Submission Data
    let submissions;
    try {
        submissions = JSON.parse(document.getElementById('submission-data').value);
    } catch (e) {
        resultsDiv.innerHTML += '<p style="color:red;">Error: Invalid JSON input for submission data.</p>';
        return;
    }

    const totalPlayers = parseInt(document.getElementById('num-players').value);
    if (submissions.length < totalPlayers) {
         resultsDiv.innerHTML += `<p style="color:orange;">Warning: Only ${submissions.length} submissions found for ${totalPlayers} players.</p>`;
    }
    
    let playerPool = submissions.map(s => ({
        name: s.PlayerName,
        // Collect all deck preferences (Deck1, Deck2, etc.)
        preferences: Object.keys(s).filter(k => k.startsWith('Deck')).map(k => s[k]).filter(d => d && d.trim().length > 0),
        deck: null
    }));
    
    let allocatedDecks = new Set();
    let currentRound = 1;

    // Helper function for a single random selection
    const pickRandomWinner = (tiedPlayers) => tiedPlayers[Math.floor(Math.random() * tiedPlayers.length)];

    // Loop until all players who submitted have a deck
    while (playerPool.some(p => p.deck === null)) {
        let remainingPlayers = playerPool.filter(p => p.deck === null);
        let roundPicks = new Map(); // Map: DeckName -> [Player, Player, ...]

        // 1. Identify the highest *available* pick for each remaining player
        remainingPlayers.forEach(player => {
            const highestAvailableDeck = player.preferences.find(deck => !allocatedDecks.has(deck));
            
            if (highestAvailableDeck) {
                if (!roundPicks.has(highestAvailableDeck)) {
                    roundPicks.set(highestAvailableDeck, []);
                }
                roundPicks.get(highestAvailableDeck).push(player);
            }
        });

        if (roundPicks.size === 0) {
            if(remainingPlayers.length > 0) {
                 resultsDiv.innerHTML += `<p style="color:red;">Round ${currentRound}: ${remainingPlayers.length} player(s) remain, but they have no unallocated decks left on their lists.</p>`;
            }
            break;
        }

        let roundWinners = [];
        
        // 2. Resolve picks/ties
        roundPicks.forEach((tiedPlayers, deckName) => {
            if (tiedPlayers.length === 1) {
                // No tie: Allocate deck
                roundWinners.push({ player: tiedPlayers[0], deck: deckName, tie: false });
            } else {
                // Tie: Randomly select winner
                const winner = pickRandomWinner(tiedPlayers);
                roundWinners.push({ player: winner, deck: deckName, tie: true, tiedPlayers: tiedPlayers.length });
            }
        });
        
        // 3. Apply Allocations and Log Results
        let roundLog = `<h4>Round ${currentRound} Results:</h4><ul>`;
        
        roundWinners.forEach(result => {
            const playerIndex = playerPool.findIndex(p => p.name === result.player.name);
            
            if (playerPool[playerIndex].deck === null) {
                playerPool[playerIndex].deck = result.deck;
                allocatedDecks.add(result.deck);
                
                let logMessage = `<li><span style="color: var(--color-success);">${result.player.name}</span> picked <strong>${result.deck}</strong>.`;
                if (result.tie) {
                    logMessage += ` (Won tie-break against ${result.tiedPlayers - 1} other player(s))`;
                } else {
                    logMessage += ` (Uncontested pick)`;
                }
                roundLog += logMessage + '</li>';
            }
        });
        
        roundLog += '</ul>';
        resultsDiv.innerHTML += roundLog;

        currentRound++;
    }

    // 4. Final Output
    const finalResults = playerPool.filter(p => p.deck !== null);
    resultsDiv.innerHTML += `<h3>Final Allocation:</h3>`;
    finalResults.forEach(p => {
        resultsDiv.innerHTML += `<div class="allocation-deck-card">${p.name} gets <span>${p.deck}</span>.</div>`;
    });
}

/**
 * Main application initialization.
 */
async function initApp() {
    // Setup and rendering
    await fetchDeckData();
    renderPreferenceInputs();
    initAutocomplete();
    initCustomDeckListeners();
    
    // Check if endpoint is configured before trying to fetch status
    if (GOOGLE_SHEETS_ENDPOINT !== '[YOUR_APPS_SCRIPT_WEB_APP_URL]') {
        await fetchSubmissionStatus();
    } else {
         console.warn("Google Sheets endpoint not configured.");
    }

    // Add listener to re-render status when player list is updated
    document.getElementById('league-players').addEventListener('input', renderStatus);

    // Initial status render (will show status based on placeholder or fetched data)
    renderStatus();
    
    // Final form listener
    document.getElementById('deck-selection-form').addEventListener('submit', handleSubmit);
}

initApp();
