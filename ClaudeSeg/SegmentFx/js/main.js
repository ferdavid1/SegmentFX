// js/main.js

(function() {
    if (!document.registerElement) {
        document.registerElement = function() {
            console.warn('document.registerElement is not supported and has been disabled.');
        };
    }
    
    console.log('main.js loaded');
    debugLog('main.js loaded');

    // Add this at the beginning of the file
    window.onerror = function(message, source, lineno, colno, error) {
        console.error('An error occurred:', error);
        debugLog('Uncaught error: ' + message);
        return true;
    };

    // Initialize the CSInterface
    var csInterface = new CSInterface();
    console.log('CSInterface initialized');

    debugLog('Immediate debug log test');
    logError(new Error('Test error logging'));

    // Function to load all effects
    function loadEffects() {
        return HostCommunication.getAvailableEffects()
            .then(function(effects) {
                var effectList = document.getElementById('effectList');
                effectList.innerHTML = '';
                effects.forEach(function(effect) {
                    var option = document.createElement('option');
                    option.value = JSON.stringify(effect);
                    option.textContent = effect.name + ' (' + effect.type + ')';
                    effectList.appendChild(option);
                });
                HostCommunication.debugLog('Effects loaded successfully');
            })
            .catch(function(error) {
                console.error('Error loading effects:', error);
                HostCommunication.debugLog('Failed to load effects: ' + error.message);
            });
    }

    // Function to add effect to stack
    function addEffectToStack(effect) {
        var effectStack = document.getElementById('effectStack');
        var effectDiv = document.createElement('div');
        effectDiv.className = 'effect-item';
        effectDiv.textContent = effect.name;
        
        if (effect.type === 'custom') {
            var paramInput = document.createElement('input');
            paramInput.type = 'text';
            paramInput.placeholder = 'Parameters (JSON)';
            effectDiv.appendChild(paramInput);
        }
        
        var removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.onclick = function() {
            effectStack.removeChild(effectDiv);
        };
        effectDiv.appendChild(removeButton);
        
        effectStack.appendChild(effectDiv);
    }


    function initializeExtension() {

        HostCommunication.debugLog('Extension initializing');

        // Setup testing button
        var testExtendScriptButton = document.getElementById('testExtendScriptButton');
        var testResultDiv = document.getElementById('testResult');

        if (testExtendScriptButton) {
            testExtendScriptButton.addEventListener('click', function() {
                HostCommunication.testExtendScript()
                    .then(function(result) {
                        testResultDiv.textContent = 'ExtendScript test successful: ' + result;
                        testResultDiv.style.color = 'green';
                    })
                    .catch(function(error) {
                        testResultDiv.textContent = 'ExtendScript test failed: ' + error.message;
                        testResultDiv.style.color = 'red';
                    });
            });
        }

        var openLogButton = document.getElementById('openLogButton');
        if (openLogButton) {
            openLogButton.addEventListener('click', HostCommunication.openLogFile);
        }

        // Set up event listeners
        var autoSegmentButton = document.getElementById('autoSegmentButton');
        if (autoSegmentButton) {
            autoSegmentButton.addEventListener('click', function() {
                var objectCount = document.getElementById('objectCountInput').value;
                HostCommunication.autoSegment(objectCount)
                    .then(function(result) {
                        console.log('Auto segmentation result:', result);
                        // Handle the result as needed
                    })
                    .catch(function(error) {
                        console.error('Auto segmentation error:', error);
                    });
            });
        }

        var manualSegmentButton = document.getElementById('manualSegmentButton');
        if (manualSegmentButton) {
            manualSegmentButton.addEventListener('click', function() {
                var canvas = document.getElementById('drawingCanvas');
                var imageData = canvas.toDataURL();
                HostCommunication.manualSegment(imageData)
                    .then(function(result) {
                        console.log('Manual segmentation result:', result);
                        // Handle the result as needed
                    })
                    .catch(function(error) {
                        console.error('Manual segmentation error:', error);
                    });
            });
        }

        var addEffectButton = document.getElementById('addEffectButton');
        if (addEffectButton) {
            addEffectButton.addEventListener('click', function() {
                var effectList = document.getElementById('effectList');
                var selectedEffects = Array.prototype.slice.call(effectList.selectedOptions);
                selectedEffects.forEach(function(option) {
                    var effect = JSON.parse(option.value);
                    addEffectToStack(effect);
                });
            });
        }

        var applyEffectsButton = document.getElementById('applyEffectsButton');
        if (applyEffectsButton) {
            applyEffectsButton.addEventListener('click', function() {
                var trackIndex = parseInt(document.getElementById('trackIndexInput').value, 10);
                var clipIndex = parseInt(document.getElementById('clipIndexInput').value, 10);
                var effectStack = document.getElementById('effectStack');
                var effects = Array.prototype.slice.call(effectStack.children).map(function(effectDiv) {
                    var effect = JSON.parse(effectDiv.firstChild.textContent);
                    if (effect.type === 'custom') {
                        effect.parameters = JSON.parse(effectDiv.querySelector('input').value || '{}');
                    }
                    return effect;
                });
                HostCommunication.applyMultipleEffects(clipIndex, trackIndex, effects)
                    .then(function(result) {
                        console.log('Apply effects result:', result);
                        // Handle the result as needed
                    })
                    .catch(function(error) {
                        console.error('Apply effects error:', error);
                    });
            });
        }

        // Initial data loading
        HostCommunication.getProjectDetails()
            .then(function(details) {
                console.log('Project details:', details);
                // Update UI with project details
            })
            .catch(function(error) {
                console.error('Error getting project details:', error);
            });

        HostCommunication.getSequenceDetails()
            .then(function(details) {
                console.log('Sequence details:', details);
                // Update UI with sequence details
            })
            .catch(function(error) {
                console.error('Error getting sequence details:', error);
            });

        loadEffects()
            .then(function() {
                HostCommunication.debugLog('Effects loaded in initialization');
            })
            .catch(function(error) {
                HostCommunication.debugLog('Failed to load effects in initialization: ' + error.message);
            });

        HostCommunication.debugLog('Extension initialized');

    }

    document.addEventListener('DOMContentLoaded', initializeExtension);

    // Add event listener for window load to ensure everything is fully loaded
    window.addEventListener('load', function() {
        HostCommunication.debugLog('Window fully loaded');
        loadEffects()
            .then(function() {
                HostCommunication.debugLog('Effects reloaded after window load');
            })
            .catch(function(error) {
                HostCommunication.debugLog('Failed to reload effects after window load: ' + error.message);
            });
    });

    HostCommunication.debugLog('main.js loaded');
})();