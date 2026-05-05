# [Project Name] - Agent Guide

## Overview

- **Purpose**: One-sentence description of what this project does
- **Live Demo**: URL if deployed
- **Stack**: React/Vite/WASM/Python/etc.
- **Key Dependencies**: @mlc-ai/web-llm, three.js, etc.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

## Project Structure

```
project-name/
├── src/                    # Main source code
│   ├── components/        # UI components
│   ├── hooks/            # React hooks
│   ├── utils/            # Utility functions
│   └── types/            # TypeScript types
├── public/               # Static assets
├── tests/                # Test files
├── build/                # Build output (git-ignored)
└── docs/                 # Additional documentation
```

## Build Configuration

### Development
- **Dev server**: `npm run dev` (usually port 3000/5173)
- **Hot reload**: Enabled by default

### Production
- **Build command**: `npm run build`
- **Output directory**: `dist/` or `build/`

### WebAssembly (if applicable)
- **Source language**: C++/Rust/AssemblyScript
- **Build script**: `./build-wasm.sh` or `npm run build:wasm`
- **Prerequisites**: Emscripten/Rust toolchain

## Environment Variables

Create `.env` from `.env.example`:

```bash
# Required
API_KEY=your_key_here

# Optional
DEBUG=true
PORT=3000
```

## Key Features

- Feature 1: Brief description
- Feature 2: Brief description

## External Services

| Service | Purpose | Setup Notes |
|---------|---------|-------------|
| Service A | What it does | How to configure |

## Testing

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test
npm run test -- ComponentName
```

## Deployment

```bash
# Deploy to production
npm run deploy
# or
./deploy.sh
```

## Troubleshooting

### Common Issue 1
Description and solution.

### Common Issue 2
Description and solution.

## Related

- Links to related projects
- Documentation references
- External resources
