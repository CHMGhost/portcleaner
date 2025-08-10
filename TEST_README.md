# WTFIsOnMyPort Test Suite Documentation

## ✅ Complete Testing Implementation

This test suite provides comprehensive coverage for all items in your testing checklist.

## 📋 Test Coverage

### 1. ✅ CAN SEE ALL ACTIVE PORTS
- **File**: `test/unit/portScanning.test.js`
- Tests lsof command on Mac
- Tests netstat command on Windows
- Validates port parsing (1-65535)
- Tests TCP and UDP port detection
- Handles empty and malformed outputs

### 2. ✅ CAN KILL A PROCESS
- **File**: `test/unit/killProcess.test.js`
- Tests kill -9 on Mac
- Tests taskkill /F /PID on Windows
- Verifies process termination
- Checks port availability after kill
- Handles permission errors

### 3. ✅ CONFIRMATION DIALOG WORKS
- **File**: `test/unit/confirmationDialog.test.js`
- Tests dialog display before kill
- Validates Cancel/Confirm actions
- Tests keyboard shortcuts (ESC/Enter)
- Prevents multiple dialog clicks

### 4. ✅ PROTECTED PROCESSES CAN'T BE KILLED
- **File**: `test/unit/protectedProcesses.test.js`
- Tests protection list enforcement
- Case-insensitive matching
- Partial name matching
- IPC bypass prevention

### 5. ✅ WORKS ON MAC
- **File**: `test/e2e/complete-flow.test.js`
- Platform-specific command tests
- lsof parsing validation
- Mac system process handling
- Intel & Apple Silicon support

### 6. ✅ WORKS ON WINDOWS
- **File**: `test/e2e/complete-flow.test.js`
- netstat command validation
- taskkill functionality
- UAC elevation handling
- Windows 10/11 compatibility

### 7. ✅ HANDLES ERRORS GRACEFULLY
- **File**: `test/unit/errorHandling.test.js`
- Command execution failures
- Parsing errors
- Permission denied handling
- User-friendly error messages
- Retry mechanisms

### 8. ✅ NO MEMORY LEAKS AFTER RUNNING FOR HOURS
- **File**: `test/memory/memory-leak-detector.js`
- **File**: `test/unit/memoryLeak.test.js`
- 8-hour continuous testing
- Heap monitoring
- IPC listener cleanup
- DOM node cleanup
- Auto-refresh memory management

### 9. ✅ AUTO-UPDATE WORKS (CI/CD)
- **File**: `.github/workflows/test.yml`
- Update check validation
- Download progress testing
- Installation verification
- Rollback on failure

## 🚀 Quick Start

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
./run-tests.sh all
```

### Run Specific Test Types
```bash
# Unit tests only
npm test

# With coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# Memory leak detection (takes ~1 hour)
npm run test:memory

# Watch mode for development
npm run test:watch
```

## 📊 Test Commands

| Command | Description | Duration |
|---------|-------------|----------|
| `npm test` | Run all unit tests | ~1 min |
| `npm run test:coverage` | Generate coverage report | ~2 min |
| `npm run test:e2e` | Run E2E tests with Playwright | ~5 min |
| `npm run test:memory` | Run memory leak detection | ~1 hour |
| `./run-tests.sh all` | Run complete test suite | ~10 min |

## 🔧 CI/CD Integration

The project includes GitHub Actions workflows that run tests automatically:

- **On Push**: Unit and E2E tests
- **On PR**: Full test suite
- **Nightly**: Memory leak detection
- **Matrix Testing**: macOS & Windows, Node 18 & 20

## 📈 Coverage Requirements

Minimum coverage thresholds:
- Lines: 80%
- Functions: 75%
- Branches: 70%
- Statements: 80%

## 🧪 Test Structure

```
test/
├── unit/                 # Unit tests
│   ├── portScanning.test.js
│   ├── killProcess.test.js
│   ├── confirmationDialog.test.js
│   ├── protectedProcesses.test.js
│   ├── errorHandling.test.js
│   └── memoryLeak.test.js
├── e2e/                  # End-to-end tests
│   └── complete-flow.test.js
├── memory/               # Memory leak detection
│   └── memory-leak-detector.js
├── fixtures/             # Test data
│   └── commandOutputs.js
├── mocks/                # Mock implementations
│   └── portManager.mock.js
└── setup.js              # Test configuration
```

## 🎯 Platform-Specific Testing

### macOS Testing
- Requires lsof command
- Tests on macOS 12, 13, 14
- Intel and Apple Silicon support
- Gatekeeper compatibility

### Windows Testing
- Requires netstat and taskkill
- Tests on Windows 10 and 11
- UAC elevation handling
- Windows Defender compatibility

## 📝 Mock Data

The test suite includes comprehensive mock data for:
- lsof output (Mac)
- netstat output (Windows)
- Process information
- Error scenarios
- Edge cases

## 🔍 Memory Leak Detection

The memory leak detector:
1. Runs app for configurable duration (default 8 hours)
2. Takes memory samples every 5 seconds
3. Simulates user interactions
4. Detects steady memory increases
5. Generates detailed report
6. Takes heap snapshots on leak detection

## ⚡ Performance Benchmarks

Expected test performance:
- Port scanning: < 100ms per scan
- Process kill: < 500ms
- Dialog response: < 50ms
- Memory usage: < 100MB after 8 hours
- Auto-refresh: No memory increase > 10MB/hour

## 🐛 Debugging Tests

### Enable Verbose Output
```bash
npm test -- --verbose
```

### Run Single Test File
```bash
npm test -- portScanning.test.js
```

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 📊 Test Reports

Reports are generated in:
- `coverage/` - Coverage reports
- `test-results/` - Test results
- `playwright-report/` - E2E test report
- `test/memory/memory-report.json` - Memory analysis

## 🔄 Continuous Testing

For development, use watch mode:
```bash
npm run test:watch
```

This automatically re-runs tests when files change.

## ✅ Checklist Verification

Your complete testing checklist is now implemented:

- [x] Can see all active ports
- [x] Can kill a process
- [x] Confirmation dialog works
- [x] Protected processes can't be killed
- [x] Works on Mac
- [x] Works on Windows
- [x] Handles errors gracefully
- [x] No memory leaks after running for hours
- [x] Auto-update works

## 🚨 Troubleshooting

### Tests Failing on Mac
- Ensure lsof is available: `which lsof`
- Check permissions: `sudo lsof -i`

### Tests Failing on Windows
- Run as Administrator
- Ensure netstat is available: `where netstat`

### Memory Tests Taking Too Long
- Reduce test duration in `memory-leak-detector.js`
- Use `--duration` flag: `npm run test:memory -- --duration 600000`

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Electron Testing Guide](https://www.electronjs.org/docs/latest/tutorial/testing)

## 🤝 Contributing

When adding new features, ensure:
1. Unit tests are added
2. E2E tests cover user flows
3. Memory impact is tested
4. Error cases are handled
5. Coverage remains above thresholds