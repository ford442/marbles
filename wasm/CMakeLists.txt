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

        # Memory — 32 MB initial gives good headroom without constant growth
        -sALLOW_MEMORY_GROWTH=1
        -sINITIAL_MEMORY=33554432
        # -sMAXIMUM_MEMORY=268435456   # Uncomment to hard-cap at 256 MB

        -sELIMINATE_DUPLICATE_FUNCTIONS=1
        -sWASM_BIGINT=1
        -sALLOW_TABLE_GROWTH=1
        -sEXPORTED_FUNCTIONS=['_malloc','_free']
        -sEXPORTED_RUNTIME_METHODS=['HEAPF32']

        # Release performance & size wins
        $<$<CONFIG:Release>:-O3 -sDISABLE_EXCEPTION_CATCHING=1 -sASSERTIONS=0 --closure 1>

        # Debug: keep the sanitizer's instrumentation and runtime checks intact.
        $<$<CONFIG:Debug>:-fsanitize=address -sASSERTIONS=2>

        # Optional extra aggressive flags (uncomment & test):
        # -sAGGRESSIVE_VARIABLE_ELIMINATION=1
    )
else()
    # Native / testing build
    target_compile_options(marble_physics PRIVATE -O3 -ffast-math)
endif()
