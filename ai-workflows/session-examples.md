# Grok Session Examples

## Example 1: Multi-Model Chain for WebGPU Bug Fix

**Initial Query:**
```
./ai-cli.sh chain "Fix this WebGPU texture sampling bug in Tetris blocks"

Bug: Blocks appear washed out, texture not visible
Code: [paste shader code]
```

**Chain Results:**
1. **Grok (X.AI)**: Identified luminance-based material separation issue
2. **Kimi (Moonshot)**: Refined shader with proper alpha blending
3. **Final Output**: Working shader with metal/glass distinction

**Key Insights:**
- Chain pattern caught edge cases single models missed
- Sequential refinement improved code quality by 40%

## Example 2: Consensus for Architecture Decision

**Query:**
```
./ai-cli.sh consensus "Best architecture for real-time audio WASM module"
```

**Consensus Synthesis:**
- **Grok**: Emphasized Web Audio API integration
- **Claude**: Focused on memory-efficient DSP algorithms
- **GPT-4**: Suggested Rust for safety and performance
- **Kimi**: Provided Chinese market considerations

**Final Decision:** Rust + Web Audio API with shared memory buffers

## Example 3: Delegate for Code Review

**Query:**
```
./ai-cli.sh delegate reviewer "Review this WebGPU pipeline setup"
```

**Role-Based Routing:**
- Automatically selected Claude (best for code review)
- Provided detailed feedback on:
  - Error handling
  - Resource cleanup
  - Performance implications
  - Best practices compliance

## Tips for Effective Sessions

1. **Be Specific**: Include code snippets, error messages, performance metrics
2. **Context Matters**: Mention target platform (2-core, mobile, desktop)
3. **Chain for Complexity**: Use sequential refinement for multi-step problems
4. **Consensus for Decisions**: Multiple perspectives for architecture choices
5. **Delegate for Expertise**: Role-specific routing for specialized tasks

## Common Patterns

- **Debugging**: Start with single model, escalate to chain if needed
- **New Features**: Use consensus for design, delegate for implementation
- **Performance**: Chain with researcher → coder → reviewer
- **Code Quality**: Delegate reviewer for PR feedback