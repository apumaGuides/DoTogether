// Import Firestore modules from the modular SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

/******************************************************
 * script.js
 *
 * This version uses Cloud Firestore for real-time sync
 * and supports up to 5 dynamic schedule boxes.
 ******************************************************/

// Firebase configuration – REPLACE with your actual config
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

// Global variable: schedules array. Each schedule: { calendarTitle, events: [ ... ] }
let schedules = [];
// Selected event for deletion/resizing
let currentSelectedEvent = null;

// Constants
const MAX_SCHEDULES = 5;
const DAY_HEIGHT = 960; // px for 24 hours
const RATIO = DAY_HEIGHT / 1440; // 0.6667 px per minute

// On load
window.addEventListener('DOMContentLoaded', () => {
  displayCurrentDate();
  setupButtons();
  generateTimeline();
  setupRealtimeListeners();
  startCurrentTimeLineUpdater();
  addEmptySpaceClickHandlers();
  document.addEventListener('keydown', handleDeleteKey);
});

// ----------------------
// UI INITIALIZATION
// ----------------------
function displayCurrentDate() {
  const currentDateEl = document.getElementById('current-date');
  const today = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  currentDateEl.textContent = today.toLocaleDateString(undefined, options);
}

function setupButtons() {
  document.getElementById('prev-day').addEventListener('click', () => {
    console.log("Previous Day clicked");
  });
  document.getElementById('next-day').addEventListener('click', () => {
    console.log("Next Day clicked");
  });
  document.getElementById('rename-calendars').addEventListener('click', renameCalendars);
  document.getElementById('change-background').addEventListener('click', changeBackground);
  document.getElementById('add-schedule').addEventListener('click', addNewSchedule);
  document.getElementById('save-event').addEventListener('click', addNewEvent);
}

// Populate the event schedule dropdown with an "All" option and each schedule title
function updateEventScheduleOptions() {
  const select = document.getElementById('event-schedule');
  select.innerHTML = "";
  const allOpt = document.createElement('option');
  allOpt.value = "all";
  allOpt.textContent = "All";
  select.appendChild(allOpt);
  schedules.forEach((sch, index) => {
    const opt = document.createElement('option');
    opt.value = index;
    opt.textContent = sch.calendarTitle;
    select.appendChild(opt);
  });
}

// ----------------------
// REALTIME FIRESTORE SYNC
// ----------------------
function setupRealtimeListeners() {
  const eventsDocRef = doc(db, "calendar", "events");
  onSnapshot(eventsDocRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      schedules = data.schedules || [];
    } else {
      // Initialize with two default schedules if none exist
      schedules = [
        { calendarTitle: "My Schedule", events: [] },
        { calendarTitle: "Friend's Schedule", events: [] }
      ];
      updateFirebase();
    }
    renderSchedules();
    updateEventScheduleOptions();
  });
}

async function updateFirebase() {
  await setDoc(doc(db, "calendar", "events"), { schedules: schedules });
}

// ----------------------
// RENDERING SCHEDULES & EVENTS
// ----------------------
function renderSchedules() {
  const container = document.getElementById('schedules-container');
  container.innerHTML = "";
  schedules.forEach((sch, index) => {
    const cal = document.createElement('div');
    cal.classList.add('calendar');
    cal.dataset.scheduleIndex = index;
    
    const title = document.createElement('h2');
    title.textContent = sch.calendarTitle;
    cal.appendChild(title);
    
    // Create time-slots and events-container (both same height)
    const slots = document.createElement('div');
    slots.classList.add('time-slots');
    slots.id = `time-slots-${index}`;
    // Draw half-hour lines
    for (let i = 0; i < 48; i++) {
      const line = document.createElement('div');
      line.classList.add('time-slot-line');
      line.style.top = (i * 20) + 'px';
      slots.appendChild(line);
    }
    cal.appendChild(slots);
    
    const eventsCont = document.createElement('div');
    eventsCont.classList.add('events-container');
    eventsCont.id = `events-container-${index}`;
    eventsCont.dataset.scheduleIndex = index;
    // Enable click-to-add event on empty space
    eventsCont.addEventListener('click', (e) => {
      if (e.target === eventsCont) {
        createEventPrompt(index);
      }
    });
    // Add drop handlers
    eventsCont.addEventListener('dragover', onDragOver);
    eventsCont.addEventListener('drop', onDrop);
    
    cal.appendChild(eventsCont);
    container.appendChild(cal);
    
    // Render events for this schedule
    renderEventsForSchedule(index);
  });
}

// Render events for a single schedule box
function renderEventsForSchedule(scheduleIndex) {
  const container = document.getElementById(`events-container-${scheduleIndex}`);
  container.innerHTML = "";
  const events = schedules[scheduleIndex].events;
  events.forEach((event, index) => {
    const eventEl = document.createElement('div');
    eventEl.classList.add('event');
    // For demonstration, if scheduleIndex is odd, add friend-event style
    if (scheduleIndex % 2 === 1) eventEl.classList.add('friend-event');
    if (event.image) eventEl.classList.add(event.image);
    
    const startMin = parseTime(event.startTime);
    const endMin = parseTime(event.endTime);
    const duration = endMin - startMin;
    eventEl.style.top = (startMin * RATIO) + 'px';
    eventEl.style.height = (duration * RATIO) + 'px';
    
    // Draggable
    eventEl.draggable = true;
    eventEl.dataset.index = index;
    eventEl.dataset.scheduleIndex = scheduleIndex;
    eventEl.dataset.duration = duration;
    eventEl.addEventListener('dragstart', onDragStart);
    
    // Current event highlight
    const now = getMinutesSinceMidnight();
    if (now >= startMin && now < endMin) {
      eventEl.classList.add('current-event');
    }
    
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = "checkbox";
    checkbox.checked = event.done;
    checkbox.addEventListener("change", () => {
      event.done = checkbox.checked;
      updateFirebase();
    });
    eventEl.appendChild(checkbox);
    
    // Description
    const descSpan = document.createElement('span');
    descSpan.textContent = event.description;
    eventEl.appendChild(descSpan);
    
    // If comment exists, show it
    if (event.comment) {
      const commentEl = document.createElement('div');
      commentEl.classList.add('comment');
      commentEl.textContent = event.comment;
      eventEl.appendChild(commentEl);
    }
    
    // Append resizer for resizing events
    const resizer = document.createElement('div');
    resizer.classList.add('resizer');
    resizer.addEventListener('mousedown', initResize);
    eventEl.appendChild(resizer);
    
    // On click, select event and prompt for rename/comment
    eventEl.addEventListener("click", (e) => {
      // Prevent click from triggering on resizer
      if (e.target.classList.contains('resizer')) return;
      handleEventClick(event, eventEl, scheduleIndex);
      e.stopPropagation();
    });
    
    container.appendChild(eventEl);
  });
}

// ----------------------
// EVENT ACTIONS
// ----------------------
function handleEventClick(eventObj, eventEl, scheduleIndex) {
  clearSelectedEvent();
  eventEl.classList.add('selected');
  currentSelectedEvent = { eventObj, eventIndex: eventEl.dataset.index, scheduleIndex, user: "all" };
  const action = prompt(
    `Event: "${eventObj.description}"\nChoose an action:\n1) Rename\n2) Add Comment\n(Then press "D" to delete)`
  );
  if (action === "1") {
    const newName = prompt("Enter new description:", eventObj.description);
    if (newName && newName.trim() !== "") {
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

function clearSelectedEvent() {
  document.querySelectorAll('.event.selected').forEach(el => el.classList.remove('selected'));
  currentSelectedEvent = null;
}

function handleDeleteKey(e) {
  if (e.key.toLowerCase() === "d" && currentSelectedEvent) {
    const { scheduleIndex, eventIndex } = currentSelectedEvent;
    schedules[scheduleIndex].events.splice(eventIndex, 1);
    updateFirebase();
    currentSelectedEvent = null;
  }
}

// ----------------------
// ADD/CREATE EVENTS & SCHEDULES
// ----------------------
function addNewEvent() {
  const description = document.getElementById("event-description").value;
  const startTime = document.getElementById("start-time").value;
  const endTime = document.getElementById("end-time").value;
  const image = document.getElementById("event-image").value;
  const target = document.getElementById("event-schedule").value; // "all" or specific index
  
  if (!description || !startTime || !endTime) {
    alert("Please fill in all fields.");
    return;
  }
  
  const newEvent = {
    startTime,
    endTime,
    description,
    done: false,
    image,
    comment: ""
  };
  
  if (target === "all") {
    schedules.forEach(sch => sch.events.push(newEvent));
  } else {
    const idx = parseInt(target);
    schedules[idx].events.push(newEvent);
  }
  updateFirebase();
  
  // Clear form fields
  document.getElementById("event-description").value = "";
  document.getElementById("start-time").value = "";
  document.getElementById("end-time").value = "";
  document.getElementById("event-image").value = "";
}

function createEventPrompt(scheduleIndex) {
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
    image: "",
    comment: ""
  };
  
  schedules[scheduleIndex].events.push(newEvent);
  updateFirebase();
}

function addNewSchedule() {
  if (schedules.length >= MAX_SCHEDULES) {
    alert("Maximum number of schedules reached.");
    return;
  }
  const title = prompt("Enter schedule title:", "New Schedule");
  const newSchedule = { calendarTitle: title || "New Schedule", events: [] };
  schedules.push(newSchedule);
  updateFirebase();
  updateEventScheduleOptions();
}

// ----------------------
// DRAG & DROP & RESIZING
// ----------------------
function onDragStart(e) {
  const data = {
    eventIndex: e.target.dataset.index,
    scheduleIndex: e.target.dataset.scheduleIndex,
    duration: e.target.dataset.duration
  };
  e.dataTransfer.setData("text/plain", JSON.stringify(data));
}

function onDragOver(e) {
  e.preventDefault();
}

function onDrop(e) {
  e.preventDefault();
  const container = e.currentTarget;
  const scheduleIndex = container.dataset.scheduleIndex;
  const rect = container.getBoundingClientRect();
  const dropY = e.clientY - rect.top;
  let newStartMin = Math.round(dropY / RATIO);
  const data = JSON.parse(e.dataTransfer.getData("text/plain"));
  const duration = parseInt(data.duration, 10);
  const newStartStr = toHHMM(newStartMin);
  const newEndStr = toHHMM(newStartMin + duration);
  
  schedules[scheduleIndex].events[data.eventIndex].startTime = newStartStr;
  schedules[scheduleIndex].events[data.eventIndex].endTime = newEndStr;
  updateFirebase();
}

function toHHMM(totalMinutes) {
  if (totalMinutes < 0) totalMinutes = 0;
  if (totalMinutes > 1439) totalMinutes = 1439;
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return String(hh).padStart(2, '0') + ":" + String(mm).padStart(2, '0');
}

// RESIZING: Add a resizer handle to each event
let isResizing = false;
let currentResizer = null;
let startY = 0;
let initialHeight = 0;
let resizingData = null;

function initResize(e) {
  e.stopPropagation();
  isResizing = true;
  currentResizer = e.target;
  startY = e.clientY;
  const eventEl = currentResizer.parentElement;
  initialHeight = eventEl.offsetHeight;
  resizingData = {
    eventIndex: eventEl.dataset.index,
    scheduleIndex: eventEl.dataset.scheduleIndex,
    startMin: parseTime(getEventStartTime(eventEl))
  };
  document.addEventListener('mousemove', resizeEvent);
  document.addEventListener('mouseup', stopResize);
}

function resizeEvent(e) {
  if (!isResizing) return;
  const eventEl = currentResizer.parentElement;
  let newHeight = initialHeight + (e.clientY - startY);
  if (newHeight < 20) newHeight = 20; // minimum height
  eventEl.style.height = newHeight + "px";
}

function stopResize(e) {
  if (!isResizing) return;
  const eventEl = currentResizer.parentElement;
  const newHeight = eventEl.offsetHeight;
  const newDuration = Math.round(newHeight / RATIO);
  const newEndMin = resizingData.startMin + newDuration;
  schedules[resizingData.scheduleIndex].events[resizingData.eventIndex].endTime = toHHMM(newEndMin);
  updateFirebase();
  isResizing = false;
  currentResizer = null;
  document.removeEventListener('mousemove', resizeEvent);
  document.removeEventListener('mouseup', stopResize);
}

function getEventStartTime(eventEl) {
  // Look up the event in the schedules array
  const scheduleIndex = eventEl.dataset.scheduleIndex;
  const eventIndex = eventEl.dataset.index;
  return schedules[scheduleIndex].events[eventIndex].startTime;
}

// ----------------------
// EMPTY SPACE (CLICK-TO-ADD)
// ----------------------
function addEmptySpaceClickHandlers() {
  // Already attached on each schedule's events-container in renderSchedules()
}

// ----------------------
// CURRENT TIME RED LINE
// ----------------------
function startCurrentTimeLineUpdater() {
  updateCurrentTimeLine();
  setInterval(updateCurrentTimeLine, 60 * 1000);
}

function updateCurrentTimeLine() {
  const lineEl = document.getElementById('current-time-line');
  const nowMin = getMinutesSinceMidnight();
  let topOffset = nowMin * RATIO;
  if (topOffset < 0) topOffset = 0;
  if (topOffset > DAY_HEIGHT) topOffset = DAY_HEIGHT;
  lineEl.style.top = topOffset + "px";
  // No need to re-render events on every update here
}

// Fix: Use local time properly (using getUTCHours & getTimezoneOffset)
function getMinutesSinceMidnight() {
  let now = new Date();
  return now.getUTCHours() * 60 + now.getUTCMinutes() - now.getTimezoneOffset();
}

// ----------------------
// UPDATE EVENT SCHEDULES UI
// ----------------------
function renderSchedulesEvents() {
  schedules.forEach((sch, index) => {
    renderEventsForSchedule(index);
  });
}

// When any update occurs, re-render schedules (and update event schedule options)
function renderSchedules() {
  const container = document.getElementById('schedules-container');
  container.innerHTML = "";
  schedules.forEach((sch, index) => {
    const cal = document.createElement('div');
    cal.classList.add('calendar');
    cal.dataset.scheduleIndex = index;
    
    const title = document.createElement('h2');
    title.textContent = sch.calendarTitle;
    cal.appendChild(title);
    
    const slots = document.createElement('div');
    slots.classList.add('time-slots');
    slots.id = `time-slots-${index}`;
    for (let i = 0; i < 48; i++) {
      const line = document.createElement('div');
      line.classList.add('time-slot-line');
      line.style.top = (i * 20) + 'px';
      slots.appendChild(line);
    }
    cal.appendChild(slots);
    
    const eventsCont = document.createElement('div');
    eventsCont.classList.add('events-container');
    eventsCont.id = `events-container-${index}`;
    eventsCont.dataset.scheduleIndex = index;
    eventsCont.addEventListener('dragover', onDragOver);
    eventsCont.addEventListener('drop', onDrop);
    // Click-to-add event if clicked on empty space
    eventsCont.addEventListener('click', (e) => {
      if (e.target === eventsCont) {
        createEventPrompt(index);
      }
    });
    cal.appendChild(eventsCont);
    
    container.appendChild(cal);
    renderEventsForSchedule(index);
  });
  updateEventScheduleOptions();
}
