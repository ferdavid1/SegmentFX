#!/bin/bash

# Function to check if debug mode is enabled
is_debug_mode_enabled() {
    local debug_mode=$(defaults read com.adobe.CSXS.11 PlayerDebugMode 2>/dev/null)
    [[ "$debug_mode" == "1" ]]
    local debug_mode=$(defaults read com.adobe.CSXS.8 PlayerDebugMode 2>/dev/null)
    [[ "$debug_mode" == "1" ]]
}

# Enable debug mode
echo "Checking Adobe extension debug mode..."
if is_debug_mode_enabled; then
    echo "Debug mode is already enabled."
else
    echo "Enabling debug mode for Adobe extensions..."
    defaults write com.adobe.CSXS.11 PlayerDebugMode 1
    defaults write com.adobe.CSXS.8 PlayerDebugMode 1
    if [ $? -eq 0 ]; then
        echo "Debug mode enabled successfully."
    else
        echo "Failed to enable debug mode. Please run this script with sudo."
        exit 1
    fi
fi


# Copy extension
echo "Checking for existing extension installation..."
SOURCE_DIR="$(cd "${0%/*}/../../" && pwd)"
EXTENSION_NAME="SegmentFx"
DEST_DIR="/Library/Application Support/Adobe/CEP/extensions/$EXTENSION_NAME"

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Extension folder not found: $SOURCE_DIR"
    exit 1
fi

if [ -d "$DEST_DIR" ]; then
    read -p "Extension is already installed. Do you want to reinstall? (y/N) " choice
    case "$choice" in 
        y|Y ) echo "Proceeding with reinstallation...";;
        * ) echo "Installation cancelled."; exit 0;;
    esac
fi

echo "Copying extension to Adobe CEP extensions folder..."
sudo mkdir -p "$(dirname "$DEST_DIR")"
sudo cp -R "$SOURCE_DIR" "$DEST_DIR"

if [ $? -eq 0 ]; then
    echo "Extension copied successfully."
else
    echo "Failed to copy extension files. Please make sure you have the necessary permissions."
    exit 1
fi

echo "Installation complete!"
echo "Please restart any open Adobe applications for the changes to take effect."

read -p "Press [Enter] key to exit..."