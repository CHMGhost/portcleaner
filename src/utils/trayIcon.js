const { nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Create a simple tray icon programmatically
function createTrayIcon(isMacOS = false) {
  try {
    // Try to load the icon file first
    const iconPath = path.join(__dirname, '..', 'assets', 'iconTemplate.png');
    
    if (fs.existsSync(iconPath)) {
      console.log('Loading icon from file:', iconPath);
      const icon = nativeImage.createFromPath(iconPath);
      
      // Mark as template for macOS (will automatically invert in dark menu bar)
      if (isMacOS) {
        icon.setTemplateImage(true);
      }
      
      return icon;
    }
    
    // Fallback to data URL if file doesn't exist
    console.log('Icon file not found, using fallback data URL');
    const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADYSURBVDiNpdO9SgNBFIXx34yJiIWFhY2VjY2NjYWFhYiIlb6AT+ADiI+gL6CvYGFhYWFhYSEiIiIiqCBYCIKFIAj+4O5kdtbdXQ9M8c13zr1n7p0hpcS/VNccbyqNYBPrWMEiFjCLKUxgDJ94wyue8YB73OEWl7jAGU5xjCMc4gD72MMudrCNLWxiA+tYwyoClJCx9ivcVNXABd6xlLlJH9axglUsK+zgBTOZjvRLCrOYz+SkbyYwjqHMBHIxpIA2N9GkE91mkqigG/2aS0lClfvX+p+f/hd9AXbjNVK2VnsXAAAAAElFTkSuQmCC';
    
    const icon = nativeImage.createFromDataURL(pngDataUrl);
    
    // Mark as template for macOS (will automatically invert in dark menu bar)
    if (isMacOS) {
      icon.setTemplateImage(true);
    }
    
    return icon;
  } catch (error) {
    console.error('Error creating tray icon:', error);
    // Return a simple fallback icon
    return nativeImage.createEmpty();
  }
}

// Create icon with status indicator (number of active ports)
function createStatusIcon(portCount = 0, isDark = false) {
  const iconColor = isDark ? '#ffffff' : '#667eea';
  const textColor = isDark ? '#1e1e1e' : '#ffffff';
  const statusColor = portCount > 10 ? '#ff6b6b' : portCount > 5 ? '#ffa94d' : '#48bb78';
  
  const svgIcon = `
    <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
      <rect width="16" height="16" fill="${iconColor}" rx="3"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" 
            font-family="Arial" font-size="8" font-weight="bold" fill="${textColor}">${portCount}</text>
      <circle cx="13" cy="3" r="3" fill="${statusColor}"/>
    </svg>
  `;
  
  const buffer = Buffer.from(svgIcon);
  const dataURL = `data:image/svg+xml;base64,${buffer.toString('base64')}`;
  
  return nativeImage.createFromDataURL(dataURL);
}

module.exports = {
  createTrayIcon,
  createStatusIcon
};