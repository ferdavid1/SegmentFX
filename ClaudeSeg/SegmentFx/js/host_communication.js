// js/host_communication.js

// Initialize the CSInterface
const csInterface = new CSInterface();

function logError(error) {
    const logPath = csInterface.getSystemPath(SystemPath.MY_DOCUMENTS) + '/adobe_cep_logs.txt';
    const message = `${new Date().toISOString()}: ${error.toString()}\n`;
    const command = `echo "${message}" >> "${logPath}"`;
    system.callSystem(command);
}

function openLogFile() {
    const logPath = csInterface.getSystemPath(SystemPath.MY_DOCUMENTS) + '/adobe_cep_logs.txt';
    csInterface.openURLInDefaultBrowser('file://' + logPath);
}

// Utility function to call ExtendScript functions
function callExtendScript(functionName, ...args) {
    return new Promise((resolve, reject) => {
        csInterface.evalScript(`${functionName}(${JSON.stringify(args).slice(1, -1)})`, (result) => {
            if (result === 'EvalScript error.') {
                const error = new Error('ExtendScript error');
                logError(error);
                reject(error);
            } else {
                try {
                    resolve(JSON.parse(result));
                } catch (e) {
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
    return callExtendScript('getAllEffects');
}

// Function to apply multiple effects to a clip
function applyMultipleEffects(clipIndex, trackIndex, effects) {
    return callExtendScript('applyMultipleEffects', clipIndex, trackIndex, effects);
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
    openLogFile,
    importMasksToTimeline,
    addExtendScriptEventListener
};