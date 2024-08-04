#!/bin/bash

# Enable debug mode
echo "Enabling debug mode for Adobe extensions..."
defaults write com.adobe.CSXS.11 PlayerDebugMode 1

# Copy extension
echo "Copying extension to Adobe CEP extensions folder..."
EXTENSION_DIR="/Library/Application Support/Adobe/CEP/extensions"
sudo mkdir -p "$EXTENSION_DIR"
sudo cp -R "${0%/*}/YourExtension" "$EXTENSION_DIR"

echo "Installation complete!"
echo "Please restart any open Adobe applications for the changes to take effect."

read -p "Press [Enter] key to exit..."