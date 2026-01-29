// Configuration
let roverIP = '192.168.1.100';
let lastCommand = 'stop';
let failCount = 0;
let currentMode = 'manual';

// DOM Elements
const statusEl = document.getElementById('connection-status');
const signalEl = document.getElementById('signal-strength');
const batteryEl = document.getElementById('battery');
const actionEl = document.getElementById('current-action');
const activeModeEl = document.getElementById('active-mode');
const ipInput = document.getElementById('rover-ip');
const modeDescEl = document.getElementById('mode-description');
const manualControls = document.getElementById('manual-controls');
const speedControl = document.getElementById('speed-control');
const autoDisplay = document.getElementById('auto-display');
const keyboardHelp = document.getElementById('keyboard-help');
const distanceValue = document.getElementById('distance-value');
const distanceInfo = document.getElementById('distance-info');
const distanceRow = document.getElementById('distance-row');

// Mode descriptions
const modeDescriptions = {
    manual: '<strong>Manual Mode:</strong> Control the rover with buttons or keyboard',
    autonomous: '<strong>Autonomous Mode:</strong> Rover avoids obstacles automatically using ultrasonic sensor'
};

// ============== INITIALIZATION ==============

document.addEventListener('DOMContentLoaded', () => {
    // Load saved IP
    const savedIP = localStorage.getItem('roverIP');
    if (savedIP) {
        roverIP = savedIP;
        ipInput.value = savedIP;
    }

    // Load saved mode
    const savedMode = localStorage.getItem('controlMode');
    if (savedMode && savedMode === 'autonomous') {
        switchMode(savedMode);
    }

    // Start status updates
    setInterval(fetchStatus, 1000);

    // Setup keyboard controls
    setupKeyboardControls();
});

// ============== CONNECTION ==============

function connectRover() {
    roverIP = ipInput.value.trim();
    
    if (!roverIP) {
        alert('Please enter a valid IP address!');
        return;
    }
    
    localStorage.setItem('roverIP', roverIP);
    
    console.log('Connecting to:', roverIP);
    statusEl.textContent = '🔄 Connecting...';
    statusEl.className = 'status';
    
    fetchStatus();
}

// ============== MODE SWITCHING ==============

async function switchMode(mode) {
    currentMode = mode;
    localStorage.setItem('controlMode', mode);
    
    // Update UI
    updateModeUI(mode);
    
    // Update mode description
    modeDescEl.innerHTML = modeDescriptions[mode];
    
    // Update active mode display
    activeModeEl.textContent = mode;
    
    // Send mode change to rover
    try {
        await fetch(`http://${roverIP}/mode?mode=${mode}`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });
        
        console.log('Mode switched to:', mode);
        
        // If switching to manual, stop the rover
        if (mode === 'manual') {
            move('stop');
        }
        
    } catch (error) {
        console.error('Mode switch failed:', error);
    }
}

function updateModeUI(mode) {
    // Update mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        }
    });
    
    // Show/hide controls based on mode
    if (mode === 'manual') {
        // Show manual controls
        manualControls.style.display = 'grid';
        speedControl.style.display = 'block';
        keyboardHelp.style.display = 'block';
        autoDisplay.style.display = 'none';
        distanceRow.style.display = 'none';
    } else {
        // Hide manual controls, show autonomous display
        manualControls.style.display = 'none';
        speedControl.style.display = 'none';
        keyboardHelp.style.display = 'none';
        autoDisplay.style.display = 'block';
        distanceRow.style.display = 'flex';
    }
}

// ============== MANUAL CONTROL ==============

async function move(direction) {
    if (currentMode !== 'manual') {
        console.log('Not in manual mode, ignoring command');
        return;
    }
    
    // Toggle: if same button pressed, stop
    if (lastCommand === direction && direction !== 'stop') {
        direction = 'stop';
    }
    
    lastCommand = direction;
    actionEl.textContent = direction;
    
    // Visual feedback
    highlightButton(direction);
    
    try {
        const response = await fetch(`http://${roverIP}/action?go=${direction}`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
            updateConnectionStatus(true);
        }
    } catch (error) {
        console.error('Command failed:', error);
        updateConnectionStatus(false);
    }
}

async function updateSpeed(value) {
    document.getElementById('speed-display').textContent = value;
    
    try {
        await fetch(`http://${roverIP}/speed?val=${value}`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });
    } catch (error) {
        console.error('Speed update failed:', error);
    }
}

function highlightButton(direction) {
    document.querySelectorAll('.control-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const buttons = document.querySelectorAll('.control-btn');
    buttons.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(direction)) {
            btn.classList.add('active');
            setTimeout(() => btn.classList.remove('active'), 200);
        }
    });
}

// ============== STATUS UPDATES ==============

async function fetchStatus() {
    try {
        const response = await fetch(`http://${roverIP}/status`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Update UI
            batteryEl.textContent = `${data.battery.toFixed(2)} V`;
            signalEl.textContent = `Signal: ${data.rssi} dBm`;
            actionEl.textContent = data.command;
            
            // Update distance if available
            if (data.distance !== undefined && data.distance !== null) {
                const dist = data.distance > 0 ? `${data.distance} cm` : '-- cm';
                if (distanceValue) distanceValue.textContent = dist;
                if (distanceInfo) distanceInfo.textContent = dist;
                
                // Color code based on distance (only in autonomous)
                if (currentMode === 'autonomous' && data.distance > 0) {
                    if (data.distance < 15) {
                        distanceValue.style.color = '#f56565'; // Red - too close!
                    } else if (data.distance < 35) {
                        distanceValue.style.color = '#f6ad55'; // Orange - warning
                    } else {
                        distanceValue.style.color = '#48bb78'; // Green - safe
                    }
                }
            }
            
            // Sync mode if different
            if (data.mode && data.mode !== currentMode) {
                switchMode(data.mode);
            }
            
            updateConnectionStatus(true);
        }
    } catch (error) {
        console.error('Status fetch failed:', error);
        updateConnectionStatus(false);
    }
}

function updateConnectionStatus(connected) {
    if (connected) {
        statusEl.textContent = '✅ Connected';
        statusEl.className = 'status connected';
        failCount = 0;
    } else {
        failCount++;
        if (failCount > 3) {
            statusEl.textContent = '⚠️ Disconnected';
            statusEl.className = 'status disconnected';
            signalEl.textContent = 'Signal: --';
        }
    }
}

// ============== KEYBOARD CONTROLS ==============

function setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
        // Emergency stop (works in all modes)
        if (e.key === 'Escape') {
            e.preventDefault();
            emergencyStop();
            return;
        }
        
        // Mode switch keys
        if (e.key.toLowerCase() === 'm') {
            e.preventDefault();
            switchMode('manual');
            return;
        }
        
        if (e.key.toLowerCase() === 'a' && e.ctrlKey) {
            e.preventDefault();
            switchMode('autonomous');
            return;
        }
        
        // Manual controls (only work in manual mode)
        if (currentMode !== 'manual') return;
        
        switch(e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                e.preventDefault();
                move('forward');
                break;
            case 's':
            case 'arrowdown':
                e.preventDefault();
                move('backward');
                break;
            case 'a':
            case 'arrowleft':
                e.preventDefault();
                move('left');
                break;
            case 'd':
            case 'arrowright':
                e.preventDefault();
                move('right');
                break;
            case ' ':
                e.preventDefault();
                move('stop');
                break;
        }
    });
}

// ============== EMERGENCY FUNCTIONS ==============

async function emergencyStop() {
    console.log('🚨 EMERGENCY STOP!');
    
    // Switch to manual mode
    await switchMode('manual');
    
    // Send stop command
    await move('stop');
    
    // Visual feedback
    const originalBg = document.body.style.background;
    document.body.style.background = '#dc2626';
    setTimeout(() => {
        document.body.style.background = originalBg;
    }, 300);
    
    console.log('Emergency stop executed');
}

// ============== EXPORT FUNCTIONS ==============

window.move = move;
window.updateSpeed = updateSpeed;
window.connectRover = connectRover;
window.switchMode = switchMode;