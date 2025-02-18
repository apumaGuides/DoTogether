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
firebase.initializeApp(firebaseConfig); //Use this for non-modular version
const db = firebase.firestore();

// Global variable: schedules array. Each schedule: { calendarTitle, events: [ ... ] }
let schedules = [];
// Selected event for deletion/resizing
let currentSelectedEvent = null;

// Constants
const MAX_SCHEDULES = 5;
const DAY_HEIGHT = 960; // px for 24 hours
const RATIO = DAY_HEIGHT / 1440; // 0.6667 px per minute

// ----------------------
// UI INITIALIZATION - Function declarations FIRST
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
    select.innerHTML = ""; // Clear existing options
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

function generateTimeline() {
  const timelineEl = document.getElementById('timeline');
  for (let hour = 0; hour < 24; hour++) {
    const label = document.createElement('div');
    label.classList.add('time-label');
    label.textContent = `${String(hour).padStart(2, '0')}:00`;
    timelineEl.appendChild(label);
  }
}

function generateTimeSlotLines(containerId) {
  const container = document.getElementById(containerId);
  for (let i = 0; i < 48; i++) {
    const line = document.createElement('div');
    line.classList.add('time-slot-line');
    line.style.top = (i * 20) + 'px';
    container.appendChild(line);
  }
}

// ----------------------
// REALTIME FIRESTORE SYNC
// ----------------------

function setupRealtimeListeners() {
    const eventsDocRef = db.collection("events"); // Reference the 'events' collection

    eventsDocRef.onSnapshot((querySnapshot) => {
        let newSchedules = [];
        querySnapshot.forEach((doc) => {
            const eventData = doc.data();
            // Find the correct schedule index, create if it doesn't exist
            let scheduleIndex = eventData.scheduleIndex;
            if (scheduleIndex === undefined || scheduleIndex === null) {
                // Default or error case, choose a default schedule.  Here, I'll use 0.
                scheduleIndex = 0;
            }

            // Ensure we have enough schedules.
            while (newSchedules.length <= scheduleIndex) {
                newSchedules.push({ calendarTitle: `Schedule ${newSchedules.length + 1}`, events: [] });
            }

            newSchedules[scheduleIndex].events.push({
                id: doc.id, // Store the document ID
                startTime: eventData.startTime,
                endTime: eventData.endTime,
                description: eventData.description,
                done: eventData.done,
                image: eventData.image,
                comment: eventData.comment || ""
            });
        });

        schedules = newSchedules;
        renderSchedules();
        updateEventScheduleOptions();
    });
}


// ----------------------
// RENDERING SCHEDULES & EVENTS
// ----------------------

function renderSchedules() {
    const container = document.getElementById('schedules-container');
    container.innerHTML = ""; // Clear existing schedules

    schedules.forEach((sch, index) => {
        const cal = document.createElement('div');
        cal.classList.add('calendar');
        cal.dataset.scheduleIndex = index; // Store the index on the element

        const titleContainer = document.createElement('div'); // Container for title and button
        titleContainer.style.display = 'flex'; // Use flexbox for layout
        titleContainer.style.justifyContent = 'space-between'; // Space out title and button
        titleContainer.style.alignItems = 'center'; // Vertically center

        const title = document.createElement('h2');
        title.textContent = sch.calendarTitle;
        titleContainer.appendChild(title);

        // Add a DELETE button for the schedule.  IMPORTANT: Use a closure to capture the correct index.
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'X';
        deleteButton.style.color = 'red';
        deleteButton.style.cursor = 'pointer';
        deleteButton.addEventListener('click', (function(capturedIndex) {
            return function() {
                deleteSchedule(capturedIndex);
            };
        })(index)); // Immediately Invoked Function Expression (IIFE)
        titleContainer.appendChild(deleteButton);
        cal.appendChild(titleContainer);

        // Time Slots (fixed height, relative to calendar box)
        const slots = document.createElement('div');
        slots.classList.add('time-slots');
        slots.id = `time-slots-${index}`; // Unique ID for each set of slots
        for (let i = 0; i < 48; i++) {
            const line = document.createElement('div');
            line.classList.add('time-slot-line');
            line.style.top = (i * 20) + 'px';
            slots.appendChild(line);
        }
        cal.appendChild(slots);


        const eventsCont = document.createElement('div');
        eventsCont.classList.add('events-container');
        eventsCont.id = `events-container-${index}`; // Unique ID for each container
        eventsCont.dataset.scheduleIndex = index;

        // Add these drag event listeners
        eventsCont.addEventListener('dragover', onDragOver);
        eventsCont.addEventListener('drop', onDrop);

        // Enable click-to-add on empty space
        eventsCont.addEventListener('click', (e) => {
            if (e.target === eventsCont) {
                createEventPrompt(index);
            }
        });
        cal.appendChild(eventsCont);

        container.appendChild(cal);
        renderEventsForSchedule(index); // Now render the events *after* the structure is in place
    });
}



function renderEventsForSchedule(scheduleIndex) {
    const container = document.getElementById(`events-container-${scheduleIndex}`);
    if (!container) {
        console.error(`Container not found for schedule index: ${scheduleIndex}`);
        return;
    }
    container.innerHTML = ""; // Clear existing events

    const events = schedules[scheduleIndex]?.events || []; // Handle potential undefined

    events.forEach((event, index) => {
        const eventEl = document.createElement('div');
        eventEl.classList.add('event');

        if (scheduleIndex % 2 === 1) eventEl.classList.add('friend-event');
        if (event.image) eventEl.classList.add(event.image);

        const startMin = parseTime(event.startTime);
        const endMin = parseTime(event.endTime);
        const duration = endMin - startMin;

        eventEl.style.top = (startMin * RATIO) + 'px';
        eventEl.style.height = (duration * RATIO) + 'px';

        eventEl.draggable = true;
        eventEl.dataset.index = index;
        eventEl.dataset.scheduleIndex = scheduleIndex; // Use stored scheduleIndex
        eventEl.dataset.duration = duration.toString();
        eventEl.dataset.id = event.id; // Store document ID
        eventEl.addEventListener('dragstart', onDragStart);

        const now = getMinutesSinceMidnight();
        if (now >= startMin && now < endMin) {
            eventEl.classList.add('current-event');
        }

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = event.done;
        checkbox.addEventListener("change", () => {
            event.done = checkbox.checked;
            updateEventInFirestore(event.id, { done: event.done }, scheduleIndex);
        });
        eventEl.appendChild(checkbox);


        const descSpan = document.createElement("span");
        descSpan.textContent = event.description;
        eventEl.appendChild(descSpan);


        if (event.comment) {
            const commentEl = document.createElement("div");
            commentEl.classList.add("comment");
            commentEl.textContent = event.comment;
            eventEl.appendChild(commentEl);
        }


        const resizer = document.createElement('div');
        resizer.classList.add('resizer');
        resizer.addEventListener('mousedown', initResize);
        eventEl.appendChild(resizer);

        // Add X button for deleting events
        const deleteX = document.createElement('span');
        deleteX.textContent = 'X';
        deleteX.style.color = 'red';
        deleteX.style.cursor = 'pointer';
        deleteX.style.marginLeft = '5px'; // Add some spacing
        deleteX.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event click handler
            deleteEventFromFirestore(event.id, scheduleIndex);
        });
        eventEl.appendChild(deleteX);

        eventEl.addEventListener("click", (e) => {
           if (e.target.classList.contains('resizer')) return;
            handleEventClick(event, eventEl, scheduleIndex);
            e.stopPropagation();
        });

        container.appendChild(eventEl);
    });
}


// ----------------------
// EVENT ACTIONS (Rename, Comment, Delete)
// ----------------------

function handleEventClick(eventObj, eventEl, scheduleIndex) {
    clearSelectedEvent();
    eventEl.classList.add('selected');
    currentSelectedEvent = { eventObj, eventIndex: eventEl.dataset.index, scheduleIndex, user: "all" }; //Store event
    const action = prompt(
        `Event: "${eventObj.description}"\nChoose an action:\n1) Rename\n2) Add Comment\n(Then press "D" to delete)`
    );
    if (action === "1") {
        const newName = prompt("Enter new description:", eventObj.description);
        if (newName && newName.trim() !== "") {
            eventObj.description = newName;
            updateEventInFirestore(eventObj.id, { description: newName }, scheduleIndex);
        }
    } else if (action === "2") {
        const comment = prompt("Enter comment:", eventObj.comment || "");
        if (comment !== null) {
            eventObj.comment = comment;
            updateEventInFirestore(eventObj.id, { comment: comment }, scheduleIndex);
        }
    }
}

function clearSelectedEvent() {
    document.querySelectorAll('.event.selected').forEach(el => el.classList.remove('selected'));
    currentSelectedEvent = null;
}

//REMOVED HANDLE DELETE KEY (removed as requested)

// ----------------------
// ADD/CREATE EVENTS & SCHEDULES
// ----------------------

async function addNewEvent() {
    const description = document.getElementById("event-description").value;
    const startTime = document.getElementById("start-time").value;
    const endTime = document.getElementById("end-time").value;
    const image = document.getElementById("event-image").value;
    const scheduleIndexStr = document.getElementById("event-schedule").value;

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
        comment: "",
        timestamp: firebase.firestore.FieldValue.serverTimestamp() // Add a timestamp for sorting and consistency
    };

    let scheduleIndex;

    if (scheduleIndexStr === 'all') {
        // Add to all schedules
        for (let i = 0; i < schedules.length; i++) {
            await addEventToFirestore(newEvent, i); // Pass the schedule index
        }
    } else {
        scheduleIndex = parseInt(scheduleIndexStr, 10);
         if (isNaN(scheduleIndex) || scheduleIndex < 0 || scheduleIndex >= schedules.length) {
            alert("Invalid schedule selected.");
            return;
         }
        await addEventToFirestore(newEvent, scheduleIndex); // Pass the schedule index

    }
    // Clear form fields after successful addition
    document.getElementById("event-description").value = "";
    document.getElementById("start-time").value = "";
    document.getElementById("end-time").value = "";
    document.getElementById("event-image").value = ""; //clear image field
}

async function createEventPrompt(scheduleIndex) {
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
    comment: "",
    timestamp: firebase.firestore.FieldValue.serverTimestamp() // Add a timestamp
  };

  await addEventToFirestore(newEvent, scheduleIndex); // Use Firestore, passing scheduleIndex
}

async function addNewSchedule() {
    if (schedules.length >= MAX_SCHEDULES) {
        alert("Maximum number of schedules reached.");
        return;
    }
    let title = prompt("Enter schedule title:", "New Schedule");
    if (!title) {
        title = "New Schedule"; // Default title
    }

    const newSchedule = { calendarTitle: title, events: [] };
    schedules.push(newSchedule);  // Add to the local array
    await updateFirebaseWithEntireSchedule(); // *Correctly* update the entire schedules array in Firestore
    updateEventScheduleOptions(); // Update the dropdown in the UI
}

// ----------------------
// FIRESTORE HELPER FUNCTIONS
// ----------------------

async function addEventToFirestore(eventData, scheduleIndex) {
    try {
        // Add scheduleIndex to the event data
        const docRef = await db.collection("events").add({ ...eventData, scheduleIndex }); // Add to Firestore
        console.log("Document written with ID: ", docRef.id);

    } catch (error) {
        console.error("Error adding document: ", error);
    }
}

async function updateEventInFirestore(eventId, updateData, scheduleIndex) {
    try {
        const eventRef = db.collection("events").doc(eventId);
        await eventRef.update(updateData);
        console.log("Document successfully updated!");
    } catch (error) {
        console.error("Error updating document: ", error);
    }
}

async function deleteEventFromFirestore(eventId, scheduleIndex) {
    try {
      const eventRef = db.collection("events").doc(eventId);
      await eventRef.delete();
      console.log("Document successfully deleted!");
        // No need to modify schedules array, onSnapshot will handle that
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
}

// Updates ENTIRE schedule data to Firestore
async function updateFirebaseWithEntireSchedule() {
    try {
        const schedulesDocRef = db.collection("calendar").doc("events"); // Re-use a single document
        await schedulesDocRef.set({ schedules: schedules }); // Set ENTIRE schedules array
        console.log("Schedules successfully updated in Firestore!");
    } catch (error) {
        console.error("Error updating schedules in Firestore: ", error);
    }
}

async function deleteSchedule(index){
    //Prevent errors
    if (index < 0 || index >= schedules.length) {
        console.error("Invalid schedule index for deletion:", index);
        return;
    }

    // Get the events of schedule we are deleting
    const eventsToDelete = schedules[index].events;

    // Delete each event individually from Firestore
    // Use Promise.all to wait for all deletions to complete
    await Promise.all(eventsToDelete.map(event => {
        return deleteEventFromFirestore(event.id, index);
    }));

    //Now, it's safe to remove from the local schedule, as those have been deleted.
    schedules.splice(index, 1); // Remove from local array

    //Finally, we update the entire Firebase.
    await updateFirebaseWithEntireSchedule()
}

// ----------------------
// DRAG & DROP & RESIZING
// ----------------------

function onDragStart(e) {
  const data = {
    eventIndex: e.target.dataset.index,
    scheduleIndex: e.target.dataset.scheduleIndex,
    duration: e.target.dataset.duration,
    id: e.target.dataset.id, // Add the document ID to the drag data
  };
  e.dataTransfer.setData("text/plain", JSON.stringify(data));
}

function onDragOver(e) {
  e.preventDefault(); // Necessary to allow dropping
}

function onDrop(e) {
    e.preventDefault();
    const container = e.currentTarget;
    const scheduleIndex = parseInt(container.dataset.scheduleIndex, 10);
    const rect = container.getBoundingClientRect();
    const dropY = e.clientY - rect.top;
    let newStartMin = Math.round(dropY / RATIO);
    
    // Add bounds checking
    if (newStartMin < 0) newStartMin = 0;
    if (newStartMin > 1440) newStartMin = 1440;
    
    const data = JSON.parse(e.dataTransfer.getData("text/plain"));
    const duration = parseInt(data.duration, 10);
    
    // Ensure event doesn't go beyond day boundary
    if (newStartMin + duration > 1440) {
        newStartMin = 1440 - duration;
    }
    
    const newStartStr = toHHMM(newStartMin);
    const newEndStr = toHHMM(newStartMin + duration);

    const eventIndex = schedules[scheduleIndex].events.findIndex(event => event.id === data.id);

    if(eventIndex !== -1) {
        schedules[scheduleIndex].events[eventIndex] = {
            ...schedules[scheduleIndex].events[eventIndex],
            startTime: newStartStr,
            endTime: newEndStr
        }
        updateEventInFirestore(data.id, { startTime: newStartStr, endTime: newEndStr }, scheduleIndex);
    } else {
        console.error('Event to update not found');
    }
}


// RESIZING: Add a resizer handle to each event

let isResizing = false;
let currentResizer = null;
let startY = 0;
let initialHeight = 0;
let resizingData = null; // Store data during resizing

function initResize(e) {
    e.stopPropagation();  // VERY IMPORTANT: Prevent click event on event
    isResizing = true;
    currentResizer = e.target;
    startY = e.clientY;

    const eventEl = currentResizer.parentElement;
    initialHeight = eventEl.offsetHeight;

    resizingData = {
        eventIndex: parseInt(eventEl.dataset.index, 10), // Parse to integer
        scheduleIndex: parseInt(eventEl.dataset.scheduleIndex, 10), // Parse to integer
        startMin: parseTime(schedules[parseInt(eventEl.dataset.scheduleIndex, 10)].events[parseInt(eventEl.dataset.index, 10)].startTime), // Get correct start time
        id: eventEl.dataset.id,
    };

    document.addEventListener('mousemove', resizeEvent);
    document.addEventListener('mouseup', stopResize);
}


function resizeEvent(e) {
    if (!isResizing) return;
    const eventEl = currentResizer.parentElement;
    let newHeight = initialHeight + (e.clientY - startY);
    if (newHeight < 20) newHeight = 20; // Minimum height
    eventEl.style.height = newHeight + "px";
}

function stopResize(e) {
  if (!isResizing) return;

    const eventEl = currentResizer.parentElement;
    const newHeight = eventEl.offsetHeight;
    const newDuration = Math.round(newHeight / RATIO);
    const newEndMin = resizingData.startMin + newDuration;
    const newEndTime = toHHMM(newEndMin);


    //Update Firebase
    const eventIndex = schedules[resizingData.scheduleIndex].events.findIndex(event => event.id === resizingData.id);

    if(eventIndex !== -1){
       schedules[resizingData.scheduleIndex].events[eventIndex] = {
          ...schedules[resizingData.scheduleIndex].events[eventIndex],
          endTime: newEndTime,
       }
        updateEventInFirestore(resizingData.id, { endTime: newEndTime }, resizingData.scheduleIndex);
    } else{
        console.error('Event not found');
    }


    isResizing = false;
    currentResizer = null;
    document.removeEventListener('mousemove', resizeEvent);
    document.removeEventListener('mouseup', stopResize);
}

// ----------------------
// UTILITY FUNCTIONS
// ----------------------
function toHHMM(totalMinutes) {
    if (totalMinutes < 0) totalMinutes = 0;
    if (totalMinutes > 1439) totalMinutes = 1439; // Max minutes in a day
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;
    return String(hh).padStart(2, '0') + ":" + String(mm).padStart(2, '0');
}

function parseTime(str) {
    const [h, m] = str.split(":").map(Number);
    return h * 60 + m;
}

// Fix: Use local time properly (using getUTCHours & getTimezoneOffset)
function getMinutesSinceMidnight() {
    let now = new Date();
     // Bandaid fix: Add 240 minutes (4 hours) instead of 180 (3 hours)
    return now.getUTCHours() * 60 + now.getUTCMinutes() - now.getTimezoneOffset() + 240;
}

// ----------------------
// EMPTY SPACE (CLICK-TO-ADD)
// ----------------------
function addEmptySpaceClickHandlers() {
    // Already attached dynamically in renderSchedules
}

// ----------------------
// CURRENT TIME RED LINE
// ----------------------
function startCurrentTimeLineUpdater() {
    updateCurrentTimeLine(); // Initial call
    setInterval(updateCurrentTimeLine, 60 * 1000); // Update every minute
}

function updateCurrentTimeLine() {
    const lineEl = document.getElementById('current-time-line');
    const nowMin = getMinutesSinceMidnight();
    let topOffset = nowMin * RATIO;
    if (topOffset < 0) topOffset = 0;
    if (topOffset > DAY_HEIGHT) topOffset = DAY_HEIGHT;
    lineEl.style.top = topOffset + "px";
}


//-----------------------
// BACKGROUND CHANGE
//-----------------------
function changeBackground() {
  const choice = prompt("Select background:\n1) Background 1\n2) Background 2");
  let bgUrl = "";
  if (choice === "1") {
    bgUrl = "images/image1.png";  // Corrected relative path
  } else if (choice === "2") {
    bgUrl = "images/image2.png"; // Corrected relative path
  } else {
    return; // Do nothing if invalid choice
  }

  document.body.style.backgroundImage = `url('${bgUrl}')`;
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundRepeat = "no-repeat";
}

//-----------------------
// RENAME FUNCTION
//-----------------------

function renameCalendars() {
    const newNames = [];
    for (let i = 0; i < schedules.length; i++) {
        let newTitle = prompt(`Enter new title for schedule "${schedules[i].calendarTitle}":`, schedules[i].calendarTitle);
        if (newTitle !== null) {
          newNames.push(newTitle)
        }
    }
    if(newNames.length){
      for(let i = 0; i < schedules.length; i++){
        if(newNames[i] !== null){
          schedules[i].calendarTitle = newNames[i]
        }
      }
    }
    updateFirebaseWithEntireSchedule()
}

// On load
window.addEventListener('DOMContentLoaded', () => {
  displayCurrentDate();
  setupButtons();
  generateTimeline(); // Call the function to display the timeline
  setupRealtimeListeners(); // Listen for changes in Firestore
  startCurrentTimeLineUpdater();
  addEmptySpaceClickHandlers();
  // document.addEventListener('keydown', handleDeleteKey); //Removed
});
