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

    # Release: max optimization, no runtime safety nets.
    target_compile_options(marble_physics PRIVATE
        $<$<CONFIG:Release>:-O3 -ffast-math -fno-exceptions>
    )

    # Debug: -fsanitize=address catches OOB/UAF bugs in the batch kernels'
    # raw pointer arithmetic; -Weverything is Clang-only (Emscripten uses
    # upstream Clang) and surfaces UB the Release build's -ffast-math would
    # otherwise silently paper over. Not used in CI — for local `./build.sh
    # --debug` runs only.
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
    # Native / testing build
    target_compile_options(marble_physics PRIVATE -O3 -ffast-math)
endif()
