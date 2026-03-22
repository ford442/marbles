# Codepit Troubleshooting Guide

Common issues and solutions when working in the Cockpit Codespace.

## 📋 Recent Improvements

The Cockpit Codespace has been enhanced with the following improvements:
- **Tip‑of‑tree Emscripten (tot)**: the setup script now installs the latest
  tot build by default, giving access to cutting‑edge features such as
  experimental WebGPU support. Releases can still be pinned manually if needed.
- **8GB Memory**: Increased from 4GB for better WebGPU/WASM performance
- **Stable Features**: Pinned devcontainer feature versions for consistency
- **Vite Support**: Port 5173 forwarded by default
- **Configurable VNC**: Password via VNC_PASSWORD environment variable
- **Optimized Setup**: Removed redundant package installations

## 🔧 Environment Issues

### Emscripten Not Found
**Symptom**: `emcc: command not found`

**Solution**:
```bash
source /opt/emsdk/emsdk_env.sh
```

To verify (should show version 3.1.50):
```bash
emcc --version
```

**Note**: The environment now installs the tip‑of‑tree (tot) build by default,
which may change over time. If you require a stable release for CI or release
artifacts, specify the version explicitly or install a specific tag.

### WebGPU Not Available
**Symptom**: `navigator.gpu is undefined` or WebGPU errors

**Solutions**:
1. Use Chrome 113+ or Edge 113+
2. Check `chrome://gpu` → look for "WebGPU: Hardware accelerated"
3. Enable flags if needed: `chrome://flags/#enable-unsafe-webgpu`
4. For local development, use `localhost` or HTTPS (WebGPU requires secure context)

### Out of Memory During Build
**Symptom**: Build fails with memory errors

**Solutions**:
```bash
# The codespace now has 8GB memory (increased from 4GB)
# which should handle most WebGPU and WASM workloads

# If still having issues, close other projects to free resources
./dev.sh stop other-project

# Build with fewer workers
npm run build -- --max-old-space-size=1024

# For C++ WASM, reduce optimization
emcc input.cpp -o output.js -O2 -s WASM=1  # Use -O2 instead of -O3

# Use swap if available
sudo swapon /swapfile 2>/dev/null || true
```

## 🚀 Development Server Issues

### Port Already in Use
**Symptom**: `Error: Port 3000 is already in use`

**Solution**:
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- --port 3001

# For Vite projects, port 5173 is now forwarded by default
npm run dev  # Will use port 5173
```

### Dev Server Not Accessible
**Symptom**: Can't access localhost:3000 from browser

**Solutions**:
1. Check port forwarding in Codespaces (Ports tab)
2. For Vite projects, use port 5173 (now forwarded by default)
3. Use port 8080 (always forwarded)
4. Check firewall: `curl http://localhost:3000`

## 📦 Project Issues

### Project Not Found in dev.sh
**Symptom**: `Error: repo not found`

**Solutions**:
```bash
# Check if cloned
ls ~/projects/

# Clone from repos.json
./setup.sh clone project-name

# Verify repos.json has the entry
cat repos.json | jq '.[].name'
```

### Node Modules Issues
**Symptom**: `Cannot find module` or build errors

**Solutions**:
```bash
# Clean reinstall
rm -rf node_modules package-lock.json
npm install

# For projects with WASM dependencies
npm run build:wasm
```

### Git "Fatal: Not a git repository"
**Symptom**: Git commands fail in projects/

**Note**: Projects in `/projects/` are git-ignored by the codepit repo. Each project has its own `.git` directory.

**Solution**:
```bash
# Ensure you're in the project directory
cd ~/projects/project-name
ls -la .git  # Should show git directory
```

## 🤖 AI CLI Issues

### API Key Errors
**Symptom**: `Error: XAI_API_KEY not set`

**Solution**:
```bash
# Check .env file exists
cat .env

# Create from example
cp .env.example .env
# Edit .env and add your API keys
```

Required keys for ai-cli.sh:
- At least one of: `XAI_API_KEY`, `MOONSHOT_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

### Model Not Available
**Symptom**: `Error: Model grok-beta not available`

**Solution**:
```bash
# Test all connections
./ai-cli.sh test

# List available models
./ai-cli.sh models

# Check models.json for correct model names
cat models.json | jq '.providers.xai.models'
```

## 🔊 Audio Issues

### AudioContext Not Allowed
**Symptom**: `The AudioContext was not allowed to start`

**Solution**: User interaction required before audio can play.
```javascript
// Add a "Start" button that resumes AudioContext
button.addEventListener('click', () => {
  audioContext.resume();
});
```

### Audio Crackling/Dropouts
**Symptoms**: Glitches in audio playback

**Solutions**:
1. Increase buffer size in AudioWorklet
2. Check for blocking operations in audio thread
3. Reduce visual effects that compete for CPU
4. Use WASM for DSP instead of JavaScript

### AudioWorklet Not Loading
**Symptom**: `AudioWorkletNode constructor: AudioWorklet does not have a valid processor`

**Solutions**:
```bash
# Ensure worklet file is in public/ or served correctly
# Check browser console for 404 errors
# Verify worklet code has no syntax errors
```

## 🎨 WebGPU/WASM Issues

### WASM Module Not Loading
**Symptom**: `WebAssembly.Module is not a valid object`

**Solutions**:
```bash
# Rebuild WASM
source /opt/emsdk/emsdk_env.sh
./build-wasm.sh

# Check file exists and is valid
file public/output.wasm
xxd public/output.wasm | head

# Verify MIME type (should be application/wasm)
curl -I http://localhost:3000/output.wasm
```

### SharedArrayBuffer Not Available
**Symptom**: `SharedArrayBuffer is not defined`

**Solution**: Requires specific headers. In development:
```javascript
// For Vite, add to vite.config.js
export default {
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
}
```

## 🐛 Python/FastAPI Issues

### Module Not Found
**Symptom**: `ModuleNotFoundError: No module named 'fastapi'`

**Solution**:
```bash
# Install dependencies
pip install -r requirements.txt

# Or for specific project
cd ~/projects/project-name
pip install fastapi uvicorn
```

### Port Conflicts
**Symptom**: `Address already in use` for Python server

**Solution**:
```bash
# Kill existing Python processes
pkill -f uvicorn
pkill -f python

# Or use different port
uvicorn app:app --port 8001
```

## 🔐 Authentication Issues

### VNC Desktop Password
**Symptom**: Can't access desktop on port 6080, password rejected

**Solutions**:
```bash
# Default password is "codespace"
# To use a custom password, set VNC_PASSWORD environment variable:

# In .env file (create if it doesn't exist)
echo "VNC_PASSWORD=your_secure_password" >> .env

# Then rebuild the container:
# Command Palette → "Codespaces: Rebuild Container"
```

**Note**: The VNC password is now configurable via the `VNC_PASSWORD` environment variable with a fallback to "codespace".

### Git Push Fails
**Symptom**: `Permission denied (publickey)`

**Solutions**:
```bash
# Check SSH agent
ssh-add -l

# Add key if needed
ssh-add ~/.ssh/id_ed25519

# Or use HTTPS instead
git remote set-url origin https://github.com/username/repo.git
```

### Codespace Permission Denied
**Symptom**: Can't write to certain directories

**Solution**:
```bash
# Ensure vscode user owns files
sudo chown -R vscode:vscode ~/projects
```

## 📊 Performance Issues

### High CPU Usage
**Diagnosis**:
```bash
# Find CPU-intensive processes
top -o %CPU

# Check for infinite loops in JavaScript
# (Look for consistent 100% CPU in browser dev tools)
```

**Solutions**:
1. Use `requestAnimationFrame` instead of `setInterval`
2. Offload work to Web Workers
3. Use WASM for heavy computation
4. Reduce visual complexity (fewer draw calls)

### Slow Git Operations
**Solutions**:
```bash
# Disable fsmonitor (can be slow in codespaces)
git config core.fsmonitor false

# Use shallow clone for large repos
git clone --depth 1 https://github.com/user/repo.git
```

## 🆘 Getting Help

If issue persists:

1. **Check project AGENTS.md**: `~/projects/<name>/AGENTS.md`
2. **Check logs**: `~/.logs/` or browser console
3. **Run diagnostics**:
   ```bash
   ./dev.sh status
   ./ai-cli.sh test
   ```
4. **Restart codespace**: Command Palette → "Codespaces: Rebuild Container"
