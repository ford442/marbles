# WASM Performance Audit Template

## Session Goal
Audit WebAssembly module for performance issues and optimization opportunities.

## AI Workflow
Use `delegate researcher` for initial analysis, then `chain` for implementation.

## Prompt Template
```
Perform a comprehensive performance audit of this WebAssembly module:

Module: [MODULE NAME]
Source: [LANGUAGE - C/C++/Rust]
Target: [BROWSER/NODE/WEB WORKER]

Key areas to analyze:
1. Compilation flags and optimization levels
2. Memory management (heap/stack allocation)
3. Function call overhead
4. SIMD utilization
5. Emscripten-specific optimizations

Current performance metrics:
- Bundle size: [SIZE]
- Load time: [TIME]
- Runtime performance: [METRICS]

Provide specific recommendations with code examples.
```

## Chain Workflow
1. **Researcher**: Initial audit and recommendations
2. **Coder**: Implement top 3 optimizations
3. **Reviewer**: Validate improvements

## Success Criteria
- 20%+ performance improvement
- No functionality regressions
- Maintainable code changes
- Documentation updates