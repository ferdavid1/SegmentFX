// execute_python.jsx
function executePython(scriptPath, args) {
    var command = 'python "' + scriptPath + '" ' + args.join(' ');
    
    // Use ScriptUI.shellExecute if available
    if (typeof ScriptUI !== 'undefined' && ScriptUI.shellExecute) {
        try {
            ScriptUI.shellExecute(command);
            return JSON.stringify({ status: "complete", message: "Command executed successfully" });
        } catch (error) {
            return JSON.stringify({ status: "error", error: error.toString() });
        }
    } else {
        // Fallback to alert if shellExecute is not available
        alert("Unable to execute Python script. Please run the following command manually:\n\n" + command);
        return JSON.stringify({ status: "error", error: "Unable to execute Python script" });
    }
}