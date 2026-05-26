cmake_minimum_required(VERSION 3.20)
project(MarblePhysicsWASM CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(marble_physics marble_physics.cpp)

# Emscripten requires the output to carry a .js extension so the glue code
# can be imported from JavaScript.
set_target_properties(marble_physics PROPERTIES SUFFIX ".js")

target_compile_options(marble_physics PRIVATE
    -O2
    -fno-exceptions
)

target_link_options(marble_physics PRIVATE
    # Embind is the Emscripten C++↔JS binding layer.
    --bind
    -lembind

    # Wrap the module in a factory function so it can be dynamically imported.
    -sMODULARIZE=1
    -sEXPORT_NAME="MarblePhysicsModule"

    # Target modern browsers and Web Workers.
    -sENVIRONMENT=web,worker

    # Allow the heap to grow if needed (avoids OOM on heavy scenes).
    -sALLOW_MEMORY_GROWTH=1

    # 16 MB initial heap (sufficient for vector math helpers).
    -sINITIAL_MEMORY=16777216

    -O2
    -fno-exceptions
)
