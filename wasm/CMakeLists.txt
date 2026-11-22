cmake_minimum_required(VERSION 3.20)
project(MarblePhysicsWASM CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

add_executable(marble_physics marble_physics.cpp)

# Emscripten glue code must end in .js
set_target_properties(marble_physics PROPERTIES SUFFIX ".js")

if(EMSCRIPTEN)
    # ==================== COMPILE OPTIONS ====================
    # Flags shared by every config.
    target_compile_options(marble_physics PRIVATE
        -msimd128              # WebAssembly SIMD — big win for vec3 math
        -mnontrapping-fptoint  # Cheap float→int (every SIMD-capable browser has it)
        -fvisibility=hidden    # Smaller binary / better inlining
    )

    # Release: max optimization, strict IEEE 754 float semantics.
    #
    # Deliberately NOT -ffast-math. That flag lets the compiler assume no NaN
    # or infinity ever occurs (so guards like `len < 1e-6f` are compiled away
    # for them), reassociate sums and replace x / y with x * (1 / y), all of
    # which make results differ from the JS fallbacks in src/wasm-bridge.js
    # and, in principle, between compiler versions. Ranked races and ghost
    # replays need every client to compute the same bits.
    #
    # What is kept from it is the part that costs nothing in correctness:
    #   -fno-math-errno     sqrt/pow need not set errno → f32.sqrt is one instruction
    #   -fno-trapping-math  float ops cannot trap in WASM, so they may be
    #                       hoisted and speculated freely
    # -ffp-contract=off pins "no fused multiply-add": WASM has none today,
    # but relaxed-simd does, and a contracted a*b+c rounds differently.
    #
    # tests/test_wasm_parity_ulp.js holds the result to a per-kernel ULP bound
    # against the fallbacks, including NaN / ±Infinity inputs.
    target_compile_options(marble_physics PRIVATE
        $<$<CONFIG:Release>:-O3 -fno-math-errno -fno-trapping-math -ffp-contract=off -fno-exceptions>
    )

    # Debug: -fsanitize=address catches OOB/UAF bugs in the batch kernels'
    # raw pointer arithmetic; -Weverything is Clang-only (Emscripten uses
    # upstream Clang) and surfaces UB that -O3 would otherwise silently
    # paper over. CI only compiles it (see debug_build.yml); run it under
    # Node with `./build.sh --debug`.
    target_compile_options(marble_physics PRIVATE
        $<$<CONFIG:Debug>:-O0 -g -fsanitize=address -Weverything -Wno-c++98-compat>
    )

    # ==================== LINK / EMSCRIPTEN OPTIONS ====================
    target_link_options(marble_physics PRIVATE
        # Target features must also be on the link line, or codegen done at
        # link time (e.g. if -flto is ever enabled) silently drops SIMD.
        -msimd128
        -mnontrapping-fptoint

        # Reject legacy/unknown settings and implicit runtime exports.
        -sSTRICT=1

        # Embind (C++ ↔ JS)
        --bind
        -lembind

        # Factory pattern (required by src/wasm-bridge.js)
        -sMODULARIZE=1
        -sEXPORT_NAME="MarblePhysicsModule"
        -sEXPORT_ES6=1
        -sINCOMING_MODULE_JS_API=['locateFile','wasmBinary']

        # Target environment. Debug additionally allows "node" so the ASan
        # build can be exercised directly from tests/test_wasm_bridge_wasm.js
        # under Node for local testing (Release stays web,worker-only to match
        # the actual browser deployment target and keep the binary lean).
        -sENVIRONMENT=web,worker$<$<CONFIG:Debug>:,node>

        # Memory — 32 MB initial gives good headroom without constant growth;
        # the 64 MB cap stops a runaway batch from growing the heap unbounded.
        -sALLOW_MEMORY_GROWTH=1
        -sINITIAL_MEMORY=33554432
        -sMAXIMUM_MEMORY=67108864
        # emmalloc: ~4.7 KB smaller .wasm than dlmalloc. The bridge only
        # mallocs when a batch outgrows its buffers, so allocator speed is moot.
        -sMALLOC=emmalloc

        # Numeric-only module: no file I/O, no setjmp/longjmp.
        -sFILESYSTEM=0
        -sSUPPORT_LONGJMP=0

        -sWASM_BIGINT=1
        -sALLOW_TABLE_GROWTH=1
        -sEXPORTED_FUNCTIONS=['_malloc','_free']
        -sEXPORTED_RUNTIME_METHODS=['HEAPF32']

        # Release performance & size wins
        $<$<CONFIG:Release>:-O3 -sDISABLE_EXCEPTION_CATCHING=1 -sASSERTIONS=0 --closure 1>

        # Debug: keep the sanitizer's instrumentation and runtime checks intact.
        $<$<CONFIG:Debug>:-fsanitize=address -sASSERTIONS=2>

        # Evaluated and not enabled (see docs/PERFORMANCE_BASELINE.md):
        # -flto — single TU, so no cross-TU inlining to gain; glue grew 15 B.
        # Optional extra aggressive flags (uncomment & test):
        # -sAGGRESSIVE_VARIABLE_ELIMINATION=1
    )
else()
    # Native / testing build: same float semantics as the WASM Release build.
    target_compile_options(marble_physics PRIVATE -O3 -fno-math-errno -fno-trapping-math -ffp-contract=off)
endif()
