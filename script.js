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
let partyNames = [];
let dailyEntries = [];

// --- PART 3: DOM ELEMENT REFERENCES ---
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const logoutButton = document.getElementById('logout-button');
const downloadButton = document.getElementById('download-button');

const entryForm = document.getElementById('entry-form');
const entryDate = document.getElementById('entry-date');
const partyNameInput = document.getElementById('party-name');
const workDescriptionInput = document.getElementById('work-description');
const currentDateDisplay = document.getElementById('current-date-display');
const dailyEntriesList = document.getElementById('daily-entries-list');
const submitDayButton = document.getElementById('submit-day-button');
const partySuggestionsBox = document.getElementById('party-suggestions-box');

const searchForm = document.getElementById('search-form');
const searchDateInput = document.getElementById('search-date');
const searchPartyInput = document.getElementById('search-party');
const searchPartySuggestionsBox = document.getElementById('search-party-suggestions-box');
const clearSearchButton = document.getElementById('clear-search-button');
const searchResultsContainer = document.getElementById('search-results');

// --- PART 4: AUTHENTICATION & INITIALIZATION ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
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

function initializeApp() {
    const today = new Date().toISOString().split('T')[0];
    entryDate.value = today;
    currentDateDisplay.textContent = formatDate(today);
    fetchAndPopulatePartyNames();
    renderDailyEntries();
    // Setup Autocomplete Listeners
    setupAutocomplete(partyNameInput, partySuggestionsBox);
    setupAutocomplete(searchPartyInput, searchPartySuggestionsBox);
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    auth.signInWithEmailAndPassword(loginEmail.value, loginPassword.value).catch(error => {
        loginError.textContent = error.message;
    });
});

logoutButton.addEventListener('click', () => auth.signOut());

// --- PART 5: CORE ENTRY LOGIC ---
entryDate.addEventListener('change', () => {
    if (dailyEntries.length > 0 && !confirm("You have unsaved entries. Changing date will clear them. Continue?")) {
        entryDate.value = dailyEntries[0].date;
        return;
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
    await addNewPartyNameIfNeeded(partyName);
    
    entryForm.reset();
    entryDate.value = newEntry.date;
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
        batch.set(entryRef, { ...entry, userId: currentUser.uid, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
    });

    try {
        await batch.commit();
        alert('Day\'s entries saved successfully! ✅');
        generateAndCopyMessage();
        clearDailyEntries();
    } catch (error) {
        console.error("Error saving entries: ", error);
        alert('Failed to save entries. Check console (F12) for an error link to create the required Firebase index.');
    }
});

function generateAndCopyMessage() {
    const date = formatDate(dailyEntries[0].date);
    let message = `${date}\n\n`;
    dailyEntries.forEach((entry, index) => { message += `${index + 1}. ${entry.partyName} - ${entry.description}\n`; });
    message += "\nAll done ✅";

    navigator.clipboard.writeText(message).then(() => {
        alert('Final message copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy message: ', err);
        window.prompt("Please copy this text:", message);
    });
}

// --- PART 6: PARTY NAME & AUTOCOMPLETE ---
async function fetchAndPopulatePartyNames() {
    try {
        const doc = await userPartyListRef.get();
        if (doc.exists && doc.data().names) {
            partyNames = doc.data().names.sort((a, b) => a.localeCompare(b));
        } else {
            await userPartyListRef.set({ names: [] });
            partyNames = [];
        }
    } catch (error) {
        console.error("Error fetching party names:", error);
        alert("Could not load party names. Please check your Firebase Security Rules.");
    }
}

async function addNewPartyNameIfNeeded(newPartyName) {
    const isNew = !partyNames.some(name => name.toLowerCase() === newPartyName.toLowerCase());
    if (isNew) {
        try {
            await userPartyListRef.update({ names: firebase.firestore.FieldValue.arrayUnion(newPartyName) });
            partyNames.push(newPartyName);
            partyNames.sort((a, b) => a.localeCompare(b));
        } catch (error) { console.error("Error adding new party name:", error); }
    }
}

function setupAutocomplete(inputElement, suggestionsBox) {
    inputElement.addEventListener('input', () => {
        const value = inputElement.value.toLowerCase();
        suggestionsBox.innerHTML = '';
        if (!value) {
            suggestionsBox.style.display = 'none';
            return;
        }

        // This filters the list to show any name that INCLUDES the letters you type.
        // This is the "contains" search you wanted.
        const filteredNames = partyNames.filter(name => name.toLowerCase().includes(value));
        
        if (filteredNames.length > 0) {
            filteredNames.forEach(name => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.textContent = name;
                item.addEventListener('click', () => {
                    inputElement.value = name;
                    suggestionsBox.style.display = 'none';
                });
                suggestionsBox.appendChild(item);
            });
            suggestionsBox.style.display = 'block';
        } else {
            suggestionsBox.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (!inputElement.contains(e.target)) {
            suggestionsBox.style.display = 'none';
        }
    });
}

// --- PART 7: SIMPLIFIED SEARCH FUNCTIONALITY ---
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const date = searchDateInput.value;
    const party = searchPartyInput.value.trim();

    if (!date && !party) {
        alert("Please select a date or enter a party name to search.");
        return;
    }

    searchResultsContainer.innerHTML = '<p>Searching...</p>';

    try {
        let query = db.collection('entries').where('userId', '==', currentUser.uid);

        if (party) query = query.where('partyName', '==', party);
        if (date) query = query.where('date', '==', date);
        
        query = query.orderBy('date', 'desc').orderBy('timestamp', 'desc');

        const querySnapshot = await query.get();
        renderSearchResults(querySnapshot.docs);
    } catch (error) {
        console.error("Search error: ", error);
        searchResultsContainer.innerHTML = `<p class="error-message">Search failed. You MUST create a Firestore index. Check the console (F12) for a link.</p>`;
    }
});

clearSearchButton.addEventListener('click', () => {
    searchForm.reset();
    searchResultsContainer.innerHTML = '<p>Use the filters above to search your past entries.</p>';
});

function renderSearchResults(docs) {
    searchResultsContainer.innerHTML = `<h3>Search Results (${docs.length} found)</h3>`;
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

// --- PART 8: DOWNLOAD DATA (Excel/CSV) ---
downloadButton.addEventListener('click', async () => {
    if (!confirm("This will download all your entries. Continue?")) return;
    
    downloadButton.textContent = "Downloading...";
    downloadButton.disabled = true;

    try {
        const querySnapshot = await db.collection('entries')
            .where('userId', '==', currentUser.uid)
            .orderBy('date', 'desc')
            .get();

        const entries = querySnapshot.docs.map(doc => doc.data());
        if (entries.length === 0) {
            alert("No entries to download.");
            return;
        }

        const headers = ["Date", "Party Name", "Work Description"];
        const rows = entries.map(entry => {
            // **FIXED**: Safely handle missing dates and reformat to DD-MM-YYYY
            const rawDate = entry.date; // e.g., "2025-08-21"
            let formattedDate = 'N/A'; // Default value if date is missing
            if (rawDate) {
                const parts = rawDate.split('-');
                if (parts.length === 3) {
                    formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                } else {
                    formattedDate = rawDate; // Fallback to original if format is not YYYY-MM-DD
                }
            }
            
            const partyName = `"${(entry.partyName || '').replace(/"/g, '""')}"`;
            const description = `"${(entry.description || '').replace(/"/g, '""')}"`;
            return [formattedDate, partyName, description].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        const today = new Date().toISOString().split('T')[0];
        link.setAttribute("href", url);
        link.setAttribute("download", `work_entries_${today}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Download failed:", error);
        alert("Could not download data. You may need to create a Firestore index for this operation as well.");
    } finally {
        downloadButton.textContent = "Download Excel";
        downloadButton.disabled = false;
    }
});

// --- PART 9: UTILITY FUNCTIONS ---
function formatDate(dateString) {
    if (!dateString) return 'Invalid Date';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-GB', options);
}
