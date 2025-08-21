// --- PART 1: FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAPGOP0ATGHWVbrFAz1IbjOryIfm3NT3hg",
    authDomain: "fastdataentryapp.firebaseapp.com",
    projectId: "fastdataentryapp",
    storageBucket: "fastdataentryapp.firebasestorage.app",
    messagingSenderId: "31017272526",
    appId: "1:31017272526:web:c69fb1d863b4ca4a303c9f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- PART 2: GLOBAL VARIABLES ---
let currentUser = null;
let userPartyListRef = null;
let partyNames = []; // This will now be fetched from Firestore
let dailyEntries = []; // Temporarily holds entries for the selected day

// --- PART 3: DOM ELEMENT REFERENCES ---
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const logoutButton = document.getElementById('logout-button');

const entryForm = document.getElementById('entry-form');
const entryDate = document.getElementById('entry-date');
const partyNameInput = document.getElementById('party-name');
const workDescriptionInput = document.getElementById('work-description');
const currentDateDisplay = document.getElementById('current-date-display');
const dailyEntriesList = document.getElementById('daily-entries-list');
const submitDayButton = document.getElementById('submit-day-button');
const partySuggestions = document.getElementById('party-suggestions');
const partySuggestionsSearch = document.getElementById('party-suggestions-search');

const searchForm = document.getElementById('search-form');
const searchPartyInput = document.getElementById('search-party');
const searchKeywordInput = document.getElementById('search-keyword');
const searchStartDateInput = document.getElementById('search-start-date');
const searchEndDateInput = document.getElementById('search-end-date');
const clearSearchButton = document.getElementById('clear-search-button');
const searchResultsContainer = document.getElementById('search-results');

// --- PART 4: AUTHENTICATION ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        // Set up a reference to the user's specific party list document
        userPartyListRef = db.collection('partyLists').doc(currentUser.uid);
        authContainer.style.display = 'none';
        appContainer.style.display = 'block';
        initializeApp();
    } else {
        currentUser = null;
        authContainer.style.display = 'block';
        appContainer.style.display = 'none';
    }
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = loginEmail.value;
    const password = loginPassword.value;
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            loginError.textContent = error.message;
        });
});

logoutButton.addEventListener('click', () => {
    auth.signOut();
});

// --- PART 5: CORE APP LOGIC ---
function initializeApp() {
    const today = new Date().toISOString().split('T')[0];
    entryDate.value = today;
    currentDateDisplay.textContent = formatDate(today);
    fetchAndPopulatePartyNames();
    renderDailyEntries(); // Initial render
}

entryDate.addEventListener('change', () => {
    if (dailyEntries.length > 0) {
        if (!confirm("You have unsaved entries. Changing the date will clear them. Continue?")) {
            entryDate.value = dailyEntries[0].date; // Revert date change
            return;
        }
    }
    clearDailyEntries();
    currentDateDisplay.textContent = formatDate(entryDate.value);
});

entryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const partyName = partyNameInput.value.trim();
    if (!partyName) return;

    const newEntry = {
        partyName: partyName,
        description: workDescriptionInput.value,
        date: entryDate.value
    };
    dailyEntries.push(newEntry);
    renderDailyEntries();
    await addNewPartyNameIfNeeded(partyName); // Save new party name if needed
    entryForm.reset();
    entryDate.value = newEntry.date; // Keep the date selector on the current date
    partyNameInput.focus();
});

function renderDailyEntries() {
    dailyEntriesList.innerHTML = '';
    if (dailyEntries.length === 0) {
        dailyEntriesList.innerHTML = '<p style="text-align:center; color: var(--secondary-text-color);">No entries for this day yet.</p>';
        submitDayButton.disabled = true;
    } else {
        dailyEntries.forEach((entry, index) => {
            const entryElement = document.createElement('div');
            entryElement.className = 'entry-item';
            entryElement.innerHTML = `
                <div class="entry-number">${index + 1}.</div>
                <div class="entry-content">
                    <p class="party-name">${entry.partyName}</p>
                    <p class="description">${entry.description}</p>
                </div>`;
            dailyEntriesList.appendChild(entryElement);
        });
        submitDayButton.disabled = false;
    }
}

function clearDailyEntries() {
    dailyEntries = [];
    renderDailyEntries();
}

submitDayButton.addEventListener('click', async () => {
    if (dailyEntries.length === 0) return;

    const batch = db.batch();
    dailyEntries.forEach(entry => {
        const entryRef = db.collection('entries').doc();
        batch.set(entryRef, {
            ...entry,
            userId: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    });

    try {
        await batch.commit();
        alert('Day\'s entries saved successfully! ✅');
        generateAndCopyMessage();
        clearDailyEntries();
    } catch (error) {
        console.error("Error saving entries: ", error);
        alert('Failed to save entries. Please check the console (F12) for an error link and create the required index in Firebase.');
    }
});

function generateAndCopyMessage() {
    const date = formatDate(dailyEntries[0].date);
    let message = `${date}\n\n`;
    dailyEntries.forEach((entry, index) => {
        message += `${index + 1}. ${entry.partyName} - ${entry.description}\n`;
    });
    message += "\nAll done ✅";

    navigator.clipboard.writeText(message).then(() => {
        alert('Final message copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy message: ', err);
        window.prompt("Could not copy automatically. Please copy this text:", message);
    });
}

// --- PART 6: DYNAMIC PARTY NAME MANAGEMENT ---
async function fetchAndPopulatePartyNames() {
    try {
        const doc = await userPartyListRef.get();
        if (doc.exists) {
            partyNames = doc.data().names || [];
            partyNames.sort((a, b) => a.localeCompare(b)); // Sort alphabetically
        } else {
            // If the user has no list, we can pre-populate it with some defaults
            await userPartyListRef.set({ names: ["Default Party 1", "Default Party 2"] });
            partyNames = ["Default Party 1", "Default Party 2"];
        }
        populateDatalists();
    } catch (error) {
        console.error("Error fetching party names:", error);
    }
}

function populateDatalists() {
    partySuggestions.innerHTML = '';
    partySuggestionsSearch.innerHTML = '';
    partyNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        partySuggestions.appendChild(option.cloneNode(true));
        partySuggestionsSearch.appendChild(option);
    });
}

async function addNewPartyNameIfNeeded(newPartyName) {
    const isNew = !partyNames.some(name => name.toLowerCase() === newPartyName.toLowerCase());
    if (isNew) {
        try {
            await userPartyListRef.update({
                names: firebase.firestore.FieldValue.arrayUnion(newPartyName)
            });
            // Update local list immediately for responsiveness
            partyNames.push(newPartyName);
            partyNames.sort((a, b) => a.localeCompare(b));
            populateDatalists();
            console.log(`Added new party: ${newPartyName}`);
        } catch (error) {
            console.error("Error adding new party name:", error);
        }
    }
}

// --- PART 7: ENHANCED SEARCH FUNCTIONALITY ---
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const party = searchPartyInput.value.trim();
    const keyword = searchKeywordInput.value.trim().toLowerCase();
    const startDate = searchStartDateInput.value;
    const endDate = searchEndDateInput.value;

    searchResultsContainer.innerHTML = '<p>Searching...</p>';

    try {
        let query = db.collection('entries').where('userId', '==', currentUser.uid);

        // Apply Firestore filters
        if (party) query = query.where('partyName', '==', party);
        if (startDate) query = query.where('date', '>=', startDate);
        if (endDate) query = query.where('date', '<=', endDate);
        
        // Always sort results
        query = query.orderBy('date', 'desc').orderBy('timestamp', 'desc');

        const querySnapshot = await query.get();
        let docs = querySnapshot.docs;

        // Apply client-side keyword filter (if provided)
        if (keyword) {
            docs = docs.filter(doc => 
                doc.data().description.toLowerCase().includes(keyword)
            );
        }

        renderSearchResults(docs, 'Search Results');
    } catch (error) {
        console.error("Search error: ", error);
        searchResultsContainer.innerHTML = `<p class="error-message">Search failed. You might need to create a Firestore index. Check the console (F12) for a link.</p>`;
    }
});

clearSearchButton.addEventListener('click', () => {
    searchForm.reset();
    searchResultsContainer.innerHTML = '<p>Use the filters above to search your past entries.</p>';
});


function renderSearchResults(docs, title) {
    searchResultsContainer.innerHTML = '';
    
    const titleEl = document.createElement('h3');
    titleEl.textContent = `${title} (${docs.length} found)`;
    searchResultsContainer.appendChild(titleEl);

    if (docs.length === 0) {
        searchResultsContainer.innerHTML += '<p>No entries found matching your criteria.</p>';
        return;
    }

    let currentGroupDate = null;
    docs.forEach(doc => {
        const data = doc.data();
        if (data.date !== currentGroupDate) {
            currentGroupDate = data.date;
            const dateEl = document.createElement('p');
            dateEl.className = 'search-result-date';
            dateEl.textContent = formatDate(currentGroupDate);
            searchResultsContainer.appendChild(dateEl);
        }

        const entryElement = document.createElement('div');
        entryElement.className = 'entry-item';
        entryElement.innerHTML = `
            <div class="entry-number" style="color: var(--secondary-text-color);">#</div>
            <div class="entry-content">
                <p class="party-name">${data.partyName}</p>
                <p class="description">${data.description}</p>
            </div>`;
        searchResultsContainer.appendChild(entryElement);
    });
}

// --- PART 8: UTILITY FUNCTIONS ---
function formatDate(dateString) {
    if (!dateString) return 'Invalid Date';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-GB', options);
}
