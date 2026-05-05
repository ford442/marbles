# AI Workflows Directory

This directory contains templates, examples, and guides for effective multi-model AI orchestration in the Cockpit Codespace.

## Quick Start

### Single Model Query
```bash
./ai-cli.sh xai "Explain WebGPU compute shaders"
```

### Multi-Model Orchestration
```bash
# Sequential refinement
./ai-cli.sh chain "Optimize this shader"

# Multi-perspective analysis
./ai-cli.sh consensus "Best approach for WASM audio?"

# Role-based expertise
./ai-cli.sh delegate coder "Write a WGSL function"

# Named pipeline
./ai-cli.sh pipeline code-review "Review this PR"
```

## Available Templates

- **[webgpu-shader-optimization.md](webgpu-shader-optimization.md)**: Optimize fragment shaders for 2-core systems
- **[wasm-performance-audit.md](wasm-performance-audit.md)**: Comprehensive WASM module analysis
- **[session-examples.md](session-examples.md)**: Real Grok session examples and patterns

## Workflow Patterns

### Chain (Sequential Refinement)
Best for: Complex problems needing iterative improvement
- Model A provides initial solution
- Model B refines and improves it
- Results in higher quality output

### Consensus (Multi-Perspective)
Best for: Architecture decisions, design choices
- All models analyze the problem
- Synthesized response combines best ideas
- Reduces bias, increases robustness

### Delegate (Role-Based)
Best for: Specialized tasks
- Automatically routes to best provider for the role
- Roles: architect, coder, reviewer, researcher
- Consistent expertise for specific domains

### Pipeline (Multi-Step)
Best for: Structured workflows
- Pre-defined sequences for common tasks
- Examples: code-review, design-implement-review

## Best Practices

1. **Provide Context**: Include code, errors, performance metrics
2. **Be Specific**: Clear goals, constraints, target platforms
3. **Iterate**: Start simple, use chains for complex problems
4. **Document**: Save successful sessions as examples
5. **Test Results**: Validate AI-generated code before production

## Adding New Templates

1. Create `.md` file with clear structure
2. Include: goal, workflow, prompt template, expected output
3. Add to this README
4. Test with actual AI queries

## Troubleshooting

- **API Errors**: Check `models.json` and environment variables
- **Poor Results**: Try different orchestration patterns
- **Performance**: Use delegate for faster responses
- **Quality**: Use chain/consensus for better output

See [session-examples.md](session-examples.md) for real-world usage patterns.