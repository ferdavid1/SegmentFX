// js/main.js

import { 
    autoSegment, 
    manualSegment, 
    getProjectDetails, 
    getSequenceDetails, 
    getAvailableEffects,
    logError,
    debugLog,
    openLogFile,
    applyMultipleEffects, 
    addExtendScriptEventListener 
} from './host_communication.js';

debugLog('main.js loaded');

// Add this at the beginning of the file
window.onerror = function(message, source, lineno, colno, error) {
    console.error('An error occurred:', error);
    debugLog('Uncaught error: ' + message);
    return true;
};

// Initialize the CSInterface
const csInterface = new CSInterface();

// Function to load all effects
async function loadEffects() {
    try {
        const effects = await getAvailableEffects();
        const effectList = document.getElementById('effectList');
        effectList.innerHTML = '';
        effects.forEach(effect => {
            const option = document.createElement('option');
            option.value = JSON.stringify(effect);
            option.textContent = `${effect.name} (${effect.type})`;
            effectList.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading effects:', error);
        updateStatus('Failed to load effects');
    }
}

// Function to add effect to stack
function addEffectToStack(effect) {
    const effectStack = document.getElementById('effectStack');
    const effectDiv = document.createElement('div');
    effectDiv.className = 'effect-item';
    effectDiv.textContent = effect.name;
    
    if (effect.type === 'custom') {
        const paramInput = document.createElement('input');
        paramInput.type = 'text';
        paramInput.placeholder = 'Parameters (JSON)';
        effectDiv.appendChild(paramInput);
    }
    
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.onclick = function() {
        effectStack.removeChild(effectDiv);
    };
    effectDiv.appendChild(removeButton);
    
    effectStack.appendChild(effectDiv);
}

// Function to perform auto segmentation
async function performAutoSegment() {
    const objectCount = document.getElementById('objectCountInput').value;
    updateStatus('Starting auto segmentation...');
    try {
        const result = await autoSegment(objectCount);
        console.log(result);
        updateStatus('Auto segmentation complete');
    } catch (error) {
        console.error('Auto segmentation error:', error);
        updateStatus('Auto segmentation failed');
    }
}

// Function to perform manual segmentation
async function performManualSegment() {
    const canvas = document.getElementById('drawingCanvas');
    const imageData = canvas.toDataURL();
    updateStatus('Starting manual segmentation...');
    try {
        const result = await manualSegment(imageData);
        console.log(result);
        updateStatus('Manual segmentation complete');
    } catch (error) {
        console.error('Manual segmentation error:', error);
        updateStatus('Manual segmentation failed');
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
        const details = await getProjectDetails();
        document.getElementById('projectName').textContent = details.name;
        document.getElementById('projectPath').textContent = details.path;
        document.getElementById('sequenceCount').textContent = details.sequences;
    } catch (error) {
        console.error('Error loading project details:', error);
        updateStatus('Failed to load project details');
    }
}

// Function to load and display sequence details
async function loadSequenceDetails() {
    try {
        const details = await getSequenceDetails();
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
        console.error('Error loading sequence details:', error);
        updateStatus('Failed to load sequence details');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    debugLog('DOMContentLoaded event fired');

    setupDrawingCanvas();
    loadProjectDetails();
    loadSequenceDetails();

    // Add a button to open log file
    const openLogButton = document.createElement('button');
    openLogButton.textContent = 'Open Log File';
    openLogButton.addEventListener('click', openLogFile);
    document.body.appendChild(openLogButton);

    debugLog('Open Log File button added');

    // Attempt to load effects and catch any errors
    loadEffects().catch(error => {
        console.error('Failed to load effects:', error);
        openLogFile();
    });

    document.getElementById('autoSegmentButton').addEventListener('click', performAutoSegment);
    document.getElementById('manualSegmentButton').addEventListener('click', performManualSegment);
    document.getElementById('clearCanvasButton').addEventListener('click', clearCanvas);
    document.getElementById('applyEffectButton').addEventListener('click', applySelectedEffect);
    document.getElementById('refreshDetailsButton').addEventListener('click', () => {
        loadProjectDetails();
        loadSequenceDetails();
    });

    // Event listener for add effect button
    document.getElementById('addEffectButton').addEventListener('click', function() {
        const selectedEffects = Array.from(document.getElementById('effectList').selectedOptions);
        selectedEffects.forEach(option => {
            const effect = JSON.parse(option.value);
            addEffectToStack(effect);
        });
    });

    // Event listener for apply effects button
    document.getElementById('applyEffectsButton').addEventListener('click', function() {
        const trackIndex = parseInt(document.getElementById('trackIndexInput').value, 10);
        const clipIndex = parseInt(document.getElementById('clipIndexInput').value, 10);
        
        const effectStack = document.getElementById('effectStack');
        const effects = Array.from(effectStack.children).map(effectDiv => {
            const effect = JSON.parse(effectDiv.firstChild.textContent);
            if (effect.type === 'custom') {
                effect.parameters = JSON.parse(effectDiv.querySelector('input').value || '{}');
            }
            return effect;
        });
        
        try {
            const result = await applyMultipleEffects(clipIndex, trackIndex, effects);
            console.log(result);
            alert('Effects applied successfully!');
        } catch (error) {
            console.error('Error applying effects:', error);
            alert('Failed to apply effects. Check the console for details.');
        }
    });
});

window.onerror = function(message, source, lineno, colno, error) {
    debugLog('Uncaught error: ' + message);
    return true;
};

// Event listener for messages from ExtendScript
addExtendScriptEventListener('SegmentationComplete', function(event) {
    updateStatus(event.data);
});

// Load effects when the panel opens
window.addEventListener('load', loadEffects);