// host_communication.jsx

// Function to get the current project
function getCurrentProject() {
    return app.project;
}

// Function to get the active sequence
function getActiveSequence() {
    return app.project.activeSequence;
}

// Function to perform auto segmentation
function autoSegment(objectCount) {
    var pythonScript = File($.fileName).parent.parent.fsName + "/python/segmentation.py";
    var activeSequence = getActiveSequence();
    
    if (!activeSequence) {
        alert("No active sequence. Please create or open a sequence.");
        return JSON.stringify({ error: "No active sequence" });
    }
    
    var videoPath = activeSequence.videoTracks[0].clips[0].projectItem.getMediaPath();
    
    var command = "python \"" + pythonScript + "\" auto \"" + videoPath + "\" " + objectCount;
    
    try {
        var result = system.callSystem(command);
        
        // Process result and import masks
        var outputDir = JSON.parse(result).output_dir;
        importMasksToTimeline(outputDir);
        
        return JSON.stringify({ success: true, message: "Auto segmentation complete" });
    } catch (error) {
        return JSON.stringify({ error: error.toString() });
    }
}

// Function to perform manual segmentation
function manualSegment(imageData) {
    var pythonScript = File($.fileName).parent.parent.fsName + "/python/segmentation.py";
    var tempFile = new File(Folder.temp.fsName + "/temp_drawing.png");
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
    
    var command = "python \"" + pythonScript + "\" manual \"" + videoPath + "\" \"" + tempFile.fsName + "\"";
    
    try {
        var result = system.callSystem(command);
        
        // Process result and import masks
        var outputDir = JSON.parse(result).output_dir;
        importMasksToTimeline(outputDir);
        
        return JSON.stringify({ success: true, message: "Manual segmentation complete" });
    } catch (error) {
        return JSON.stringify({ error: error.toString() });
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
        var tmkEffect = clipItem.components.addVideoEffect(qe.project.getVideoEffectByName("Track Matte Key"));
        
        // Set the matte layer to the mask video track
        tmkEffect.properties.getParamForDisplayName("Matte Layer").setValue(maskTrack.index + 1);
        
        // You could add more effects or adjustments here specific to each object
    }

    return JSON.stringify({ success: true, message: "Masks imported and applied to the timeline" });
}

// Function to get all effects (built-in and custom)
function getAllEffects() {
    var builtInEffects = [];
    for (var i = 0; i < qe.project.numVideoEffects; i++) {
        builtInEffects.push({
            name: qe.project.getVideoEffectName(i),
            type: "built-in"
        });
    }
    
    var customEffects = [
        { name: "Glitch", type: "custom" },
        { name: "Pixelate", type: "custom" }
        // Add more custom effects here as you implement them
    ];
    
    return JSON.stringify(builtInEffects.concat(customEffects));
}

// Function to apply a Premiere Pro effect to a clip
function applyEffectToClip(clipIndex, trackIndex, effectName) {
    var sequence = getActiveSequence();
    var clip = sequence.videoTracks[trackIndex].clips[clipIndex];
    var effect = qe.project.getVideoEffectByName(effectName);
    if (effect && clip) {
        clip.components.addVideoEffect(effect);
        return JSON.stringify({ success: true, message: "Effect applied successfully" });
    }
    return JSON.stringify({ error: "Failed to apply effect" });
}

// Function to apply custom effect
function applyCustomEffect(clipIndex, trackIndex, effectName, parameters) {
    var sequence = getActiveSequence();
    var clip = sequence.videoTracks[trackIndex].clips[clipIndex];
    
    var pythonScript = File($.fileName).parent.parent.fsName + "/python/custom_effects.py";
    var command = "python \"" + pythonScript + "\" \"" + clip.projectItem.getMediaPath() + "\" \"" + effectName + "\" '" + JSON.stringify(parameters) + "'";
    
    try {
        var result = system.callSystem(command);
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
    var sequence = getActiveSequence();
    if (!sequence) {
        return JSON.stringify({ error: "No active sequence" });
    }
    
    if (trackIndex < 0 || trackIndex >= sequence.videoTracks.numTracks) {
        return JSON.stringify({ error: "Invalid track index" });
    }
    
    var track = sequence.videoTracks[trackIndex];
    if (clipIndex < 0 || clipIndex >= track.clips.numItems) {
        return JSON.stringify({ error: "Invalid clip index" });
    }
    
    var clip = track.clips[clipIndex];
    
    for (var i = 0; i < effects.length; i++) {
        var effect = effects[i];
        if (effect.type === "built-in") {
            var premierEffect = qe.project.getVideoEffectByName(effect.name);
            clip.components.addVideoEffect(premierEffect);
        } else if (effect.type === "custom") {
            applyCustomEffect(clipIndex, trackIndex, effect.name.toLowerCase(), effect.parameters);
        }
    }
    
    return JSON.stringify({ success: true, message: "Multiple effects applied successfully" });
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
            framerate: sequence.framerate.toString(),
            duration: sequence.duration.seconds,
            videoTracks: sequence.videoTracks.numTracks,
            audioTracks: sequence.audioTracks.numTracks
        });
    }
    return JSON.stringify(null);
}