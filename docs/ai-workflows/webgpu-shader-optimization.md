# WebGPU Shader Optimization Template

## Session Goal
Optimize a WebGPU fragment shader for better performance on 2-core systems.

## AI Workflow
1. **Architect**: Analyze current shader bottlenecks
2. **Coder**: Implement optimized version
3. **Reviewer**: Validate performance improvements

## Prompt Template
```
Analyze this WebGPU fragment shader for performance bottlenecks:

[PASTE SHADER CODE HERE]

Focus on:
- Texture sampling efficiency
- ALU operations per pixel
- Branching optimization
- Memory access patterns

Provide optimized version with 2-core efficiency in mind.
```

## Expected Output
- Optimized WGSL code
- Performance metrics comparison
- Memory usage analysis
- Compatibility notes

## Follow-up Questions
- How does this affect frame rate?
- Any trade-offs in visual quality?
- Can this be further optimized?