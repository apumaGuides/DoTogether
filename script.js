// Import Firebase modules from Cloud Firestore SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

/******************************************************
 * script.js
 *
 * This version uses Cloud Firestore for real-time sync.
 * All other UI/UX features remain the same.
 ******************************************************/

// Firebase configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyAAlLefCz9sUr_buvkg4UysrB571WFtZMI",
  authDomain: "todogether-eea6b.firebaseapp.com",
  projectId: "todogether-eea6b",
  storageBucket: "todogether-eea6b.firebasestorage.app",
  messagingSenderId: "37718791621",
  appId: "1:37718791621:web:2d5614de0fedd5077227ac",
  measurementId: "G-HTMX5ZJJM4"
};

// Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global variables for events and selected event (for deletion via Delete key)
let myEvents = [];
let friendEvents = [];
let currentSelectedEvent = null;

// On load, initialize UI and Firestore listeners
window.addEventListener('DOMContentLoaded', () => {
  displayCurrentDate();
  setupButtons();
  generateTimeline();
  generateTimeSlotLines('my-time-slots');
  generateTimeSlotLines('friend-time-slots');
  setupRealtimeListeners();
  addEventContainerDropHandlers();
  startCurrentTimeLineUpdater();
  addEmptySpaceClickHandlers();
  document.addEventListener('keydown', handleDeleteKey);
});

/**
 * Display today's date.
 */
function displayCurrentDate() {
  const currentDateEl = document.getElementById('current-date');
  const today = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  currentDateEl.textContent = today.toLocaleDateString(undefined, options);
}

/**
 * Setup top buttons.
 */
function setupButtons() {
  document.getElementById('prev-day').addEventListener('click', () => {
    console.log("Previous Day clicked");
  });
  document.getElementById('next-day').addEventListener('click', () => {
    console.log("Next Day clicked");
  });
  document.getElementById('rename-calendars').addEventListener('click', renameCalendars);
  document.getElementById('change-background').addEventListener('click', changeBackground);
  document.getElementById('save-event').addEventListener('click', addNewEvent);
}

/**
 * Rename calendar titles.
 */
function renameCalendars() {
  const myTitle = prompt("Enter new title for your calendar:", "My Schedule");
  if (myTitle !== null) {
    document.getElementById('my-calendar-title').textContent = myTitle;
  }
  const friendTitle = prompt("Enter new title for your friend's calendar:", "Friend's Schedule");
  if (friendTitle !== null) {
    document.getElementById('friend-calendar-title').textContent = friendTitle;
  }
}

/**
 * Change the page background.
 */
function changeBackground() {
  const choice = prompt("Select background:\n1) Background 1\n2) Background 2");
  let bgUrl = "";
  if (choice === "1") {
    bgUrl = "BackgroundImages/imageB1.png";
  } else if (choice === "2") {
    bgUrl = "BackgroundImages/imageB2.png";
  } else {
    return;
  }
  document.body.style.backgroundImage = `url('${bgUrl}')`;
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundRepeat = "no-repeat";
  document.body.style.opacity = "0.95";
}

/**
 * Generate hour labels (0:00 to 23:00).
 */
function generateTimeline() {
  const timelineEl = document.getElementById('timeline');
  for (let hour = 0; hour < 24; hour++) {
    const label = document.createElement('div');
    label.classList.add('time-label');
    label.textContent = `${String(hour).padStart(2, '0')}:00`;
    timelineEl.appendChild(label);
  }
}

/**
 * Draw horizontal lines for half-hour segments.
 */
function generateTimeSlotLines(containerId) {
  const container = document.getElementById(containerId);
  for (let i = 0; i < 48; i++) {
    const line = document.createElement('div');
    line.classList.add('time-slot-line');
    line.style.top = (i * 20) + 'px';
    container.appendChild(line);
  }
}

/**
 * Set up real-time listener for events from Firestore.
 * We use a single document "events" in collection "calendar" to store our events.
 */
function setupRealtimeListeners() {
  const eventsDocRef = doc(db, "calendar", "events");
  onSnapshot(eventsDocRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      myEvents = data.myEvents || [];
      friendEvents = data.friendEvents || [];
    } else {
      // If no document exists, initialize with sample data
      myEvents = [
        { startTime: "08:00", endTime: "10:00", description: "Morning Meeting", done: false, image: "" },
        { startTime: "14:00", endTime: "16:00", description: "Project Work", done: false, image: "" }
      ];
      friendEvents = [
        { startTime: "09:30", endTime: "10:30", description: "Doctor Appointment", done: false, image: "" },
        { startTime: "10:30", endTime: "12:00", description: "Gym Session", done: false, image: "" },
        { startTime: "15:00", endTime: "16:00", description: "Coffee with Friends", done: false, image: "" }
      ];
      updateFirebase();
    }
    renderEvents();
  });
}

/**
 * Render events in their respective containers.
 */
function renderEvents() {
  clearCalendar('my-events-container');
  clearCalendar('friend-events-container');
  myEvents.forEach((event, index) => {
    renderEvent(event, 'my-events-container', index, false);
  });
  friendEvents.forEach((event, index) => {
    renderEvent(event, 'friend-events-container', index, true);
  });
}

/**
 * Clear events from a container.
 */
function clearCalendar(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
}

/**
 * Render a single event as an absolutely positioned block.
 */
function renderEvent(event, containerId, index, isFriend) {
  const container = document.getElementById(containerId);
  const startMin = parseTime(event.startTime);
  const endMin = parseTime(event.endTime);
  const duration = endMin - startMin;

  const eventEl = document.createElement('div');
  eventEl.classList.add('event');
  if (isFriend) eventEl.classList.add('friend-event');

  // Apply image class if selected
  if (event.image) {
    eventEl.classList.add(event.image);
  }

  // Highlight current event if applicable
  const now = getMinutesSinceMidnight();
  if (now >= startMin && now < endMin) {
    eventEl.classList.add('current-event');
  }

  // Make event draggable
  eventEl.draggable = true;
  eventEl.dataset.index = index;
  eventEl.dataset.user = isFriend ? "friend" : "my";
  eventEl.dataset.duration = duration;
  eventEl.addEventListener('dragstart', onDragStart);

  // Positioning (ratio = 960/1440 = 0.6667px per minute)
  const ratio = 960 / 1440;
  eventEl.style.top = (startMin * ratio) + 'px';
  eventEl.style.height = (duration * ratio) + 'px';

  // Checkbox for marking completion
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = event.done;
  checkbox.addEventListener("change", () => {
    event.done = checkbox.checked;
    updateFirebase();
  });

  // Description text
  const descSpan = document.createElement("span");
  descSpan.textContent = event.description;

  eventEl.appendChild(checkbox);
  eventEl.appendChild(descSpan);

  // Display comment if present
  if (event.comment) {
    const commentEl = document.createElement("div");
    commentEl.classList.add("comment");
    commentEl.textContent = event.comment;
    eventEl.appendChild(commentEl);
  }

  // On click, select event and prompt for actions (rename or add comment)
  eventEl.addEventListener("click", () => {
    handleEventClick(event, eventEl);
  });

  container.appendChild(eventEl);
}

/**
 * Handle event click: select event and prompt for rename or comment.
 */
function handleEventClick(eventObj, eventEl) {
  clearSelectedEvent();
  eventEl.classList.add('selected');
  currentSelectedEvent = { eventObj: eventObj, index: eventEl.dataset.index, user: eventEl.dataset.user };
  const action = prompt(
    `Event: "${eventObj.description}"\nChoose an action:\n1) Rename\n2) Add Comment\n(Then press Delete key to remove)`
  );
  if (action === "1") {
    const newName = prompt("Enter new description:", eventObj.description);
    if (newName !== null && newName.trim() !== "") {
      eventObj.description = newName;
      updateFirebase();
    }
  } else if (action === "2") {
    const comment = prompt("Enter comment:", eventObj.comment || "");
    if (comment !== null) {
      eventObj.comment = comment;
      updateFirebase();
    }
  }
}

/**
 * Clear any selected event.
 */
function clearSelectedEvent() {
  document.querySelectorAll('.event.selected').forEach(el => el.classList.remove('selected'));
  currentSelectedEvent = null;
}

/**
 * Handle Delete key press to delete selected event.
 */
function handleDeleteKey(e) {
  if (e.key === "Delete" && currentSelectedEvent) {
    deleteEvent(currentSelectedEvent.user, parseInt(currentSelectedEvent.index));
    currentSelectedEvent = null;
  }
}

/**
 * Delete an event.
 */
function deleteEvent(user, index) {
  if (user === "my") {
    myEvents.splice(index, 1);
  } else {
    friendEvents.splice(index, 1);
  }
  updateFirebase();
}

/**
 * Add new event from the form.
 */
function addNewEvent() {
  const description = document.getElementById("event-description").value;
  const user = document.getElementById("event-user").value;
  const startTime = document.getElementById("start-time").value;
  const endTime = document.getElementById("end-time").value;
  const image = document.getElementById("event-image").value;  // new field

  if (!description || !startTime || !endTime) {
    alert("Please fill in all fields.");
    return;
  }

  const newEvent = {
    startTime: startTime,
    endTime: endTime,
    description: description,
    done: false,
    image: image
  };

  if (user === "my") {
    myEvents.push(newEvent);
  } else {
    friendEvents.push(newEvent);
  }
  updateFirebase();

  // Clear form fields
  document.getElementById("event-description").value = "";
  document.getElementById("start-time").value = "";
  document.getElementById("end-time").value = "";
  document.getElementById("event-image").value = "";
}

/**
 * Update events in Firestore.
 * We store our events in a single document "events" inside the "calendar" collection.
 */
async function updateFirebase() {
  await setDoc(doc(db, "calendar", "events"), {
    myEvents: myEvents,
    friendEvents: friendEvents
  });
}

/**
 * Convert "HH:MM" to minutes since midnight.
 */
function parseTime(str) {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Return current time in minutes since midnight.
 */
function getMinutesSinceMidnight() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/* =========================================
   DRAG & DROP LOGIC
   ========================================= */

/**
 * When dragging starts, store event data.
 */
function onDragStart(e) {
  const index = e.target.dataset.index;
  const user = e.target.dataset.user;
  const duration = e.target.dataset.duration;
  e.dataTransfer.setData("text/plain", JSON.stringify({ index, user, duration }));
}

/**
 * Allow drop by preventing default.
 */
function onDragOver(e) {
  e.preventDefault();
}

/**
 * When an event is dropped, calculate its new start time.
 */
function onDrop(e) {
  e.preventDefault();
  const container = e.currentTarget;
  const rect = container.getBoundingClientRect();
  const dropY = e.clientY - rect.top;
  const ratio = 960 / 1440;
  let newStartMin = Math.round(dropY / ratio);
  const data = JSON.parse(e.dataTransfer.getData("text/plain"));
  const duration = parseInt(data.duration, 10);
  const newStartStr = toHHMM(newStartMin);
  const newEndStr = toHHMM(newStartMin + duration);

  if (data.user === "my") {
    myEvents[data.index].startTime = newStartStr;
    myEvents[data.index].endTime = newEndStr;
  } else {
    friendEvents[data.index].startTime = newStartStr;
    friendEvents[data.index].endTime = newEndStr;
  }
  updateFirebase();
}

/**
 * Helper: Convert minutes since midnight to "HH:MM" string.
 */
function toHHMM(totalMinutes) {
  if (totalMinutes < 0) totalMinutes = 0;
  if (totalMinutes > 1439) totalMinutes = 1439;
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return String(hh).padStart(2, '0') + ":" + String(mm).padStart(2, '0');
}

/**
 * Add drop handlers to event containers.
 */
function addEventContainerDropHandlers() {
  document.querySelectorAll('.events-container').forEach(container => {
    container.addEventListener('dragover', onDragOver);
    container.addEventListener('drop', onDrop);
  });
}

/**
 * Detect clicks on empty space to prompt new event creation.
 */
function addEmptySpaceClickHandlers() {
  const mySlots = document.getElementById('my-time-slots');
  mySlots.addEventListener('click', (e) => {
    if (e.target === mySlots) {
      createEventPrompt("my");
    }
  });
  const friendSlots = document.getElementById('friend-time-slots');
  friendSlots.addEventListener('click', (e) => {
    if (e.target === friendSlots) {
      createEventPrompt("friend");
    }
  });
}

/**
 * Prompt the user to add a new event.
 */
function createEventPrompt(user) {
  const description = prompt("Enter event description:");
  if (!description) return;
  const startTime = prompt("Start time (HH:MM):", "09:00");
  if (!startTime) return;
  const endTime = prompt("End time (HH:MM):", "10:00");
  if (!endTime) return;

  const newEvent = {
    startTime,
    endTime,
    description,
    done: false,
    image: ""
  };

  if (user === "my") {
    myEvents.push(newEvent);
  } else {
    friendEvents.push(newEvent);
  }
  updateFirebase();
}

/* =========================================
   CURRENT TIME RED LINE UPDATER
   ========================================= */
function startCurrentTimeLineUpdater() {
  updateCurrentTimeLine();
  setInterval(updateCurrentTimeLine, 60 * 1000);
}

function updateCurrentTimeLine() {
  const lineEl = document.getElementById('current-time-line');
  const nowMin = getMinutesSinceMidnight();
  const ratio = 960 / 1440;
  let topOffset = nowMin * ratio;
  if (topOffset < 0) topOffset = 0;
  if (topOffset > 960) topOffset = 960;
  lineEl.style.top = topOffset + "px";
  renderEvents();
}
