const { nativeImage } = require('electron');
const path = require('path');

// Create a simple tray icon programmatically
function createTrayIcon(isDark = false) {
  // Create a 16x16 icon using native image
  // For now, we'll use a simple colored square as placeholder
  // In production, you'd use a proper PNG/ICO file
  
  // Create a data URL for a simple icon
  const iconColor = isDark ? '#ffffff' : '#667eea';
  const svgIcon = `
    <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
      <rect width="16" height="16" fill="${iconColor}" rx="3"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" 
            font-family="Arial" font-size="10" font-weight="bold" fill="${isDark ? '#1e1e1e' : '#ffffff'}">P</text>
    </svg>
  `;
  
  const buffer = Buffer.from(svgIcon);
  const dataURL = `data:image/svg+xml;base64,${buffer.toString('base64')}`;
  
  return nativeImage.createFromDataURL(dataURL);
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