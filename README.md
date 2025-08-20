# PortCleaner

A powerful port management utility for macOS that helps you identify and manage processes using network ports.

## Features

- 🔍 **Port Scanning**: Quickly scan and identify processes using network ports
- 🎯 **Process Management**: Stop or force-kill processes occupying ports
- 🔄 **Auto-Refresh**: Automatically refresh port information at configurable intervals
- 🎨 **Theme Support**: Light, Dark, and System theme modes
- 🔔 **Notifications**: Get notified about port status changes
- 💾 **Preferences**: Customize behavior, appearance, and notifications
- 🖥️ **Menu Bar Integration**: Quick access from the macOS menu bar

## Installation

### Download Pre-built App

#### Signed Version (Recommended)
For a signed and notarized version that launches without security warnings, visit:
**[https://minorkeith.com/tools/portcleaner.html](https://minorkeith.com/tools/portcleaner.html)**

### Build from Source

#### Prerequisites
- macOS 10.15 or later
- Node.js 18 or later
- npm or yarn

#### Steps

1. Clone the repository:
```bash
git clone https://github.com/CHMGhost/portcleaner.git
cd portcleaner
```

2. Install dependencies:
```bash
npm install
```

3. Run in development mode:
```bash
npm run dev
```

4. Build the application:
```bash
npm run make
```

The built application will be available in the `out` directory.

## Usage

1. **Launch PortCleaner** - The app will appear in your menu bar
2. **Click the menu bar icon** to open the main window
3. **View active ports** - See all processes using network ports
4. **Manage processes** - Click "Stop" to gracefully terminate or use force stop for stubborn processes
5. **Configure preferences** - Access via Preferences menu to customize behavior

### Keyboard Shortcuts

- `Cmd+R` - Refresh port list
- `Cmd+,` - Open preferences
- `Cmd+Q` - Quit application

## Configuration

The app stores preferences locally using electron-store. All settings can be configured through the Preferences window (Cmd+,).

## Development

### Project Structure
```
PortCleaner/
├── src/
│   ├── main.js           # Main process
│   ├── renderer.js        # Renderer process
│   ├── preload.js         # Preload script
│   ├── preferences.js     # Preferences window
│   └── utils/             # Utility modules
├── assets/                # Icons and images
├── package.json
└── forge.config.js        # Electron Forge configuration
```

### Testing

Run tests:
```bash
npm test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Uses [Electron Forge](https://www.electronforge.io/) for building and packaging

## Support

For issues and questions, please use the [GitHub Issues](https://github.com/CHMGhost/portcleaner/issues) page.
