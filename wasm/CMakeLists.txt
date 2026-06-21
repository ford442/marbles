cmake_minimum_required(VERSION 3.20)
project(MarblePhysicsWASM CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(marble_physics marble_physics.cpp)

# Emscripten glue code must end in .js
set_target_properties(marble_physics PROPERTIES SUFFIX ".js")

if(EMSCRIPTEN)
    # ==================== COMPILE OPTIONS ====================
    target_compile_options(marble_physics PRIVATE
        -O3                    # Max optimization (Release builds)
        -msimd128              # WebAssembly SIMD — big win for vec3 math
        -ffast-math            # Faster FP math (safe for these helpers)
        -fno-exceptions
        -fvisibility=hidden    # Smaller binary / better inlining
    )

    # ==================== LINK / EMSCRIPTEN OPTIONS ====================
    target_link_options(marble_physics PRIVATE
        # Embind (C++ ↔ JS)
        --bind
        -lembind

        # Factory pattern (required by src/wasm-bridge.js)
        -sMODULARIZE=1
        -sEXPORT_NAME="MarblePhysicsModule"

        # Target environment
        -sENVIRONMENT=web,worker

        # Memory — 32 MB initial gives good headroom without constant growth
        -sALLOW_MEMORY_GROWTH=1
        -sINITIAL_MEMORY=33554432
        # -sMAXIMUM_MEMORY=268435456   # Uncomment to hard-cap at 256 MB

        # Release performance & size wins
        -O3
        -sDISABLE_EXCEPTION_CATCHING=1
        -sASSERTIONS=0
        -sELIMINATE_DUPLICATE_FUNCTIONS=1
        -sWASM_BIGINT=1
        -sALLOW_TABLE_GROWTH=1

        # Optional extra aggressive flags (uncomment & test):
        # -sAGGRESSIVE_VARIABLE_ELIMINATION=1
        # --closure 1                 # Minify the JS glue (can break embind — test carefully)
    )
else()
    # Native / testing build
    target_compile_options(marble_physics PRIVATE -O3 -ffast-math)
endif()
