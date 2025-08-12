#!/bin/bash

# Create icons directory if it doesn't exist
mkdir -p src/assets/icons.iconset

# Generate different sizes needed for macOS .icns file
# Using the largest PNG we have as source
SOURCE_ICON="src/assets/icon@2x.png"

# Check if source exists, if not use any large icon
if [ ! -f "$SOURCE_ICON" ]; then
    SOURCE_ICON="src/assets/icon1024.png"
fi

if [ ! -f "$SOURCE_ICON" ]; then
    SOURCE_ICON="src/assets/icon.png"
fi

if [ ! -f "$SOURCE_ICON" ]; then
    echo "Error: No source icon found. Please create src/assets/icon-1024.png first"
    exit 1
fi

echo "Using $SOURCE_ICON as source..."

# Generate required sizes for macOS iconset
sips -z 16 16     "$SOURCE_ICON" --out src/assets/icons.iconset/icon_16x16.png
sips -z 32 32     "$SOURCE_ICON" --out src/assets/icons.iconset/icon_16x16@2x.png
sips -z 32 32     "$SOURCE_ICON" --out src/assets/icons.iconset/icon_32x32.png
sips -z 64 64     "$SOURCE_ICON" --out src/assets/icons.iconset/icon_32x32@2x.png
sips -z 128 128   "$SOURCE_ICON" --out src/assets/icons.iconset/icon_128x128.png
sips -z 256 256   "$SOURCE_ICON" --out src/assets/icons.iconset/icon_128x128@2x.png
sips -z 256 256   "$SOURCE_ICON" --out src/assets/icons.iconset/icon_256x256.png
sips -z 512 512   "$SOURCE_ICON" --out src/assets/icons.iconset/icon_256x256@2x.png
sips -z 512 512   "$SOURCE_ICON" --out src/assets/icons.iconset/icon_512x512.png
sips -z 1024 1024 "$SOURCE_ICON" --out src/assets/icons.iconset/icon_512x512@2x.png

# Create the icns file
iconutil -c icns src/assets/icons.iconset -o src/assets/icon.icns

echo "✅ Created icon.icns successfully"

# Clean up the iconset folder
rm -rf src/assets/icons.iconset

echo "🎉 Icon generation complete!"
echo "The app icon has been created at: src/assets/icon.icns"