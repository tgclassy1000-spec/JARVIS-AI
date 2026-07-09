/* ==========================================
   J.A.R.V.I.S. PERSONAL AI DASHBOARD - SCRIPT
   ========================================== */

// --- 1. LOCAL STORAGE & DATA STORAGE ---
let db = {
  notes: JSON.parse(localStorage.getItem('jarvis_notes')) || [],
  tasks: JSON.parse(localStorage.getItem('jarvis_tasks')) || [],
  ideas: JSON.parse(localStorage.getItem('jarvis_ideas')) || [],
  projects: JSON.parse(localStorage.getItem('jarvis_projects')) || [],
  commands: JSON.parse(localStorage.getItem('jarvis_commands')) || []
};

// Mode & Theme Config
let jarvisMode = localStorage.getItem('jarvis_mode') === 'false' ? false : true;
let currentTheme = localStorage.getItem('jarvis_theme') || 'cyan';
applyTheme(currentTheme);

// Search Query State
let searchQuery = "";

// Settings State
let speechRate = parseFloat(localStorage.getItem('jarvis_speech_rate') || '1.0');
let speechPitch = parseFloat(localStorage.getItem('jarvis_speech_pitch') || '0.95');
let fxVolume = parseFloat(localStorage.getItem('jarvis_fx_volume') || '0.8');
let voiceFeedbackEnabled = localStorage.getItem('jarvis_voice_feedback') !== 'false';
let ambientHumEnabled = localStorage.getItem('jarvis_ambient_hum') === 'true';

function applyTheme(themeName) {
  document.body.classList.remove('theme-cyan', 'theme-amber', 'theme-red', 'theme-green');
  if (themeName !== 'cyan') {
    document.body.classList.add(`theme-${themeName}`);
  }
}

// Save helper
function saveToStorage(key, data) {
  localStorage.setItem(`jarvis_${key}`, JSON.stringify(data));
  updateMemoryHarmonics();
}

// --- 2. SYNTHESIZED AUDIO CONTEXT (Web Audio API) ---
let audioCtx = null;

function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Sound FX: Beep Click
function playSoundClick() {
  if (!jarvisMode) return;
  initAudioContext();
  let osc = audioCtx.createOscillator();
  let gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
  gain.gain.setValueAtTime(0.08 * fxVolume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}

// Sound FX: Command Success Sweep
function playSoundSuccess() {
  if (!jarvisMode) return;
  initAudioContext();
  let now = audioCtx.currentTime;
  let gain = audioCtx.createGain();
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.06 * fxVolume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  let osc1 = audioCtx.createOscillator();
  osc1.connect(gain);
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(587.33, now); // D5
  osc1.frequency.exponentialRampToValueAtTime(1174.66, now + 0.25); // D6

  osc1.start();
  osc1.stop(now + 0.3);
}

// Sound FX: Alert Warning Sweep
function playSoundAlert() {
  if (!jarvisMode) return;
  initAudioContext();
  let now = audioCtx.currentTime;
  let gain = audioCtx.createGain();
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.12 * fxVolume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  let osc = audioCtx.createOscillator();
  osc.connect(gain);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.linearRampToValueAtTime(200, now + 0.45);

  osc.start();
  osc.stop(now + 0.5);
}

// Sound FX: Complex Boot Sequence Chord
function playSoundBoot() {
  if (!jarvisMode) return;
  initAudioContext();
  let now = audioCtx.currentTime;
  let duration = 1.8;
  
  let mainGain = audioCtx.createGain();
  mainGain.connect(audioCtx.destination);
  mainGain.gain.setValueAtTime(0.0, now);
  mainGain.gain.linearRampToValueAtTime(0.12 * fxVolume, now + 0.5);
  mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  // Hologram ambient synthesizer chord (C Major 9)
  let freqs = [130.81, 196.00, 261.63, 329.63, 392.00, 493.88, 523.25]; // C3, G3, C4, E4, G4, B4, C5
  
  freqs.forEach((f, idx) => {
    let osc = audioCtx.createOscillator();
    let filter = audioCtx.createBiquadFilter();
    
    osc.connect(filter);
    filter.connect(mainGain);
    
    osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(f, now);
    
    // Sweep filter cutoffs for "futuristic scanning" feel
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(5, now);
    filter.frequency.setValueAtTime(50, now);
    filter.frequency.exponentialRampToValueAtTime(1500 + idx * 200, now + 0.8);
    filter.frequency.exponentialRampToValueAtTime(100, now + duration);

    osc.start(now);
    osc.stop(now + duration);
  });
}

// --- 3. SPEECH INTERFACES (Web Speech API) ---
let recognition = null;
let synth = window.speechSynthesis;
let voices = [];
let currentVoice = null;
let assistantState = 'idle'; // idle, listening, thinking, speaking

// Initialize Speech Recognition
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById('mic-status').innerText = "MIC: N/A";
    document.getElementById('mic-status').style.color = "var(--accent-red)";
    printConsole("> Web Speech Recognition API is not supported in this browser. Please use Chrome or Edge.", "error");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'hi-IN'; // Prefer Hinglish/Hindi inputs

  recognition.onstart = () => {
    setAssistantState('listening');
    playSoundClick();
    document.getElementById('mic-btn').classList.add('active');
  };

  recognition.onresult = (event) => {
    setAssistantState('thinking');
    const transcript = event.results[0][0].transcript;
    printConsole(`Sir: "${transcript}"`, "user");
    handleCommand(transcript);
  };

  recognition.onerror = (event) => {
    console.error("Speech Recognition Error:", event.error);
    setAssistantState('idle');
    document.getElementById('mic-btn').classList.remove('active');
    
    if (event.error === 'not-allowed') {
      printConsole("> Microphone permission denied. Please allow mic access in your browser settings.", "error");
    } else if (event.error !== 'no-speech') {
      printConsole(`> Voice error: ${event.error}`, "error");
    }
  };

  recognition.onend = () => {
    document.getElementById('mic-btn').classList.remove('active');
    if (assistantState === 'listening') {
      setAssistantState('idle');
    }
  };
}

// Trigger Voice Recognition
function triggerListening() {
  if (!recognition) {
    showWarning("Speech recognition is not supported or was blocked in this browser. Please use the text input instead.");
    return;
  }
  if (assistantState === 'listening') {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (e) {
      console.warn("Recognition already active", e);
    }
  }
}

// Load System Voices
function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices();
  
  const select = document.getElementById('voice-select');
  select.innerHTML = '';

  if (voices.length === 0) {
    let opt = document.createElement('option');
    opt.value = "";
    opt.innerText = "No voices detected";
    select.appendChild(opt);
    return;
  }

  // Look for Hindi voices first
  let hiVoices = voices.filter(v => v.lang.startsWith('hi'));
  // Look for English voices next (prefer UK English for JARVIS flavor)
  let enVoices = voices.filter(v => v.lang.startsWith('en'));
  let otherVoices = voices.filter(v => !v.lang.startsWith('hi') && !v.lang.startsWith('en'));

  // Sort and compile
  let sortedVoices = [...hiVoices, ...enVoices, ...otherVoices];
  
  sortedVoices.forEach(v => {
    let opt = document.createElement('option');
    opt.value = v.name;
    opt.innerText = `${v.name} (${v.lang})`;
    select.appendChild(opt);
  });

  // Select first Hindi voice if available, otherwise a British/English one, otherwise default
  let prefVoice = hiVoices[0] || voices.find(v => v.lang.includes('GB')) || voices.find(v => v.lang.includes('US')) || voices[0];
  if (prefVoice) {
    select.value = prefVoice.name;
    currentVoice = prefVoice;
  }

  // Check if Hindi voice is missing and raise warning
  if (hiVoices.length === 0) {
    document.getElementById('status-voice-sys').innerText = "NO HINDI VOICE";
    document.getElementById('status-voice-sys').style.color = "var(--accent-amber)";
  } else {
    document.getElementById('status-voice-sys').innerText = "ONLINE";
    document.getElementById('status-voice-sys').style.color = "var(--accent-green)";
  }
}

if (synth) {
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
  }
  loadVoices();
}

// Speaks the response using SpeechSynthesis
function speak(text, isHindiText = false) {
  if (!voiceFeedbackEnabled) {
    printConsole(`JARVIS (Muted): "${text}"`, "voice-feedback-line");
    return;
  }

  if (!synth) {
    printConsole(`JARVIS (Silent): "${text}"`, "voice-feedback-line");
    return;
  }

  // Cancel any ongoing speech
  synth.cancel();

  // If Hindi voice is requested but not available, show alert warning once
  let hiVoices = voices.filter(v => v.lang.startsWith('hi'));
  if (isHindiText && hiVoices.length === 0 && !sessionStorage.getItem('jarvis_voice_warned')) {
    showWarning("Hindi voice is not available in this browser. Please use Google Chrome/Microsoft Edge and install Hindi language voice for native Hinglish speech output.");
    sessionStorage.setItem('jarvis_voice_warned', 'true');
  }

  let utterance = new SpeechSynthesisUtterance(text);
  
  // Apply selected voice
  const select = document.getElementById('voice-select');
  if (select && select.value) {
    let matchingVoice = voices.find(v => v.name === select.value);
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }
  } else if (currentVoice) {
    utterance.voice = currentVoice;
  }

  // Adjust parameters for JARVIS vibe (slightly lower pitch, measured rate)
  utterance.pitch = speechPitch;
  utterance.rate = speechRate;

  utterance.onstart = () => {
    setAssistantState('speaking');
  };

  utterance.onend = () => {
    setAssistantState('idle');
  };

  utterance.onerror = (e) => {
    console.error("Speech Synthesis Error:", e);
    setAssistantState('idle');
  };

  synth.speak(utterance);
  printConsole(`JARVIS: "${text}"`, "voice-feedback-line");
}

// Update UI state based on state enum
function setAssistantState(state) {
  assistantState = state;
  const core = document.getElementById('ai-core');
  const label = document.getElementById('core-state-label');
  const wave = document.getElementById('voice-wave');
  const badge = document.getElementById('system-status-badge');
  const stateVal = document.getElementById('status-assistant-mode');

  // Reset classes
  core.classList.remove('listening', 'thinking', 'speaking');
  wave.classList.remove('active');

  if (state === 'listening') {
    core.classList.add('listening');
    wave.classList.add('active');
    label.innerText = "LISTENING...";
    badge.innerText = "STATUS: LISTENING";
    badge.style.color = "var(--accent-amber)";
    stateVal.innerText = "LISTENING";
  } else if (state === 'thinking') {
    core.classList.add('thinking');
    label.innerText = "THINKING...";
    badge.innerText = "STATUS: THINKING";
    badge.style.color = "var(--primary)";
    stateVal.innerText = "THINKING";
  } else if (state === 'speaking') {
    core.classList.add('speaking');
    wave.classList.add('active');
    label.innerText = "SPEAKING...";
    badge.innerText = "STATUS: SPEAKING";
    badge.style.color = "var(--accent-green)";
    stateVal.innerText = "SPEAKING";
  } else {
    label.innerText = jarvisMode ? "JARVIS ONLINE" : "ASSISTANT READY";
    badge.innerText = "STATUS: IDLE";
    badge.style.color = "var(--text-muted)";
    stateVal.innerText = "ACTIVE";
  }
}

// --- 4. HUD CONSOLE & MODAL DIALOGS ---

// Write lines to simulated terminal console
function printConsole(text, type = 'system') {
  const container = document.getElementById('console-history');
  const scrollContainer = document.getElementById('console-history-container');
  
  let div = document.createElement('div');
  div.className = `console-line ${type}-line`;
  
  if (type === 'system' || type === 'error' || type === 'voice-feedback-line') {
    // Basic typing simulator
    div.innerText = "";
    container.appendChild(div);
    
    let chars = text.split("");
    let i = 0;
    let speed = type === 'error' ? 10 : 20;
    
    function typeChar() {
      if (i < chars.length) {
        div.innerText += chars[i];
        i++;
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        setTimeout(typeChar, speed);
      }
    }
    typeChar();
  } else {
    // Immediate append for user lines
    div.innerText = text;
    container.appendChild(div);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }
}

// Shows general attention dialog
function showWarning(message) {
  playSoundAlert();
  document.getElementById('warning-text').innerText = message;
  document.getElementById('warning-modal').classList.remove('modal-hidden');
}

// Shows high-tech interactive modal prompt instead of generic browser prompt()
function showInputPrompt(title, placeholder, callback) {
  playSoundClick();
  const modal = document.getElementById('input-modal');
  const field = document.getElementById('input-modal-field');
  
  document.getElementById('input-modal-title').innerText = title.toUpperCase();
  field.placeholder = placeholder;
  field.value = "";
  
  modal.classList.remove('modal-hidden');
  field.focus();
  
  // Temporary handlers
  const cleanup = () => {
    modal.classList.add('modal-hidden');
    document.getElementById('input-modal-submit').removeEventListener('click', onSubmit);
    document.getElementById('input-modal-cancel').removeEventListener('click', onCancel);
    field.removeEventListener('keydown', onKeyDown);
  };
  
  const onSubmit = () => {
    cleanup();
    if (callback) callback(field.value.trim());
  };
  
  const onCancel = () => {
    cleanup();
    if (callback) callback(null);
  };
  
  const onKeyDown = (e) => {
    if (e.key === 'Enter') onSubmit();
    if (e.key === 'Escape') onCancel();
  };

  document.getElementById('input-modal-submit').addEventListener('click', onSubmit);
  document.getElementById('input-modal-cancel').addEventListener('click', onCancel);
  field.addEventListener('keydown', onKeyDown);
}

// --- 5. DATA PANELS RENDERERS (CRUD) ---

// Formats date/time stamps
function getTimestamp() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// 5.1 NOTES CRUD
function renderNotes() {
  const list = document.getElementById('notes-list');
  list.innerHTML = '';

  let filtered = db.notes;
  if (searchQuery) {
    filtered = db.notes.filter(n => n.text.toLowerCase().includes(searchQuery));
  }

  if (filtered.length === 0) {
    list.innerHTML = `<p class="empty-msg">${searchQuery ? 'No matching notes, Sir.' : 'No saved notes, Sir.'}</p>`;
    return;
  }

  filtered.forEach(note => {
    let card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-header">
        <span class="item-title">Note #${note.id.toString().substring(0, 4)}</span>
        <div class="item-actions">
          <button class="item-btn edit-btn" onclick="editNote(${note.id})" title="Edit note">✏️</button>
          <button class="item-btn delete-btn" onclick="deleteNote(${note.id})" title="Delete note">🗑️</button>
        </div>
      </div>
      <p class="item-desc">${escapeHTML(note.text)}</p>
      <div class="item-meta">
        <span>📅 ${note.date}</span>
        <span>⏱️ ${note.time}</span>
      </div>
    `;
    list.appendChild(card);
  });
}

function saveNote(text) {
  if (!text) return;
  const newNote = {
    id: Date.now(),
    text: text,
    date: new Date().toLocaleDateString(),
    time: getTimestamp()
  };
  db.notes.unshift(newNote);
  saveToStorage('notes', db.notes);
  renderNotes();
  playSoundSuccess();
  speak("Note has been saved, Sir.", true);
  printConsole(`> Note saved successfully. ID: ${newNote.id}`);
}

function deleteNote(id) {
  db.notes = db.notes.filter(note => note.id !== id);
  saveToStorage('notes', db.notes);
  renderNotes();
  playSoundClick();
  printConsole(`> Deleted note index: ${id}`);
}

function editNote(id) {
  const note = db.notes.find(n => n.id === id);
  if (!note) return;
  showInputPrompt("Edit Note", "Modify note content, Sir...", (value) => {
    if (value) {
      note.text = value;
      saveToStorage('notes', db.notes);
      renderNotes();
      playSoundSuccess();
      speak("Note updated, Sir.", true);
      printConsole(`> Note updated successfully. ID: ${id}`);
    } else {
      setAssistantState('idle');
    }
  });
}

// 5.2 TASKS CRUD
function renderTasks() {
  const list = document.getElementById('tasks-list');
  list.innerHTML = '';

  let filtered = db.tasks;
  if (searchQuery) {
    filtered = db.tasks.filter(t => t.text.toLowerCase().includes(searchQuery));
  }

  if (filtered.length === 0) {
    list.innerHTML = `<p class="empty-msg">${searchQuery ? 'No matching tasks, Sir.' : 'No active tasks, Sir.'}</p>`;
    return;
  }

  filtered.forEach(task => {
    let card = document.createElement('div');
    card.className = `item-card ${task.completed ? 'completed' : ''}`;
    card.innerHTML = `
      <div class="item-header">
        <span class="item-title">${escapeHTML(task.text)}</span>
        <div class="item-actions">
          <button class="item-btn check-btn" onclick="toggleTask(${task.id})" title="Toggle Complete">${task.completed ? '↩️' : '✅'}</button>
          <button class="item-btn edit-btn" onclick="editTask(${task.id})" title="Edit Task">✏️</button>
          <button class="item-btn delete-btn" onclick="deleteTask(${task.id})" title="Delete Task">🗑️</button>
        </div>
      </div>
      <div class="item-meta">
        <span>Status: ${task.completed ? 'Completed' : 'Pending'}</span>
        <span>📅 ${task.date}</span>
      </div>
    `;
    list.appendChild(card);
  });
}

function saveTask(text) {
  if (!text) return;
  const newTask = {
    id: Date.now(),
    text: text,
    completed: false,
    date: new Date().toLocaleDateString()
  };
  db.tasks.unshift(newTask);
  saveToStorage('tasks', db.tasks);
  renderTasks();
  playSoundSuccess();
  speak("Your task has been saved, Sir.", true);
  printConsole(`> Task added: "${text}"`);
}

function toggleTask(id) {
  const task = db.tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    saveToStorage('tasks', db.tasks);
    renderTasks();
    playSoundClick();
    printConsole(`> Task status toggled for: "${task.text}"`);
  }
}

function deleteTask(id) {
  db.tasks = db.tasks.filter(t => t.id !== id);
  saveToStorage('tasks', db.tasks);
  renderTasks();
  playSoundClick();
  printConsole(`> Deleted task index: ${id}`);
}

function editTask(id) {
  const task = db.tasks.find(t => t.id === id);
  if (!task) return;
  showInputPrompt("Edit Task", "Modify task, Sir...", (value) => {
    if (value) {
      task.text = value;
      saveToStorage('tasks', db.tasks);
      renderTasks();
      playSoundSuccess();
      speak("Task updated, Sir.", true);
      printConsole(`> Task updated successfully. ID: ${id}`);
      
      // Regenerate plan if active
      if (localStorage.getItem('jarvis_daily_plan')) {
        generateDailyPlan();
      }
    } else {
      setAssistantState('idle');
    }
  });
}

// 5.3 IDEAS CRUD
function renderIdeas() {
  const list = document.getElementById('ideas-list');
  list.innerHTML = '';

  let filtered = db.ideas;
  if (searchQuery) {
    filtered = db.ideas.filter(i => i.text.toLowerCase().includes(searchQuery));
  }

  if (filtered.length === 0) {
    list.innerHTML = `<p class="empty-msg">${searchQuery ? 'No matching ideas, Sir.' : 'No saved ideas, Sir.'}</p>`;
    return;
  }

  filtered.forEach(idea => {
    let card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-header">
        <span class="item-title">Idea</span>
        <div class="item-actions">
          <button class="item-btn edit-btn" onclick="editIdea(${idea.id})" title="Edit Idea">✏️</button>
          <button class="item-btn delete-btn" onclick="deleteIdea(${idea.id})" title="Delete Idea">🗑️</button>
        </div>
      </div>
      <p class="item-desc">${escapeHTML(idea.text)}</p>
      <div class="item-meta">
        <span>📅 ${idea.date}</span>
      </div>
    `;
    list.appendChild(card);
  });
}

function saveIdea(text) {
  if (!text) return;
  const newIdea = {
    id: Date.now(),
    text: text,
    date: new Date().toLocaleDateString()
  };
  db.ideas.unshift(newIdea);
  saveToStorage('ideas', db.ideas);
  renderIdeas();
  playSoundSuccess();
  speak("Idea logged, Sir.", true);
  printConsole(`> Idea recorded: "${text}"`);
}

function deleteIdea(id) {
  db.ideas = db.ideas.filter(i => i.id !== id);
  saveToStorage('ideas', db.ideas);
  renderIdeas();
  playSoundClick();
  printConsole(`> Deleted idea index: ${id}`);
}

function editIdea(id) {
  const idea = db.ideas.find(i => i.id === id);
  if (!idea) return;
  showInputPrompt("Edit Idea", "Modify idea, Sir...", (value) => {
    if (value) {
      idea.text = value;
      saveToStorage('ideas', db.ideas);
      renderIdeas();
      playSoundSuccess();
      speak("Idea updated, Sir.", true);
      printConsole(`> Idea updated successfully. ID: ${id}`);
    } else {
      setAssistantState('idle');
    }
  });
}

// 5.4 PROJECTS CRUD
function renderProjects() {
  const list = document.getElementById('projects-list');
  list.innerHTML = '';

  let filtered = db.projects;
  if (searchQuery) {
    filtered = db.projects.filter(p => p.title.toLowerCase().includes(searchQuery) || p.description.toLowerCase().includes(searchQuery));
  }

  if (filtered.length === 0) {
    list.innerHTML = `<p class="empty-msg">${searchQuery ? 'No matching projects, Sir.' : 'No active projects, Sir.'}</p>`;
    return;
  }

  filtered.forEach(project => {
    let card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-header">
        <span class="item-title">${escapeHTML(project.title)}</span>
        <div class="item-actions">
          <button class="item-btn edit-btn" onclick="editProject(${project.id})" title="Edit Project">✏️</button>
          <button class="item-btn delete-btn" onclick="deleteProject(${project.id})" title="Delete Project">🗑️</button>
        </div>
      </div>
      <p class="item-desc">${escapeHTML(project.description)}</p>
      <div class="project-progress-bar">
        <div class="fill" style="width: ${project.progress || 20}%"></div>
      </div>
      <div class="item-meta">
        <span>Calibration: ${project.progress || 20}%</span>
        <span>📅 ${project.date}</span>
      </div>
    `;
    list.appendChild(card);
  });
}

function saveProject(title, description) {
  if (!title) return;
  const newProject = {
    id: Date.now(),
    title: title,
    description: description || "No specs provided, Sir.",
    progress: Math.floor(Math.random() * 40) + 15, // random decorative starting progress
    date: new Date().toLocaleDateString()
  };
  db.projects.unshift(newProject);
  saveToStorage('projects', db.projects);
  renderProjects();
  playSoundSuccess();
  speak("Project recorded to database, Sir.", true);
  printConsole(`> Project initialized: "${title}"`);
}

function deleteProject(id) {
  db.projects = db.projects.filter(p => p.id !== id);
  saveToStorage('projects', db.projects);
  renderProjects();
  playSoundClick();
  printConsole(`> Project retired: ID ${id}`);
}

function editProject(id) {
  const project = db.projects.find(p => p.id === id);
  if (!project) return;
  showInputPrompt("Edit Project Title", "Modify project name, Sir...", (newTitle) => {
    if (newTitle) {
      showInputPrompt("Edit Project Spec", "Modify details/description...", (newDesc) => {
        project.title = newTitle;
        project.description = newDesc || project.description;
        saveToStorage('projects', db.projects);
        renderProjects();
        playSoundSuccess();
        speak("Project specifications updated, Sir.", true);
        printConsole(`> Project details updated. ID: ${id}`);
      });
    } else {
      setAssistantState('idle');
    }
  });
}

// 5.5 DAILY PLANNER RENDERER
function renderDailyPlan() {
  const container = document.getElementById('daily-plan-content');
  const savedPlan = localStorage.getItem('jarvis_daily_plan');
  
  if (savedPlan) {
    container.innerHTML = savedPlan;
  } else {
    container.innerHTML = '<p class="empty-msg">No plan generated yet. Try "daily plan banao", Sir.</p>';
  }
}

// --- 6. CORE COMMANDS HANDLER (20 COMMANDS) ---

const funnyHindiCartoonIdeas = [
  "Sir, cartoon idea: Ek machhar jo Iron Man suit bana kar sab machharo ka neta banna chahta hai, par coil ki khushbu se behosh ho jata hai.",
  "Sir, cartoon idea: Ek lazy robot jo sirf chaipatti ki chori karta hai taaki wo self-charging mode me ja sake.",
  "Sir, cartoon idea: Ek smart pressure cooker jo khana pakhate waqt wifi connectivity kho deta hai aur gusse me seeti baja baja kar morse code me shikayat karta hai.",
  "Sir, cartoon idea: Ek smart bulb jo andhere se darta hai aur din bhar chalu rehna chahta hai, electricity bill dekhkar Tony Stark shocked ho jata hai.",
  "Sir, cartoon idea: Ek kabootar jo flying path coordinate kar raha hai par satellite internet down hone ki wajah se ped pe crash ho jata hai."
];

function handleCommand(commandString) {
  if (!commandString) return;
  
  const cleanCmd = commandString.toLowerCase().trim();
  
  // Track command history
  db.commands.unshift({ text: commandString, time: getTimestamp() });
  if (db.commands.length > 50) db.commands.pop();
  saveToStorage('commands', db.commands);

  // Command Sound
  playSoundClick();

  // 1. "Jarvis start"
  if (cleanCmd.includes("jarvis start") || cleanCmd.includes("wake up") || cleanCmd.includes("uth jao")) {
    setAssistantState('thinking');
    setTimeout(() => {
      speak("Welcome home, Sir. System status is nominal. Ready for queries.", true);
    }, 400);
    return;
  }

  // 2. "time batao" / "time"
  if (cleanCmd.includes("time") || cleanCmd.includes("samay") || cleanCmd.includes("time batao")) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const speakText = `Sir, current time is ${timeStr}.`;
    speak(speakText);
    printConsole(`> Time reported: ${timeStr}`);
    return;
  }

  // 3. "date batao" / "date"
  if (cleanCmd.includes("date") || cleanCmd.includes("tarikh") || cleanCmd.includes("date batao")) {
    const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const speakText = `Sir, today is ${dateStr}.`;
    speak(speakText);
    printConsole(`> Date reported: ${dateStr}`);
    return;
  }

  // 4. "google kholo"
  if (cleanCmd.includes("google kholo") || cleanCmd.includes("open google")) {
    speak("Opening Google, Sir.", true);
    printConsole("> Opening Google in a new tab...");
    window.open("https://www.google.com", "_blank");
    setAssistantState('idle');
    return;
  }

  // 5. "youtube kholo"
  if (cleanCmd.includes("youtube kholo") || cleanCmd.includes("open youtube")) {
    speak("Opening YouTube, Sir.", true);
    printConsole("> Opening YouTube in a new tab...");
    window.open("https://www.youtube.com", "_blank");
    setAssistantState('idle');
    return;
  }

  // 6. "notes kholo"
  if (cleanCmd.includes("notes kholo") || cleanCmd.includes("open notes")) {
    speak("Showing saved personal notes, Sir.", true);
    printConsole("> Accessing Notes Database...");
    document.getElementById('panel-notes').scrollIntoView({ behavior: 'smooth' });
    highlightPanel('panel-notes');
    setAssistantState('idle');
    return;
  }

  // 7. "mera note save karo"
  if (cleanCmd.includes("mera note save karo") || cleanCmd.includes("save note") || cleanCmd.includes("note save karo")) {
    // Check if we can capture note content directly from remainder of speech
    let extract = cleanCmd.replace("mera note save karo", "").replace("save note", "").replace("note save karo", "").trim();
    if (extract.length > 3) {
      saveNote(extract);
    } else {
      showInputPrompt("Save Note", "Enter note text, Sir...", (value) => {
        if (value) saveNote(value);
        else {
          speak("Note cancellation recorded, Sir.", true);
          setAssistantState('idle');
        }
      });
    }
    return;
  }

  // 8. "mere notes dikhao"
  if (cleanCmd.includes("mere notes dikhao") || cleanCmd.includes("show notes")) {
    if (db.notes.length === 0) {
      speak("You have no saved notes, Sir.", true);
    } else {
      speak(`Sir, listing all ${db.notes.length} saved notes in the console logs.`, true);
      printConsole("============= SAVED NOTES ==============");
      db.notes.forEach((note, idx) => {
        printConsole(`Note #${idx + 1} (${note.date}): "${note.text}"`);
      });
      printConsole("=========================================");
    }
    setAssistantState('idle');
    return;
  }

  // 9. "task add karo" / "add task"
  if (cleanCmd.includes("task add karo") || cleanCmd.includes("add task")) {
    let extract = cleanCmd.replace("task add karo", "").replace("add task", "").trim();
    if (extract.length > 3) {
      saveTask(extract);
    } else {
      showInputPrompt("Add Task", "Enter task details, Sir...", (value) => {
        if (value) saveTask(value);
        else {
          speak("Task cancelled, Sir.", true);
          setAssistantState('idle');
        }
      });
    }
    return;
  }

  // 10. "mere tasks dikhao"
  if (cleanCmd.includes("mere tasks dikhao") || cleanCmd.includes("show tasks")) {
    let pending = db.tasks.filter(t => !t.completed);
    if (db.tasks.length === 0) {
      speak("No active tasks found in memory, Sir.", true);
    } else {
      speak(`Sir, you have ${pending.length} pending tasks out of ${db.tasks.length} total tasks. Details printed in console.`, true);
      printConsole("============= ACTIVE TASKS ==============");
      db.tasks.forEach((t, idx) => {
        printConsole(`Task #${idx + 1}: [${t.completed ? 'COMPLETED' : 'PENDING'}] "${t.text}"`);
      });
      printConsole("=========================================");
    }
    setAssistantState('idle');
    return;
  }

  // 11. "idea save karo"
  if (cleanCmd.includes("idea save karo") || cleanCmd.includes("save idea")) {
    let extract = cleanCmd.replace("idea save karo", "").replace("save idea", "").trim();
    if (extract.length > 3) {
      saveIdea(extract);
    } else {
      showInputPrompt("Save Idea", "Log brainstorm idea, Sir...", (value) => {
        if (value) saveIdea(value);
        else {
          speak("Idea logging aborted, Sir.", true);
          setAssistantState('idle');
        }
      });
    }
    return;
  }

  // 12. "mere ideas dikhao"
  if (cleanCmd.includes("mere ideas dikhao") || cleanCmd.includes("show ideas")) {
    if (db.ideas.length === 0) {
      speak("No brainstorm items logged, Sir.", true);
    } else {
      speak(`Sir, displaying saved ideas in the logs.`, true);
      printConsole("============= BRAINSTORM IDEAS ==============");
      db.ideas.forEach((i, idx) => {
        printConsole(`Idea #${idx + 1} (${i.date}): "${i.text}"`);
      });
      printConsole("=============================================");
    }
    setAssistantState('idle');
    return;
  }

  // 13. "project add karo"
  if (cleanCmd.includes("project add karo") || cleanCmd.includes("add project")) {
    showInputPrompt("Project Title", "Enter project name, Sir...", (title) => {
      if (title) {
        showInputPrompt("Project Spec", "Enter project details/description...", (desc) => {
          saveProject(title, desc);
        });
      } else {
        speak("Project initialization aborted, Sir.", true);
        setAssistantState('idle');
      }
    });
    return;
  }

  // 14. "mere projects dikhao"
  if (cleanCmd.includes("mere projects dikhao") || cleanCmd.includes("show projects")) {
    if (db.projects.length === 0) {
      speak("No active projects on record, Sir.", true);
    } else {
      speak(`Listing all active projects in the system logs, Sir.`, true);
      printConsole("============= PROJECT DATAFRAME ==============");
      db.projects.forEach((p, idx) => {
        printConsole(`Project #${idx + 1}: "${p.title}" // Specs: "${p.description}" [Progress: ${p.progress}%]`);
      });
      printConsole("==============================================");
    }
    setAssistantState('idle');
    return;
  }

  // 15. "daily plan banao"
  if (cleanCmd.includes("daily plan banao") || cleanCmd.includes("generate plan") || cleanCmd.includes("make plan")) {
    generateDailyPlan();
    return;
  }

  // 16. "cartoon idea do"
  if (cleanCmd.includes("cartoon idea do") || cleanCmd.includes("cartoon idea") || cleanCmd.includes("tell cartoon idea")) {
    setAssistantState('thinking');
    setTimeout(() => {
      const idx = Math.floor(Math.random() * funnyHindiCartoonIdeas.length);
      const idea = funnyHindiCartoonIdeas[idx];
      speak(idea, true);
      printConsole(`> Idea Generated: ${idea}`);
    }, 400);
    return;
  }

  // 17. "status batao"
  if (cleanCmd.includes("status batao") || cleanCmd.includes("system status") || cleanCmd.includes("status check")) {
    setAssistantState('thinking');
    setTimeout(() => {
      let totalMem = db.notes.length + db.tasks.length + db.ideas.length + db.projects.length;
      let speechState = hiVoicesLoaded() ? "nominal (Hindi enabled)" : "standard English only";
      let speakText = `Sir, system diagnostics are nominal. Memory matrix has ${totalMem} indices. Voice engine is ${speechState}. System is fully calibrated.`;
      speak(speakText);
      printConsole("> System Diagnostics complete. All indicators running within parameter limits.");
    }, 400);
    return;
  }

  // 18. "clear notes"
  if (cleanCmd.includes("clear notes")) {
    playSoundAlert();
    showInputPrompt("Confirm Clear Notes", "Type 'CLEAR' to delete all notes, Sir...", (val) => {
      if (val === 'CLEAR') {
        db.notes = [];
        saveToStorage('notes', db.notes);
        renderNotes();
        playSoundSuccess();
        speak("All notes have been cleared, Sir.", true);
        printConsole("> Personal notes database completely wiped.");
      } else {
        speak("Operation cancelled, Sir.", true);
        setAssistantState('idle');
      }
    });
    return;
  }

  // 19. "clear tasks"
  if (cleanCmd.includes("clear tasks")) {
    playSoundAlert();
    showInputPrompt("Confirm Clear Tasks", "Type 'CLEAR' to delete all tasks, Sir...", (val) => {
      if (val === 'CLEAR') {
        db.tasks = [];
        saveToStorage('tasks', db.tasks);
        renderTasks();
        playSoundSuccess();
        speak("All tasks have been cleared, Sir.", true);
        printConsole("> Tasks database completely wiped.");
      } else {
        speak("Operation cancelled, Sir.", true);
        setAssistantState('idle');
      }
    });
    return;
  }

  // 20. "stop jarvis"
  if (cleanCmd.includes("stop jarvis") || cleanCmd.includes("goodbye") || cleanCmd.includes("stop listening")) {
    speak("System entering idle status. Standby, Sir.", true);
    setAssistantState('idle');
    if (recognition) recognition.stop();
    return;
  }

  // Default Fallback
  setAssistantState('thinking');
  setTimeout(() => {
    speak(`I did not understand the command "${commandString}", Sir. Please try again or type a request.`, true);
    printConsole(`> Unknown query: "${commandString}"`, "error");
  }, 400);
}

// Helpers
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function hiVoicesLoaded() {
  return voices.some(v => v.lang.startsWith('hi'));
}

function highlightPanel(id) {
  const panel = document.getElementById(id);
  if (panel) {
    panel.style.boxShadow = "0 0 25px var(--primary)";
    setTimeout(() => {
      panel.style.boxShadow = "";
    }, 2000);
  }
}

// Generates daily planner HTML out of tasks
function generateDailyPlan() {
  setAssistantState('thinking');
  const container = document.getElementById('daily-plan-content');
  let pendingTasks = db.tasks.filter(t => !t.completed);
  
  if (pendingTasks.length === 0) {
    setTimeout(() => {
      speak("Sir, you have no pending tasks to coordinate. Daily plan generation aborted.", true);
      printConsole("> Daily Planner: No pending tasks found. Planning aborted.", "error");
      setAssistantState('idle');
    }, 400);
    return;
  }

  setTimeout(() => {
    let planHTML = `<div class="data-list">`;
    let hours = [9, 11, 14, 16, 18]; // Schedule slots: 9 AM, 11 AM, 2 PM, 4 PM, 6 PM
    
    pendingTasks.forEach((task, idx) => {
      if (idx < hours.length) {
        let hr = hours[idx];
        let period = hr >= 12 ? "PM" : "AM";
        let dispHr = hr > 12 ? hr - 12 : hr;
        planHTML += `
          <div class="item-card">
            <span class="item-title">⏱️ ${dispHr}:00 ${period} - ALLOCATION</span>
            <p class="item-desc">${escapeHTML(task.text)}</p>
          </div>
        `;
      }
    });

    if (pendingTasks.length > hours.length) {
      planHTML += `
        <div class="item-card" style="border-color: var(--accent-amber)">
          <span class="item-title">⚠️ OVERFLOW WARNING</span>
          <p class="item-desc">Sir, you have ${pendingTasks.length - hours.length} additional tasks. Consider delegating them tomorrow.</p>
        </div>
      `;
    }

    planHTML += `</div>`;
    localStorage.setItem('jarvis_daily_plan', planHTML);
    container.innerHTML = planHTML;
    
    playSoundSuccess();
    speak("Sir, I have mapped your pending tasks to time slots. Your Daily Schedule is calculated.", true);
    printConsole("> Daily Plan successfully generated from active tasks database.");
    highlightPanel('panel-daily-plan');
  }, 400);
}

// --- 7. STATISTICS & METRICS COMPUTATION ---
function updateMemoryHarmonics() {
  const noteCount = db.notes.length;
  const taskCount = db.tasks.length;
  const ideaCount = db.ideas.length;
  const projectCount = db.projects.length;

  document.getElementById('note-count').innerText = noteCount;
  document.getElementById('task-count').innerText = taskCount;
  document.getElementById('idea-count').innerText = ideaCount;
  document.getElementById('project-count').innerText = projectCount;

  // Compute total elements
  const total = noteCount + taskCount + ideaCount + projectCount;
  document.getElementById('status-memory-idx').innerText = `${total} ITEMS`;
  
  // Fill progress bar (0 - 100 max item range)
  let percentage = Math.min((total / 100) * 100, 100);
  document.getElementById('status-memory-bar-fill').style.width = `${percentage}%`;

  // Calculate local storage size
  let stringified = JSON.stringify(localStorage);
  let bytes = stringified.length * 2; // UTF-16 bytes approx
  let kb = (bytes / 1024).toFixed(2);
  document.getElementById('status-storage-val').innerText = `${kb} KB`;
  
  // 5MB limit bar estimation (approx 5120 KB)
  let storagePct = Math.min((parseFloat(kb) / 5120) * 100, 100);
  document.getElementById('status-storage-fill').style.width = `${Math.max(storagePct, 2)}%`;
}

// --- 8. HUD HEADS-UP INITIALIZATION & TRIGGERS ---

// Boot screen progress simulation
function startBootSequence() {
  const progress = document.getElementById('boot-progress');
  const initBtn = document.getElementById('init-btn');
  const statusText = document.getElementById('boot-status-text');
  
  let val = 0;
  
  const step = () => {
    if (val < 100) {
      val += Math.floor(Math.random() * 15) + 5;
      if (val > 100) val = 100;
      progress.style.width = `${val}%`;
      
      // Decorative system loading outputs
      if (val < 30) statusText.innerText = "CALIBRATING OSCILLATORS...";
      else if (val < 60) statusText.innerText = "INDEXING LOCAL STORAGE DATABASE...";
      else if (val < 90) statusText.innerText = "RESOLVING AUDIO AND SPEECH ROUTINES...";
      else statusText.innerText = "J.A.R.V.I.S. READY FOR GUEST PROTOCOLS.";
      
      setTimeout(step, Math.random() * 200 + 80);
    } else {
      // Progress complete, show the Initialize Button
      initBtn.style.display = 'inline-block';
      statusText.style.color = "var(--primary)";
      statusText.style.textShadow = "0 0 8px var(--primary-glow)";
    }
  };
  
  setTimeout(step, 400);
}

// Clock updates
function updateClock() {
  const now = new Date();
  
  const timeStr = now.toLocaleTimeString([], { hour12: false });
  document.getElementById('hud-time').innerText = timeStr;
  
  const d = now.getDate().toString().padStart(2, '0');
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const y = now.getFullYear();
  document.getElementById('hud-date').innerText = `${d}.${m}.${y}`;
}

// --- 9. EVENT LISTENERS SETUP ---
document.addEventListener("DOMContentLoaded", () => {
  // Start boot sequence
  startBootSequence();
  
  // Clock Loop
  setInterval(updateClock, 1000);
  updateClock();

  // Mode Toggle Switcher
  const toggle = document.getElementById('mode-toggle');
  toggle.checked = jarvisMode;
  if (!jarvisMode) {
    document.body.classList.remove('jarvis-mode-active');
  }

  // Global Search Bar input listener
  const searchInput = document.getElementById('global-search');
  if (searchInput) {
    searchInput.value = searchQuery;
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderNotes();
      renderTasks();
      renderIdeas();
      renderProjects();
    });
  }

  // Theme Skin Selector
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.value = currentTheme;
    themeSelect.addEventListener('change', (e) => {
      currentTheme = e.target.value;
      localStorage.setItem('jarvis_theme', currentTheme);
      applyTheme(currentTheme);
      playSoundClick();
      printConsole(`> System theme color skin recalibrated to: ${currentTheme.toUpperCase()}`);
    });
  }

  toggle.addEventListener('change', (e) => {
    jarvisMode = e.target.checked;
    localStorage.setItem('jarvis_mode', jarvisMode);
    
    if (jarvisMode) {
      document.body.classList.add('jarvis-mode-active');
      printConsole("> J.A.R.V.I.S. Mode fully engaged. Holograms and scanlines online.");
      playSoundBoot();
      if (ambientHumEnabled) {
        startAmbientHum();
      }
    } else {
      document.body.classList.remove('jarvis-mode-active');
      printConsole("> Normal Mode engaged. Transitioning to clean metrics dashboard.");
      stopAmbientHum();
    }
    updateMemoryHarmonics();
  });

  // Welcome / Initialize Button handler
  document.getElementById('init-btn').addEventListener('click', () => {
    // Unlocks Audio Context
    initAudioContext();
    playSoundBoot();
    
    // Hide boot screen
    document.getElementById('boot-screen').classList.add('fade-out');
    
    // Display dashboard
    setTimeout(() => {
      document.getElementById('dashboard').classList.remove('dashboard-hidden');
      
      // Initialize systems
      initSpeechRecognition();
      renderNotes();
      renderTasks();
      renderIdeas();
      renderProjects();
      renderDailyPlan();
      updateMemoryHarmonics();
      startOscillatorAnimation();
      initSettingsListeners();
      if (ambientHumEnabled) {
        startAmbientHum();
      }
      
      // Verbal welcome
      setTimeout(() => {
        speak("System is ready, Sir. Welcome home. I am J.A.R.V.I.S., your personal AI assistant.", true);
      }, 800);
    }, 800);
  });

  // Text inputs listener
  const textInput = document.getElementById('text-input');
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = textInput.value.trim();
      if (val) {
        printConsole(`Sir: "${val}"`, "user");
        textInput.value = "";
        handleCommand(val);
      }
    }
  });

  // Mic Button handler
  document.getElementById('mic-btn').addEventListener('click', triggerListening);

  // Modal Warning Close
  document.getElementById('warning-close-btn').addEventListener('click', () => {
    document.getElementById('warning-modal').classList.add('modal-hidden');
    playSoundClick();
  });

  // --- FOOTER BUTTON QUICK ACTIONS ---
  
  // Start Jarvis (Force Welcome)
  document.getElementById('btn-start').addEventListener('click', () => {
    handleCommand("jarvis start");
  });

  // Listen (Mic trigger)
  document.getElementById('btn-listen').addEventListener('click', triggerListening);

  // Stop (Silence & standby)
  document.getElementById('btn-stop').addEventListener('click', () => {
    handleCommand("stop jarvis");
  });

  // Add Note
  document.getElementById('btn-add-note').addEventListener('click', () => {
    handleCommand("mera note save karo");
  });
  document.getElementById('btn-panel-add-note').addEventListener('click', () => {
    handleCommand("mera note save karo");
  });

  // Add Task
  document.getElementById('btn-add-task').addEventListener('click', () => {
    handleCommand("task add karo");
  });
  document.getElementById('btn-panel-add-task').addEventListener('click', () => {
    handleCommand("task add karo");
  });

  // Add Idea
  document.getElementById('btn-add-idea').addEventListener('click', () => {
    handleCommand("idea save karo");
  });
  document.getElementById('btn-panel-add-idea').addEventListener('click', () => {
    handleCommand("idea save karo");
  });

  // Add Project
  document.getElementById('btn-add-project').addEventListener('click', () => {
    handleCommand("project add karo");
  });
  document.getElementById('btn-panel-add-project').addEventListener('click', () => {
    handleCommand("project add karo");
  });

  // Show Daily Plan
  document.getElementById('btn-show-plan').addEventListener('click', () => {
    handleCommand("daily plan banao");
  });
  document.getElementById('btn-panel-gen-plan').addEventListener('click', () => {
    handleCommand("daily plan banao");
  });

  // Open YouTube
  document.getElementById('btn-youtube').addEventListener('click', () => {
    handleCommand("youtube kholo");
  });

  // Open Google
  document.getElementById('btn-google').addEventListener('click', () => {
    handleCommand("google kholo");
  });

  // Clear Console logs
  document.getElementById('btn-clear-console').addEventListener('click', () => {
    playSoundClick();
    document.getElementById('console-history').innerHTML = `
      <div class="console-line system-line">&gt; Console buffer cleared, Sir. Core standby.</div>
    `;
    printConsole("> System log cleared.");
  });

});

// --- OSCILLATOR CANVAS VISUALIZATION ---
let oscCanvas = null;
let oscCtx = null;
let oscAnimationId = null;
let oscPhase = 0;

function startOscillatorAnimation() {
  oscCanvas = document.getElementById('oscillator-canvas');
  if (!oscCanvas) return;
  oscCtx = oscCanvas.getContext('2d');
  
  // Set resolution
  resizeOscCanvas();
  window.addEventListener('resize', resizeOscCanvas);
  
  function draw() {
    if (!oscCanvas || !oscCtx) return;
    
    // Clear canvas
    oscCtx.clearRect(0, 0, oscCanvas.width, oscCanvas.height);
    
    // Base configuration based on mode
    let colors = {
      primary: jarvisMode ? 'rgba(0, 210, 255, 0.85)' : 'rgba(56, 189, 248, 0.85)',
      secondary: jarvisMode ? 'rgba(0, 102, 255, 0.35)' : 'rgba(14, 165, 233, 0.35)'
    };
    
    // Determine amplitude and frequency multiplier based on state
    let baseAmp = 3;
    let baseFreq = 0.05;
    let speed = 0.05;
    
    if (assistantState === 'listening') {
      baseAmp = 6;
      baseFreq = 0.08;
      speed = 0.12;
    } else if (assistantState === 'thinking') {
      baseAmp = 2;
      baseFreq = 0.15;
      speed = 0.2;
    } else if (assistantState === 'speaking') {
      baseAmp = 8 + Math.sin(oscPhase * 3) * 3; // Modulate speaking amplitude
      baseFreq = 0.06;
      speed = 0.1;
    }
    
    const width = oscCanvas.width;
    const height = oscCanvas.height;
    const midY = height / 2;
    
    // Draw background grid lines inside the canvas for tech look
    oscCtx.strokeStyle = jarvisMode ? 'rgba(0, 210, 255, 0.06)' : 'rgba(56, 189, 248, 0.06)';
    oscCtx.lineWidth = 1;
    for (let x = 0; x < width; x += 30) {
      oscCtx.beginPath();
      oscCtx.moveTo(x, 0);
      oscCtx.lineTo(x, height);
      oscCtx.stroke();
    }
    
    // Draw 3 layers of waves
    // Layer 1: Secondary wave (underlay)
    oscCtx.strokeStyle = colors.secondary;
    oscCtx.lineWidth = 1;
    oscCtx.beginPath();
    for (let x = 0; x < width; x++) {
      let y = midY + Math.sin(x * (baseFreq * 0.5) - oscPhase) * (baseAmp * 0.6) + Math.cos(x * 0.01 + oscPhase) * 2;
      if (x === 0) oscCtx.moveTo(x, y);
      else oscCtx.lineTo(x, y);
    }
    oscCtx.stroke();
    
    // Layer 2: Main primary wave
    oscCtx.strokeStyle = colors.primary;
    oscCtx.lineWidth = 1.5;
    oscCtx.shadowBlur = jarvisMode ? 6 : 0;
    oscCtx.shadowColor = colors.primary;
    oscCtx.beginPath();
    for (let x = 0; x < width; x++) {
      let y = midY + Math.sin(x * baseFreq + oscPhase) * baseAmp;
      if (x === 0) oscCtx.moveTo(x, y);
      else oscCtx.lineTo(x, y);
    }
    oscCtx.stroke();
    
    // Reset shadow
    oscCtx.shadowBlur = 0;
    
    // Layer 3: Noise/chaos wave (only when thinking)
    if (assistantState === 'thinking') {
      oscCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      oscCtx.lineWidth = 0.5;
      oscCtx.beginPath();
      for (let x = 0; x < width; x += 2) {
        let y = midY + (Math.random() - 0.5) * 6;
        if (x === 0) oscCtx.moveTo(x, y);
        else oscCtx.lineTo(x, y);
      }
      oscCtx.stroke();
    }
    
    // Update Phase
    oscPhase += speed;
    
    oscAnimationId = requestAnimationFrame(draw);
  }
  
  draw();
}

function resizeOscCanvas() {
  if (!oscCanvas) return;
  const rect = oscCanvas.getBoundingClientRect();
  oscCanvas.width = rect.width || 300;
  oscCanvas.height = rect.height || 26;
}

// --- 10. SYSTEM CONFIGURATION & SETTINGS HANDLERS ---
function initSettingsListeners() {
  const settingsModal = document.getElementById('settings-modal');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsClose = document.getElementById('settings-close');
  const settingsClearAll = document.getElementById('settings-clear-all');
  
  const rateInput = document.getElementById('setting-speech-rate');
  const pitchInput = document.getElementById('setting-speech-pitch');
  const volumeInput = document.getElementById('setting-fx-volume');
  const voiceToggle = document.getElementById('setting-voice-toggle');
  const humToggle = document.getElementById('setting-hum-toggle');

  if (!settingsModal) return;

  // Open settings
  settingsBtn.addEventListener('click', () => {
    playSoundClick();
    // Load fresh states into controls
    rateInput.value = speechRate;
    pitchInput.value = speechPitch;
    volumeInput.value = fxVolume;
    voiceToggle.checked = voiceFeedbackEnabled;
    humToggle.checked = ambientHumEnabled;
    
    settingsModal.classList.remove('modal-hidden');
  });

  // Close settings
  settingsClose.addEventListener('click', () => {
    playSoundClick();
    settingsModal.classList.add('modal-hidden');
  });

  // Handle inputs
  rateInput.addEventListener('change', (e) => {
    speechRate = parseFloat(e.target.value);
    localStorage.setItem('jarvis_speech_rate', speechRate);
  });

  pitchInput.addEventListener('change', (e) => {
    speechPitch = parseFloat(e.target.value);
    localStorage.setItem('jarvis_speech_pitch', speechPitch);
  });

  volumeInput.addEventListener('change', (e) => {
    fxVolume = parseFloat(e.target.value);
    localStorage.setItem('jarvis_fx_volume', fxVolume);
    // Update ambient hum gain if running
    if (humGain && audioCtx) {
      humGain.gain.setValueAtTime(fxVolume * 0.02, audioCtx.currentTime);
    }
  });

  voiceToggle.addEventListener('change', (e) => {
    voiceFeedbackEnabled = e.target.checked;
    localStorage.setItem('jarvis_voice_feedback', voiceFeedbackEnabled);
    if (!voiceFeedbackEnabled && synth) {
      synth.cancel();
    }
  });

  humToggle.addEventListener('change', (e) => {
    ambientHumEnabled = e.target.checked;
    localStorage.setItem('jarvis_ambient_hum', ambientHumEnabled);
    if (ambientHumEnabled) {
      startAmbientHum();
    } else {
      stopAmbientHum();
    }
  });

  // Wipe data
  settingsClearAll.addEventListener('click', () => {
    playSoundAlert();
    showInputPrompt("WIPE ENTIRE DATABASE", "Type 'DELETE' to confirm database wipe...", (val) => {
      if (val === 'DELETE') {
        localStorage.clear(); // Wipes everything
        
        // Re-load defaults
        db = { notes: [], tasks: [], ideas: [], projects: [], commands: [] };
        jarvisMode = true;
        currentTheme = 'cyan';
        speechRate = 1.0;
        speechPitch = 0.95;
        fxVolume = 0.8;
        voiceFeedbackEnabled = true;
        ambientHumEnabled = false;
        searchQuery = "";

        // Reset inputs
        document.getElementById('global-search').value = "";
        document.getElementById('mode-toggle').checked = true;
        document.getElementById('theme-select').value = "cyan";
        
        applyTheme('cyan');
        stopAmbientHum();
        
        renderNotes();
        renderTasks();
        renderIdeas();
        renderProjects();
        renderDailyPlan();
        updateMemoryHarmonics();
        
        playSoundSuccess();
        speak("System wiped. Cache deleted. Database reset to default configurations.", true);
        printConsole("> Core databases and settings wiped clean, Sir.");
        
        settingsModal.classList.add('modal-hidden');
      } else {
        speak("Database purge aborted, Sir.", true);
        setAssistantState('idle');
      }
    });
  });
}

// --- 11. AMBIENT LABORATORY HUM AUDIO ---
let humOsc1 = null;
let humOsc2 = null;
let humGain = null;

function startAmbientHum() {
  if (!jarvisMode) return;
  initAudioContext();
  if (humOsc1) return; // Already running

  humGain = audioCtx.createGain();
  humGain.connect(audioCtx.destination);
  humGain.gain.setValueAtTime(fxVolume * 0.02, audioCtx.currentTime); // keep hum subtle

  // Oscillator 1: 55Hz (A1 note)
  humOsc1 = audioCtx.createOscillator();
  humOsc1.type = 'sine';
  humOsc1.frequency.setValueAtTime(55, audioCtx.currentTime);
  
  // Oscillator 2: 110Hz (A2 note, harmonic resonance)
  humOsc2 = audioCtx.createOscillator();
  humOsc2.type = 'triangle';
  humOsc2.frequency.setValueAtTime(110, audioCtx.currentTime);
  
  // Create lowpass filter to remove harsh high frequencies from triangle
  let filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(80, audioCtx.currentTime);

  humOsc1.connect(humGain);
  humOsc2.connect(filter);
  filter.connect(humGain);

  humOsc1.start();
  humOsc2.start();
  printConsole("> Ambient laboratory hum loop initialized.");
}

function stopAmbientHum() {
  if (humOsc1) {
    try {
      humOsc1.stop();
      humOsc2.stop();
    } catch (e) {
      console.warn("Failed to stop hum", e);
    }
    humOsc1 = null;
    humOsc2 = null;
    humGain = null;
    printConsole("> Ambient laboratory hum offline.");
  }
}

