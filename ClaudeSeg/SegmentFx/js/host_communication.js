// js/host_communication.js

var HostCommunication = (function() {
    console.log("host_communication.js loaded");
    
    // Initialize the CSInterface
    const csInterface = new CSInterface();

    function testExtendScript() {
        return new Promise(function(resolve, reject) {
            csInterface.evalScript('testExtendScriptFunction()', function(result) {
                if (result === 'undefined' || result === 'EvalScript error.') {
                    reject(new Error('ExtendScript test failed'));
                } else {
                    resolve(result);
                }
            });
        });
    }

    function getLogPath() {
        // Use the extension's own directory for logs
        return csInterface.getSystemPath(SystemPath.EXTENSION) + '/logs/adobe_cep_logs.txt';
    }

    function ensureDirectoryExistence(filePath) {
        const dirname = filePath.substring(0, filePath.lastIndexOf('/'));
        if (!window.cep.fs.existsSync(dirname)) {
            window.cep.fs.mkdirSync(dirname, { recursive: true });
        }
    }

    function logError(error) {
        const logPath = getLogPath();
        ensureDirectoryExistence(logPath);
        const message = `${new Date().toISOString()}: ${error.toString()}\n`;
        
        if (window.cep) {
            window.cep.fs.appendFileSync(logPath, message, 'utf8');
        } else {
            // Fallback to using ExtendScript for file writing
            const command = `
            (function() {
                var file = new File("${logPath}");
                file.open('a');
                file.write("${message}");
                file.close();
            })();
            `;
            csInterface.evalScript(command);
        }
    }

    function debugLog(message) {
        console.log(message);
        logError(new Error(message));
    }

    function openLogFile() {
        const logPath = getLogPath();
        if (window.cep) {
            window.cep.process.openURLInDefaultBrowser('file://' + logPath);
        } else {
            csInterface.openURLInDefaultBrowser('file://' + logPath);
        }
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

    return {
        logError: logError,
        debugLog: debugLog,
        openLogFile: openLogFile,
        autoSegment: autoSegment,
        manualSegment: manualSegment,
        testExtendScript: testExtendScript,
        getProjectDetails: getProjectDetails,
        getSequenceDetails: getSequenceDetails,
        getAvailableEffects: getAvailableEffects,
        applyMultipleEffects: applyMultipleEffects,
        addExtendScriptEventListener: addExtendScriptEventListener
    };
})();