/******************************************************
 * script.js
 *
 * Key Changes vs. Previous Version:
 *  1) Each calendar has a fixed height of 960px (48 half-hour slots * 20px).
 *  2) We display hour lines more compactly (each hour = 40px tall).
 *  3) A single continuous event block is absolutely positioned from
 *     start -> end, rather than duplicated in each 30-min slot.
 *  4) Clicking empty space => prompt to add a new event.
 *  5) Red line uses new scale: 960px / 1440min = 0.6667 px per minute.
 *  6) Thicker "current event" outline, bigger event area, background image.
 *  7) "My Schedule" and "Friend's Schedule" are renameable.
 *  8) New: Pre-selectable event images with blended backgrounds.
 ******************************************************/

let myEvents = [];
let friendEvents = [];

// On load
window.addEventListener('DOMContentLoaded', () => {
  displayCurrentDate();
  setupButtons();
  generateTimeline();
  generateTimeSlotLines('my-time-slots');
  generateTimeSlotLines('friend-time-slots');
  loadEventsFromStorage();
  renderEvents();
  startCurrentTimeLineUpdater();
  addEmptySpaceClickHandlers();
});

/**
 * Display today's date in a nice format
 */
function displayCurrentDate() {
  const currentDateEl = document.getElementById('current-date');
  const today = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  currentDateEl.textContent = today.toLocaleDateString(undefined, options);
}

/**
 * Setup top buttons (Prev/Next Day, Rename Calendars, etc.)
 */
function setupButtons() {
  document.getElementById('prev-day').addEventListener('click', () => {
    console.log("Previous Day clicked");
  });
  document.getElementById('next-day').addEventListener('click', () => {
    console.log("Next Day clicked");
  });
  document.getElementById('rename-calendars').addEventListener('click', renameCalendars);
  document.getElementById('save-event').addEventListener('click', addNewEvent);
}

/**
 * Let user rename the calendar titles
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
 * Generate hour labels from 0:00 -> 23:00 in 24h format.
 * Each label is 40px tall => total 960px for 24 hours.
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
 * Draw the horizontal lines for half-hour segments.
 * 48 half-hours => each line at top: i * 20px
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
 * Load from localStorage or use sample data
 */
function loadEventsFromStorage() {
  const storedMyEvents = localStorage.getItem('myEvents');
  const storedFriendEvents = localStorage.getItem('friendEvents');
  if (storedMyEvents && storedFriendEvents) {
    myEvents = JSON.parse(storedMyEvents);
    friendEvents = JSON.parse(storedFriendEvents);
  } else {
    // Sample data
    myEvents = [
      { startTime: "08:00", endTime: "10:00", description: "Morning Meeting", done: false, image: "" },
      { startTime: "14:00", endTime: "16:00", description: "Project Work", done: false, image: "" }
    ];
    friendEvents = [
      { startTime: "09:30", endTime: "10:30", description: "Doctor Appointment", done: false, image: "" },
      { startTime: "10:30", endTime: "12:00", description: "Gym Session", done: false, image: "" },
      { startTime: "15:00", endTime: "16:00", description: "Coffee with Friends", done: false, image: "" }
    ];
  }
}

/**
 * Render both sets of events in their respective containers.
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
 * Clear all events from a container
 */
function clearCalendar(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
}

/**
 * Render a single event as an absolutely positioned block from start -> end.
 * Positioning: top = (start in minutes) * (960/1440) and height = (duration in minutes) * (960/1440).
 */
function renderEvent(event, containerId, index, isFriend) {
  const container = document.getElementById(containerId);
  const startMin = parseTime(event.startTime);
  const endMin = parseTime(event.endTime);
  const duration = endMin - startMin;

  const eventEl = document.createElement('div');
  eventEl.classList.add('event');
  if (isFriend) eventEl.classList.add('friend-event');

  // NEW: Apply the image class if selected
  if (event.image) {
    eventEl.classList.add(event.image);
  }

  // Highlight current event
  const now = getMinutesSinceMidnight();
  if (now >= startMin && now < endMin) {
    eventEl.classList.add('current-event');
  }

  // Draggable properties
  eventEl.draggable = true;
  eventEl.dataset.index = index;
  eventEl.dataset.user = isFriend ? "friend" : "my";
  eventEl.dataset.duration = duration;
  eventEl.addEventListener('dragstart', onDragStart);

  // Positioning
  const ratio = 960 / 1440;
  const topPx = startMin * ratio;
  const heightPx = duration * ratio;
  eventEl.style.top = topPx + 'px';
  eventEl.style.height = heightPx + 'px';

  // Checkbox for marking done
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = event.done;
  checkbox.addEventListener("change", () => {
    event.done = checkbox.checked;
    saveEventsToStorage();
  });

  // Description text
  const descSpan = document.createElement("span");
  descSpan.textContent = event.description;

  // On click: rename or delete
  eventEl.addEventListener("click", () => {
    handleEventClick(event, eventEl);
  });

  // Append checkbox and text, then add event element to container
  eventEl.appendChild(checkbox);
  eventEl.appendChild(descSpan);
  container.appendChild(eventEl);
}

/**
 * Handle event click: rename or delete
 */
function handleEventClick(eventObj, eventEl) {
  const action = prompt(
    `Event: "${eventObj.description}"\n` +
    `Choose an action:\n` +
    `1) Delete\n` +
    `2) Rename\n` +
    `(Cancel = do nothing)`
  );
  if (action === "1") {
    deleteEvent(eventEl.dataset.user, parseInt(eventEl.dataset.index));
  } else if (action === "2") {
    const newName = prompt("Enter new description:", eventObj.description);
    if (newName !== null && newName.trim() !== "") {
      eventObj.description = newName;
      saveEventsToStorage();
      renderEvents();
    }
  }
}

/**
 * Delete an event from the respective array
 */
function deleteEvent(user, index) {
  if (user === "my") {
    myEvents.splice(index, 1);
  } else {
    friendEvents.splice(index, 1);
  }
  saveEventsToStorage();
  renderEvents();
}

/**
 * Add new event from the form
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
    image: image  // store the selected image key
  };

  if (user === "my") {
    myEvents.push(newEvent);
  } else {
    friendEvents.push(newEvent);
  }

  saveEventsToStorage();
  renderEvents();

  // Clear form fields
  document.getElementById("event-description").value = "";
  document.getElementById("start-time").value = "";
  document.getElementById("end-time").value = "";
  document.getElementById("event-image").value = "";
}

/**
 * Save to localStorage
 */
function saveEventsToStorage() {
  localStorage.setItem('myEvents', JSON.stringify(myEvents));
  localStorage.setItem('friendEvents', JSON.stringify(friendEvents));
}

/**
 * Convert "HH:MM" to minutes since midnight
 */
function parseTime(str) {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Return current time in minutes since midnight
 */
function getMinutesSinceMidnight() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/* =========================================
   DRAG & DROP LOGIC
   ========================================= */
function onDragStart(e) {
  const index = e.target.dataset.index;
  const user = e.target.dataset.user;
  const duration = e.target.dataset.duration;
  e.dataTransfer.setData("text/plain", JSON.stringify({ index, user, duration }));
}

/**
 * Detect clicks on empty space to add new event
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
 * Prompt user to add an event on empty space click
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
  saveEventsToStorage();
  renderEvents();
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
