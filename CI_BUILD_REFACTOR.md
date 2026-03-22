# CI Build Refactoring Options

## Current Issues

1. **pnpm not found**: The workflow was trying to use pnpm but it wasn't installed
2. **Alphabetical script execution**: Running `sh ./*.sh` runs scripts in alphabetical order, which breaks dependencies:
   - `build.sh` runs before `openmp_patches.sh` → patches not applied
   - Build fails or produces incorrect output

3. **Complex patch system**: The rubberband library needs OpenMP patches applied during build

## Solutions

### Option 1: Fixed Workflow (Implemented)

The new `.github/workflows/debug_build.yml`:
- Explicitly installs pnpm via `pnpm/action-setup@v2`
- Runs build steps in explicit order (not alphabetical)
- Caches pnpm store for faster builds
- Separates WASM builds from JS builds

**Pros:**
- Minimal changes to existing code
- Keeps patches in build scripts
- Works with current repo structure

**Cons:**
- Still relies on runtime patching
- Build time increased by patching step

---

### Option 2: Fork and Modify (Recommended for Long-term)

Instead of patching during build, maintain forks with modifications:

```
github.com/ford442/rubberband-openmp  (fork with OpenMP patches applied)
github.com/ford442/jc303-wasm         (already exists, memory leak fix pushed)
```

**Changes needed:**

1. **Add forks as submodules:**
```bash
# Remove existing rubberband submodule
git submodule deinit rubberband
git rm rubberband

# Add your fork
git submodule add https://github.com/ford442/rubberband-openmp.git rubberband
```

2. **Simplify `emscripten/build.sh`:**
```bash
#!/bin/bash
# Remove all the patching code (lines 86-184)
# Just build directly since source is already patched
```

3. **Delete `emscripten/openmp_patches.sh`** - no longer needed

**Pros:**
- Faster builds (no patching step)
- Cleaner build scripts
- Patches are version-controlled in the fork
- Can submit PRs upstream

**Cons:**
- Need to maintain forks
- Must sync with upstream changes

---

### Option 3: Vendor Source Directly

Copy the modified source directly into this repo:

```
projects/web_sequencer/
  vendor/
    rubberband/           # Modified source
    jc303/               # Already in jc303_wasm/
```

**Changes needed:**

1. **Copy rubberband source** with patches applied
2. **Update build.sh** to use `vendor/rubberband/`
3. **Remove rubberband submodule**
4. **Add to .gitignore** to prevent accidental upstream sync

**Pros:**
- No external dependencies for build
- Fastest builds
- Full control over source

**Cons:**
- Large source files in repo (~MB)
- Manual sync with upstream
- Not ideal for frequent updates

---

## Recommended Next Steps

### Immediate (Fix CI)
Use the new `debug_build.yml` workflow - it's already set up correctly.

### Short-term (Simplify builds)
1. Fork rubberband: https://github.com/breakfastquay/rubberband → `ford442/rubberband-openmp`
2. Apply the OpenMP patches from `emscripten/build.sh` lines 86-184
3. Commit and push the fork
4. Update submodule to point to your fork
5. Remove patching code from build.sh

### Long-term (Upstream contributions)
Submit the JC303 memory leak fix and rubberband OpenMP patches as PRs to upstream projects.

---

## Build Order Reference

Correct build order (as implemented in debug_build.yml):

```
1. Setup (Node, pnpm, Emscripten)
2. Install JS dependencies (pnpm install)
3. Build JC303 WASM (tools/build_jc303_omp.sh)
   - Uses jc303_wasm submodule
   - Self-contained build
4. Build Rubberband WASM (emscripten/build.sh)
   - Applies patches internally
   - Builds hyphon_native.js
5. Build AssemblyScript modules
   - Oscillators
   - Track freezer
6. Build Rust modules (optional)
7. Type check TypeScript
8. Build Vite app
9. Run tests
```

**NEVER run `sh ./*.sh`** - this executes in alphabetical order:
```bash
# BAD - alphabetical order:
# build.sh (fails - no patches)
# build_jc303_omp.sh (works but wrong order)
# openmp_patches.sh (too late)
```
