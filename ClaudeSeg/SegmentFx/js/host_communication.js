// js/host_communication.js

// Initialize the CSInterface
const csInterface = new CSInterface();

// Utility function to call ExtendScript functions
function callExtendScript(functionName, ...args) {
    return new Promise((resolve, reject) => {
        csInterface.evalScript(`${functionName}(${JSON.stringify(args).slice(1, -1)})`, (result) => {
            if (result === 'EvalScript error.') {
                reject(new Error('ExtendScript error'));
            } else {
                try {
                    // Try to parse the result as JSON
                    resolve(JSON.parse(result));
                } catch (e) {
                    // If it's not JSON, return the raw result
                    resolve(result);
                }
            }
        });
    });
}

// Function to perform auto segmentation
function autoSegment(objectCount) {
    return callExtendScript('autoSegment', objectCount);
}

// Function to perform manual segmentation
function manualSegment(imageData) {
    return callExtendScript('manualSegment', imageData);
}

// Function to get project details
function getProjectDetails() {
    return callExtendScript('getProjectDetails');
}

// Function to get sequence details
function getSequenceDetails() {
    return callExtendScript('getSequenceDetails');
}

// Function to get available effects
function getAvailableEffects() {
    return callExtendScript('getAvailableEffects');
}

// Function to apply an effect to a clip
function applyEffectToClip(clipIndex, trackIndex, effectName) {
    return callExtendScript('applyEffectToClip', clipIndex, trackIndex, effectName);
}

// Function to import masks to timeline
function importMasksToTimeline(outputDir) {
    return callExtendScript('importMasksToTimeline', outputDir);
}

// Add event listener for messages from ExtendScript
function addExtendScriptEventListener(eventType, callback) {
    csInterface.addEventListener(eventType, callback);
}

// Export all functions
export {
    autoSegment,
    manualSegment,
    getProjectDetails,
    getSequenceDetails,
    getAvailableEffects,
    applyEffectToClip,
    importMasksToTimeline,
    addExtendScriptEventListener
};