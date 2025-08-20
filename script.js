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

// --- PART 2: GLOBAL VARIABLES & PARTY NAMES ---
const partyNames = [
    "Korus Computer",
    "Subhadra Industries (MIDC)",
    "Madhur Food Plaza",
    "Nice Computers",
    "Sushila Hospital",
    "Sai Tutorial",
    "Prime Graphite E13",
    "Shreenath Engineering"
];

let currentUser = null;
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

const searchDateInput = document.getElementById('search-date');
const searchByDateButton = document.getElementById('search-by-date-button');
const searchPartyInput = document.getElementById('search-party');
const searchByPartyButton = document.getElementById('search-by-party-button');
const searchResultsContainer = document.getElementById('search-results');

// --- PART 4: AUTHENTICATION ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        authContainer.style.display = 'none';
        appContainer.style.display = 'block';
        initialize_app();
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
function initialize_app() {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    entryDate.value = today;
    currentDateDisplay.textContent = formatDate(today);
    
    // Populate party name suggestions
    partySuggestions.innerHTML = '';
    partyNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        partySuggestions.appendChild(option);
    });
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

entryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newEntry = {
        partyName: partyNameInput.value,
        description: workDescriptionInput.value,
        date: entryDate.value
    };
    dailyEntries.push(newEntry);
    renderDailyEntries();
    entryForm.reset();
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
                </div>
            `;
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
        alert('Day entries saved successfully! ✅');
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

// --- PART 6: SEARCH FUNCTIONALITY ---
searchByDateButton.addEventListener('click', async () => {
    const date = searchDateInput.value;
    if (!date) return;
    
    const querySnapshot = await db.collection('entries')
        .where('userId', '==', currentUser.uid)
        .where('date', '==', date)
        .orderBy('timestamp', 'asc')
        .get();

    renderSearchResults(querySnapshot.docs, `Results for ${formatDate(date)}`);
});

searchByPartyButton.addEventListener('click', async () => {
    const party = searchPartyInput.value;
    if (!party) return;

    const querySnapshot = await db.collection('entries')
        .where('userId', '==', currentUser.uid)
        .where('partyName', '==', party)
        .orderBy('date', 'desc')
        .get();
        
    renderSearchResults(querySnapshot.docs, `Results for "${party}"`);
});

function renderSearchResults(docs, title) {
    searchResultsContainer.innerHTML = '';
    
    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    searchResultsContainer.appendChild(titleEl);

    if (docs.length === 0) {
        searchResultsContainer.innerHTML += '<p>No entries found.</p>';
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
            </div>
        `;
        searchResultsContainer.appendChild(entryElement);
    });
}

// --- PART 7: UTILITY FUNCTIONS ---
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-GB', options);
}

// Initialize the app when the script loads
renderDailyEntries();