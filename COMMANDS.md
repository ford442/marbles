# Codepit Commands Reference

Quick reference for daily development in the Cockpit Codespace.

## 🚀 Development Commands (dev.sh)

```bash
# Start working on a project (clone if needed, switch context, serve)
./dev.sh start web_sequencer
./dev.sh start the_jokesters

# Check status of all projects
./dev.sh status

# Open multiple projects in workspace
./dev.sh multi web_sequencer the_jokesters

# Manage dev servers
./dev.sh serve web_sequencer    # Start server for repo
./dev.sh stop web_sequencer     # Stop server for repo

# Git operations across all projects
./dev.sh pull-all               # Pull latest for all cloned repos
./dev.sh push-all               # Push all commits in all repos
./dev.sh pr web_sequencer "Fix audio latency"  # Commit and push for PR

# Search across all cloned repos
./dev.sh search "TODO: fix"

# Cleanup
./dev.sh clean web_sequencer    # Remove local repo (keeps in registry)
```

## 🤖 AI CLI Commands (ai-cli.sh)

### Single Provider Queries
```bash
./ai-cli.sh xai "Explain WebGPU compute shaders"
./ai-cli.sh kimi "Optimize this function"
./ai-cli.sh openai "Design a shader pipeline"
./ai-cli.sh anthropic "Review this C++ code"
```

### Orchestration Patterns
```bash
# Chain: First model answers, second refines
./ai-cli.sh chain "Best approach for real-time audio in WASM?"

# Consensus: Ask all models, synthesize best answer
./ai-cli.sh consensus "Should I use WebGPU or WebGL for particles?"

# Delegate: Route to best provider for role
./ai-cli.sh delegate architect "Design audio engine architecture"
./ai-cli.sh delegate coder "Write the oscillator code"
./ai-cli.sh delegate reviewer "Check for memory leaks"
./ai-cli.sh delegate researcher "Find WebGPU best practices"

# Pipeline: Multi-step workflows
./ai-cli.sh pipeline code-review "Add error handling"
./ai-cli.sh pipeline design-implement "Build a visualizer"
./ai-cli.sh pipeline research-implement-review "Add FFT analysis"
```

### Management
```bash
./ai-cli.sh test        # Test all API connections
./ai-cli.sh models      # List available models per provider
./ai-cli.sh roles       # List available roles
./ai-cli.sh pipelines   # List available pipelines
```

## 🔄 Context Switching (switch.sh)

```bash
# Switch to a project
./switch.sh web_sequencer

# Switch and start dev server
./switch.sh web_sequencer --serve

# Switch and install dependencies
./switch.sh web_sequencer --install

# Combined
./switch.sh web_sequencer --install --serve
```

## 🛠️ Setup Commands (setup.sh)

```bash
# Full environment setup (runs automatically in codespace)
./setup.sh

# Clone a specific project from repos.json
./setup.sh clone web_sequencer

# Clone all projects
./setup.sh clone-all

# Regenerate project placeholders
./setup.sh projects
```

## 📦 WebAssembly Build Commands

### Emscripten (C/C++)
```bash
# Activate Emscripten environment (tot build installed by default)
source /opt/emsdk/emsdk_env.sh

# Basic build
emcc input.cpp -o output.js -O3 -s WASM=1

# With embind (C++ bindings)
emcc input.cpp -o output.js -O3 -s WASM=1 --bind
```

### Rust
```bash
# Build with wasm-pack
wasm-pack build --target web

# Or for bundler
wasm-pack build --target bundler
```

### AssemblyScript
```bash
# Compile to WASM
npx asc input.ts -o output.wasm --optimize
```

## 🌐 Common Project Commands

Most projects in `/projects/` use:

```bash
# Install dependencies
npm install

# Development server
npm run dev          # Usually on port 3000/5173/8080

# Build
npm run build        # Output to dist/ or build/
npm run build:wasm   # Build WebAssembly components

# Test
npm run test         # Run Vitest/Jest
npm run test:watch   # Watch mode

# Lint/Format
npm run lint
npm run format
```

## 🔍 Debugging Commands

```bash
# Check WebGPU support
node -e "console.log('WebGPU:', !!navigator.gpu)"

# List audio devices (in browser console)
await navigator.mediaDevices.enumerateDevices()

# Check Emscripten installation
which emcc
emcc --version

# Verify Rust/WASM
cargo --version
wasm-pack --version
```

## 📊 System Commands

```bash
# Check resource usage (in codespace)
top
htop

# Disk usage
df -h
du -sh projects/*

# Memory
free -h

# Processes
ps aux | grep node
```
