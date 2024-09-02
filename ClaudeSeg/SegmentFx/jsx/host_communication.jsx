// host_communication.jsx

function joinPath() {
    return Array.prototype.slice.call(arguments).join("/");
}

function testExtendScriptFunction() {
    var extensionRoot = File($.fileName).parent.fsName;
    var fullpath = joinPath(extensionRoot,  "CEP", "extensions", "SegmentFx");
    return "ExtendScript is working! Path: " + fullpath + " and it exists?: " + File(fullpath).exists;
}

// Function to get the current project
function getCurrentProject() {
    return app.project;
}

// Function to get the active sequence
function getActiveSequence() {
    return app.project.activeSequence;
}

// Function to get project details
function getProjectDetails() {
    var project = getCurrentProject();
    return JSON.stringify({
        name: project.name,
        path: project.path,
        sequences: project.sequences.numSequences
    });
}

// Function to get sequence details
function getSequenceDetails() {
    var sequence = getActiveSequence();
    if (sequence) {
        return JSON.stringify({
            name: sequence.name,
            videoTracks: sequence.videoTracks.numTracks,
            audioTracks: sequence.audioTracks.numTracks
        });
    }
    return JSON.stringify(null);
}

// Function to perform auto segmentation
function autoSegment(objectCount) {
    var extensionRoot = File($.fileName).parent.fsName;
    var pythonScript = joinPath("/python", "segmentation.py");
    var activeSequence = getActiveSequence();
    
    if (!activeSequence) {
        alert("No active sequence. Please create or open a sequence.");
        return JSON.stringify({ error: "No active sequence" });
    }
    
    var videoPath = activeSequence.videoTracks[0].clips[0].projectItem.getMediaPath();
    
    // var command = "cd " + extensionRoot + " && " + "python \"" + pythonScript + "\" auto \"" + videoPath + "\" " + objectCount;
    
    try {
        $.write(JSON.stringify({ status: "loading", message: "Starting auto segmentation..." }));

        // Execute the Python script
        $.evalFile(new File($.fileName).parent.fsName + "/execute_python.jsx");
        var result = executePython(pythonScript, ["auto", videoPath, objectCount]);
        
        // Process result and import masks
        var parsedResult = JSON.parse(result);
        if (parsedResult.status === "error") {
            return result;
        }
        var outputDir = parsedResult.output_dir;
        importMasksToTimeline(outputDir);
        parsedResult.status = "complete";
        
        return JSON.stringify(parsedResult);
    } catch (error) {
        return JSON.stringify({ status: "error", error: error.toString() });
    }
}

// Function to perform manual segmentation
function manualSegment(imageData) {
    var extensionRoot = File($.fileName).parent.fsName;
    var pythonScript = joinPath("/python", "segmentation.py");
    var tempFile = new File(joinPath(Folder.temp.fsName, "temp_drawing.png"));
    tempFile.open('w');
    tempFile.encoding = "BINARY";
    tempFile.write(imageData.split(',')[1]);
    tempFile.close();
    
    var activeSequence = getActiveSequence();
    
    if (!activeSequence) {
        alert("No active sequence. Please create or open a sequence.");
        return JSON.stringify({ error: "No active sequence" });
    }
    
    var videoPath = activeSequence.videoTracks[0].clips[0].projectItem.getMediaPath();
    
    // var command = "cd " + extensionRoot + " && " + "python \"" + pythonScript + "\" manual \"" + videoPath + "\" \"" + tempFile.fsName + "\"";
    
    try {
        $.write(JSON.stringify({ status: "loading", message: "Starting manual segmentation..." }));

        // Execute the Python script
        $.evalFile(new File($.fileName).parent.fsName + "/execute_python.jsx");
        var result = executePython(pythonScript, ["manual", videoPath, tempFile.fsName]);
        
        tempFile.remove();
        
        // Process result and import masks
        var parsedResult = JSON.parse(result);
        if (parsedResult.status === "error") {
            return result;
        }
        var outputDir = parsedResult.output_dir;
        importMasksToTimeline(outputDir);
        parsedResult.status = "complete";
        
        return JSON.stringify(parsedResult);
    } catch (error) {
        return JSON.stringify({ status: "error", error: error.toString() });
    }
}

// Function to import masks to the timeline
function importMasksToTimeline(outputDir) {
    var project = getCurrentProject();
    var sequence = getActiveSequence();
    
    if (!sequence) {
        alert("No active sequence. Please create or open a sequence.");
        return JSON.stringify({ error: "No active sequence" });
    }

    // Import the combined masks video
    var maskVideo = project.importFiles([outputDir + "/combined_masks.mp4"]);

    // Create a new video track for the masks
    var maskTrack = sequence.videoTracks[sequence.videoTracks.numTracks];
    maskTrack.overwriteClip(maskVideo[0], sequence.getPlayerPosition());
    // maybe: var maskClip = maskTrack.insertClip(maskVideo, sequence.getPlayerPosition());


    // Load and parse the metadata
    var metadataFile = new File(outputDir + "/mask_metadata.json");
    metadataFile.open("r");
    var metadataJSON = metadataFile.read();
    metadataFile.close();
    var metadata = JSON.parse(metadataJSON);

    // Create adjustment layers for each unique object
    var objectIds = [];
    for (var i = 0; i < metadata.length; i++) {
        if (objectIds.indexOf(metadata[i].object_id) === -1) {
            objectIds.push(metadata[i].object_id);
        }
    }
    
    for (var i = 0; i < objectIds.length; i++) {
        var objectId = objectIds[i];
        var adjustmentLayer = sequence.createAdjustment();
        var track = sequence.videoTracks[sequence.videoTracks.numTracks];
        var clipItem = track.insertClip(adjustmentLayer, sequence.getPlayerPosition());
        
        // Apply Track Matte Key effect
        var tmkEffect = clipItem.components.addVideoEffect(app.project.interpreted("Track Matte Key"));
        
        // Set the matte layer to the mask video track
        tmkEffect.properties.getParamForDisplayName("Matte Layer").setValue(maskTrack.index + 1);
        
        // You could add more effects or adjustments here specific to each object
    }

    return JSON.stringify({ success: true, message: "Masks imported and applied to the timeline" });
}

// Function to get all effects (built-in and custom)
function getAllEffects() {
    var extensionRoot = File($.fileName).parent.fsName;
    var fullpath = joinPath(extensionRoot,  "CEP", "extensions", "SegmentFx");
    var effectsFile = File(joinPath(fullpath, "data", "premiere_effects.json"));
    var effects = [];

    if (effectsFile.exists) {
        effectsFile.open('r');
        var content = effectsFile.read();
        effectsFile.close();

        try {
            var jsonContent = JSON.parse(content);
            effects = jsonContent.effects;
        } catch (e) {
            alert("Error parsing effects file: " + e.toString());
        }
    } else {
        alert("Effects file not found: " + effectsFile.fsName);
    }
    
    var customEffects = [
        { name: "Glitch", type: "custom" },
        { name: "Pixelate", type: "custom" }
        // Add more custom effects here as you implement them
    ];
    
    return JSON.stringify(effects.concat(customEffects));
}

// Function to apply a Premiere Pro effect to a clip
function applyEffectToClip(clipIndex, trackIndex, effectName) {
    var sequence = getActiveSequence();
    if (!sequence) return JSON.stringify({ error: "No active sequence" });

    var track = sequence.videoTracks[trackIndex];
    if (!track) return JSON.stringify({ error: "Track not found" });

    var clip = track.clips[clipIndex];
    if (!clip) return JSON.stringify({ error: "Clip not found" });

    try {
        var effect = clip.components.addVideoEffect(app.project.interpreted(effectName));
        if (effect) {
            return JSON.stringify({ success: true, message: "Effect applied successfully" });
        } else {
            return JSON.stringify({ error: "Failed to apply effect" });
        }
    } catch (e) {
        return JSON.stringify({ error: "Error applying effect: " + e.toString() });
    }
}

// Function to apply custom effect
function applyCustomEffect(clipIndex, trackIndex, effectName, parameters) {
    var sequence = getActiveSequence();
    if (!sequence) return JSON.stringify({ error: "No active sequence" });

    var track = sequence.videoTracks[trackIndex];
    if (!track) return JSON.stringify({ error: "Track not found" });

    var clip = track.clips[clipIndex];
    if (!clip) return JSON.stringify({ error: "Clip not found" });
    
    var pythonScript = File($.fileName).parent.fsName + "/python/custom_effects.py";
    // var command = "python \"" + pythonScript + "\" \"" + clip.projectItem.getMediaPath() + "\" \"" + effectName + "\" '" + JSON.stringify(parameters) + "'";
    
    try {
        // Execute the Python script
        $.evalFile(new File($.fileName).parent.fsName + "/execute_python.jsx");
        var result = executePython(pythonScript, [clip.projectItem.getMediaPath(), effectName, JSON.stringify(parameters)]);

        var parsedResult = JSON.parse(result);
        if (parsedResult.status === "error") {
            return result;
        }

        var processedFramesPath = JSON.parse(result).output_path;
        
        // Create a custom effect in Premiere Pro
        var customEffect = clip.components.addVideoEffect(qe.project.getVideoEffectByName("Apply Image"));
        
        // Set up the custom effect to use the processed frames
        customEffect.properties.getParamForDisplayName("Layer").setValue(processedFramesPath);
        
        return JSON.stringify({ success: true, message: "Custom effect applied successfully" });
    } catch (error) {
        return JSON.stringify({ error: error.toString() });
    }
}

// Function to apply multiple effects
function applyMultipleEffects(clipIndex, trackIndex, effects) {
    var results = [];
    
    var clip = track.clips[clipIndex];
    
    for (var i = 0; i < effects.length; i++) {
        var effect = effects[i];
        if (effect.type === "built-in") {
            var result = JSON.parse(applyEffectToClip(clipIndex, trackIndex, effects[i].name));
            results.push(result);
        } else if (effect.type === "custom") {
            applyCustomEffect(clipIndex, trackIndex, effect.name.toLowerCase(), effect.parameters);
        }
    }
    
    return JSON.stringify({ success: true, message: "Multiple effects applied successfully" });
}