// js/main.js

// Initialize the CSInterface
const csInterface = new CSInterface();

// Function to call ExtendScript functions
function callExtendScript(functionName, ...args) {
    return new Promise((resolve, reject) => {
        csInterface.evalScript(`${functionName}(${JSON.stringify(args).slice(1, -1)})`, (result) => {
            if (result === 'EvalScript error.') {
                reject(new Error('ExtendScript error'));
            } else {
                resolve(result);
            }
        });
    });
}

// Function to perform auto segmentation
async function performAutoSegment() {
    try {
        const objectCount = document.getElementById('objectCountInput').value;
        updateStatus('Starting auto segmentation...');
        await callExtendScript('autoSegment', objectCount);
        updateStatus('Auto segmentation complete');
    } catch (error) {
        updateStatus('Error during auto segmentation: ' + error.message);
    }
}

// Function to perform manual segmentation
async function performManualSegment() {
    try {
        const canvas = document.getElementById('drawingCanvas');
        const imageData = canvas.toDataURL();
        updateStatus('Starting manual segmentation...');
        await callExtendScript('manualSegment', imageData);
        updateStatus('Manual segmentation complete');
    } catch (error) {
        updateStatus('Error during manual segmentation: ' + error.message);
    }
}

// Function to update the status display
function updateStatus(message) {
    document.getElementById('statusMessage').textContent = message;
}

// Function to handle drawing on the canvas
function setupDrawingCanvas() {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    let isDrawing = false;

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    function startDrawing(e) {
        isDrawing = true;
        draw(e);
    }

    function draw(e) {
        if (!isDrawing) return;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';

        ctx.lineTo(e.clientX - canvas.offsetLeft, e.clientY - canvas.offsetTop);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(e.clientX - canvas.offsetLeft, e.clientY - canvas.offsetTop);
    }

    function stopDrawing() {
        isDrawing = false;
        ctx.beginPath();
    }
}

// Function to clear the drawing canvas
function clearCanvas() {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Function to load and display project details
async function loadProjectDetails() {
    try {
        const details = await callExtendScript('getProjectDetails');
        document.getElementById('projectName').textContent = details.name;
        document.getElementById('projectPath').textContent = details.path;
        document.getElementById('sequenceCount').textContent = details.sequences;
    } catch (error) {
        updateStatus('Error loading project details: ' + error.message);
    }
}

// Function to load and display sequence details
async function loadSequenceDetails() {
    try {
        const details = await callExtendScript('getSequenceDetails');
        if (details) {
            document.getElementById('sequenceName').textContent = details.name;
            document.getElementById('sequenceFramerate').textContent = details.framerate;
            document.getElementById('sequenceDuration').textContent = details.duration;
            document.getElementById('videoTrackCount').textContent = details.videoTracks;
            document.getElementById('audioTrackCount').textContent = details.audioTracks;
        } else {
            updateStatus('No active sequence');
        }
    } catch (error) {
        updateStatus('Error loading sequence details: ' + error.message);
    }
}

// Function to load available effects
async function loadAvailableEffects() {
    try {
        const effects = await callExtendScript('getAvailableEffects');
        const selectElement = document.getElementById('effectSelect');
        selectElement.innerHTML = '';
        effects.forEach(effect => {
            const option = document.createElement('option');
            option.value = effect;
            option.textContent = effect;
            selectElement.appendChild(option);
        });
    } catch (error) {
        updateStatus('Error loading effects: ' + error.message);
    }
}

// Function to apply selected effect
async function applySelectedEffect() {
    try {
        const effectName = document.getElementById('effectSelect').value;
        const clipIndex = document.getElementById('clipIndexInput').value;
        const trackIndex = document.getElementById('trackIndexInput').value;
        const result = await callExtendScript('applyEffectToClip', clipIndex, trackIndex, effectName);
        if (result) {
            updateStatus('Effect applied successfully');
        } else {
            updateStatus('Failed to apply effect');
        }
    } catch (error) {
        updateStatus('Error applying effect: ' + error.message);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    setupDrawingCanvas();
    loadProjectDetails();
    loadSequenceDetails();
    loadAvailableEffects();

    document.getElementById('autoSegmentButton').addEventListener('click', performAutoSegment);
    document.getElementById('manualSegmentButton').addEventListener('click', performManualSegment);
    document.getElementById('clearCanvasButton').addEventListener('click', clearCanvas);
    document.getElementById('applyEffectButton').addEventListener('click', applySelectedEffect);
    document.getElementById('refreshDetailsButton').addEventListener('click', () => {
        loadProjectDetails();
        loadSequenceDetails();
    });
});

// Event listener for messages from ExtendScript
csInterface.addEventListener('SegmentationComplete', (event) => {
    updateStatus(event.data);
});