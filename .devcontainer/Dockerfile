FROM mcr.microsoft.com/devcontainers/base:ubuntu

RUN apt-get update && apt-get install -y jq cmake python3 \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && git clone https://github.com/emscripten-core/emsdk.git /opt/emsdk \
    && cd /opt/emsdk && ./emsdk install 3.1.50 && ./emsdk activate 3.1.50 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

ENV EMSDK=/opt/emsdk
ENV EM_CONFIG=/opt/emsdk/.emscripten
ENV EM_CACHE=/opt/emsdk/.emscripten_cache
ENV PATH="${EMSDK}:${EMSDK}/upstream/emscripten:${PATH}"
