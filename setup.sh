#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
PROJECTS_DIR="${HOME}/projects"
REPOS_FILE="${WORKSPACE_ROOT:-$(dirname "$0")}/repos.json"
GITHUB_USER="ford442"

# Clone behaviour flags (env-overridable)
# FULL_CLONE=true   → deep clone with full history and tags
# BUILD_ON_CLONE=true → run build_cmd from repos.json after cloning
# CLONE_JOBS=N      → parallelism for clone-all (default: 4)
# FAST_STATUS=true  → show only clone/not-cloned without git details
FULL_CLONE="${FULL_CLONE:-false}"
BUILD_ON_CLONE="${BUILD_ON_CLONE:-false}"
CLONE_JOBS="${CLONE_JOBS:-4}"
FAST_STATUS="${FAST_STATUS:-false}"

show_help() {
    echo "🚀 Cockpit Codespace Setup"
    echo "=========================="
    echo ""
    echo "Usage: ./setup.sh [command] [options]"
    echo ""
    echo "Commands:"
    echo "  (no args)         - Run initial setup"
    echo "  clone <repo>      - Clone a specific repo"
    echo "  clone-all         - Clone all repos in registry"
    echo "  list              - List available repos"
    echo "  status            - Show status of all cloned repos"
    echo "  help              - Show this help"
    echo ""
    echo "Environment flags:"
    echo "  FULL_CLONE=true       - Deep clone with full history (default: shallow)"
    echo "  BUILD_ON_CLONE=true   - Run build_cmd after cloning (default: off)"
    echo "  CLONE_JOBS=N          - Parallel jobs for clone-all (default: 4)"
    echo "  FAST_STATUS=true      - Quick clone/not-cloned status only"
    echo ""
    echo "Examples:"
    echo "  ./setup.sh clone candy_world"
    echo "  CLONE_JOBS=8 ./setup.sh clone-all"
    echo "  FAST_STATUS=true ./setup.sh status"
}

list_repos() {
    echo -e "${BLUE}📋 Available Repositories:${NC}"
    echo ""
    if command -v jq &> /dev/null; then
        jq -r '.registry | to_entries[] | "  \(.key) - \(.value.description) [\(.value.stack | join(", "))]"' "$REPOS_FILE"
    else
        echo "  Install jq for formatted output: apt-get install jq"
    fi
    echo ""
}

clone_repo() {
    local repo_name=$1
    local repo_url="https://github.com/${GITHUB_USER}/${repo_name}.git"
    local target_dir="${PROJECTS_DIR}/${repo_name}"
    
    local default_branch="main"
    local build_cmd=""
    if command -v jq &> /dev/null; then
        default_branch=$(jq -r ".registry[\"$repo_name\"].default_branch // \"main\"" "$REPOS_FILE" 2>/dev/null)
        build_cmd=$(jq -r ".registry[\"$repo_name\"].build_cmd // \"\"" "$REPOS_FILE" 2>/dev/null)
    fi
    
    if [ -d "$target_dir/.git" ]; then
        echo -e "${YELLOW}⚠️  ${repo_name} already cloned. Pulling latest...${NC}"
        git -C "$target_dir" pull origin "$default_branch"
    else
        echo -e "${BLUE}📥 Cloning ${repo_name}...${NC}"
        mkdir -p "$PROJECTS_DIR"
        if [ "$FULL_CLONE" = "true" ]; then
            git clone "$repo_url" "$target_dir"
        else
            git clone --depth 1 --no-tags "$repo_url" "$target_dir"
        fi
        echo -e "${GREEN}✅ Cloned to ${target_dir}${NC}"
    fi
    
    if [ "$BUILD_ON_CLONE" = "true" ] && [ -n "$build_cmd" ] && [ "$build_cmd" != "null" ]; then
        echo -e "${BLUE}📦 Running build command...${NC}"
        (cd "$target_dir" && bash -c "$build_cmd") || \
            echo -e "${YELLOW}⚠️  Build command failed, you may need to run it manually${NC}"
    fi
    
    echo -e "${GREEN}✅ ${repo_name} ready!${NC}"
    echo ""
}

clone_all() {
    echo -e "${BLUE}📥 Cloning all repos...${NC}"
    echo ""
    
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}⚠️  jq not found. Install jq or clone repos individually:${NC}"
        list_repos
        return
    fi

    local repos
    repos=$(jq -r '.registry | keys[]' "$REPOS_FILE")

    local script_path
    script_path="$(realpath "$0")"

    # Parallel clone using xargs -P if CLONE_JOBS > 1, else serial
    if [ "${CLONE_JOBS:-4}" -gt 1 ] 2>/dev/null; then
        echo "$repos" | xargs -P "${CLONE_JOBS:-4}" -I{} bash -c \
            "FULL_CLONE=${FULL_CLONE} BUILD_ON_CLONE=${BUILD_ON_CLONE} \"$script_path\" clone {}" 2>&1 || {
            echo -e "${YELLOW}⚠️  Parallel clone failed, falling back to serial...${NC}"
            echo "$repos" | while read -r repo; do clone_repo "$repo"; done
        }
    else
        echo "$repos" | while read -r repo; do clone_repo "$repo"; done
    fi
}

show_status() {
    echo -e "${BLUE}📊 Repo Status:${NC}"
    echo ""
    
    if ! command -v jq &> /dev/null; then
        echo "  Install jq for status: apt-get install jq"
        return
    fi

    jq -r '.registry | keys[]' "$REPOS_FILE" | while read -r repo; do
        local target_dir="${PROJECTS_DIR}/${repo}"
        if [ -d "$target_dir/.git" ]; then
            if [ "$FAST_STATUS" = "true" ]; then
                local branch
                branch=$(git -C "$target_dir" branch --show-current 2>/dev/null || echo "unknown")
                echo -e "  ${GREEN}✅ ${repo} [${branch}]${NC}"
            else
                local branch changes unpushed
                branch=$(git -C "$target_dir" branch --show-current 2>/dev/null || echo "unknown")
                changes=$(git -C "$target_dir" status --porcelain 2>/dev/null | wc -l)
                unpushed=$(git -C "$target_dir" log "origin/${branch}..HEAD" --oneline 2>/dev/null | wc -l)
                
                if [ "$changes" -gt 0 ]; then
                    echo -e "  ${YELLOW}⚠️  ${repo} [${branch}] - ${changes} uncommitted changes${NC}"
                elif [ "$unpushed" -gt 0 ]; then
                    echo -e "  ${BLUE}⬆️  ${repo} [${branch}] - ${unpushed} unpushed commits${NC}"
                else
                    echo -e "  ${GREEN}✅ ${repo} [${branch}] - clean${NC}"
                fi
            fi
        else
            echo -e "  ${RED}❌ ${repo} - not cloned${NC}"
        fi
    done
    echo ""
}

initial_setup() {
    echo "🚀 Cockpit Codespace Setup"
    echo "=========================="
    echo ""
    
    # Install jq if not present
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}📦 Installing jq...${NC}"
        sudo apt-get update && sudo apt-get install -y jq
    fi
    
    # Load or fetch environment variables
    local ENV_FILE="${WORKSPACE_ROOT:-$(dirname "$0")}/.env"
    local ENV_REMOTE_FILE="${WORKSPACE_ROOT:-$(dirname "$0")}/.env.remote"
    
    if [ -f "$ENV_FILE" ]; then
        echo -e "${BLUE}🔐 Loading API keys from .env...${NC}"
        set -a
        source "$ENV_FILE"
        set +a
        echo -e "${GREEN}✅ Environment loaded${NC}"
        echo ""
    elif [ -f "$ENV_REMOTE_FILE" ]; then
        # Check if remote URL is configured
        local remote_url=$(grep -E '^URL=' "$ENV_REMOTE_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" | head -1)
        if [ -n "$remote_url" ]; then
            echo -e "${BLUE}🔐 Fetching secrets from remote...${NC}"
            if [ -f "${WORKSPACE_ROOT:-$(dirname "$0")}/fetch-secrets.sh" ]; then
                bash "${WORKSPACE_ROOT:-$(dirname "$0")}/fetch-secrets.sh" "$remote_url"
                echo ""
            else
                echo -e "${YELLOW}⚠️  fetch-secrets.sh not found${NC}"
            fi
        fi
    fi
    
    # Initialize projects directory
    echo -e "${BLUE}📁 Initializing projects directory: ${PROJECTS_DIR}${NC}"
    mkdir -p "${PROJECTS_DIR}"
    
    # Install Emscripten if not already installed
    # The default configuration uses the tip‑of‑tree ("tot") build instead of a
    # pinned stable release.  This keeps the SDK up‑to‑date with the latest
    # WebGPU/wasm features and mirrors our development environment.
    if [ ! -d "/opt/emsdk" ]; then
        echo -e "${BLUE}📦 Installing Emscripten SDK (tot) ...${NC}"
        sudo mkdir -p /opt/emsdk
        sudo chown -R $(whoami):$(id -gn) /opt/emsdk
        cd /opt/emsdk
        git clone --depth 1 https://github.com/emscripten-core/emsdk.git .
        # install and activate the TIP‑OF‑TREE build by default
        ./emsdk install tot
        ./emsdk activate tot
        echo -e "${GREEN}✅ Emscripten SDK (tot) installed${NC}"
    else
        echo -e "${GREEN}✅ Emscripten SDK already installed${NC}"
    fi
    
    # Source Emscripten environment
    if [ -f "/opt/emsdk/emsdk_env.sh" ]; then
        source /opt/emsdk/emsdk_env.sh
        if ! grep -q "emsdk_env.sh" ~/.bashrc; then
            echo 'source /opt/emsdk/emsdk_env.sh > /dev/null 2>&1' >> ~/.bashrc
        fi
    fi
    
    # Install Rust if not already installed
    if ! command -v rustc &> /dev/null; then
        echo -e "${BLUE}🛠️ Installing Rust & Wasm-Pack...${NC}"
        # Install Rust
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
        # Install wasm-pack (standard for Rust -> Web)
        curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
        # Add requested targets
        rustup target add wasm32-unknown-unknown
        rustup target add i686-unknown-linux-gnu
        echo -e "${GREEN}✅ Rust Installed.${NC}"
        rustc --version
        # Add to .bashrc for future sessions
        if ! grep -q ".cargo/env" ~/.bashrc; then
            echo 'source $HOME/.cargo/env' >> ~/.bashrc
        fi
    else
        echo -e "${GREEN}✅ Rust already installed${NC}"
    fi
    
    # Install jq if not present
    if ! command -v jq &> /dev/null; then
        echo -e "${BLUE}📦 Installing jq...${NC}"
        sudo apt-get update && sudo apt-get install -y jq
    fi
    
    # Setup shared cache directories
    echo -e "${BLUE}⚙️  Setting up shared caches...${NC}"
    mkdir -p "${HOME}/.npm-global"
    npm config set prefix "${HOME}/.npm-global"
    export PATH="${HOME}/.npm-global/bin:$PATH"
    
    # Configure git
    git config --global core.preloadindex true
    git config --global core.fscache true
    git config --global gc.auto 256
    
    # Install global tools
    if command -v npm &> /dev/null; then
        npm config set fetch-retries 3
        npm config set fetch-retry-mintimeout 10000
        npm config set fetch-retry-maxtimeout 60000
        npm install -g http-server serve typescript 2>/dev/null || true
        echo -e "${GREEN}✅ Global npm tools installed${NC}"
    fi
    
    if command -v pip &> /dev/null; then
        pip install --upgrade pip --quiet
        echo -e "${GREEN}✅ pip updated${NC}"

        echo -e "${BLUE}📦 Installing aider and kimi...${NC}"
        python3 -m pip install aider-install --quiet
        aider-install
        curl -LsSf https://code.kimi.com/install.sh | bash
        echo -e "${GREEN}✅ aider and kimi installed${NC}"
    fi
    
    # Make .env auto-load in shell profile
    if ! grep -q "source.*\.env" "${HOME}/.bashrc" 2>/dev/null; then
        echo '' >> "${HOME}/.bashrc"
        echo '# Load Cockpit environment' >> "${HOME}/.bashrc"
        echo "set -a; source ${WORKSPACE_ROOT}/.env 2>/dev/null || true; set +a" >> "${HOME}/.bashrc"
        echo "alias ai='${WORKSPACE_ROOT}/ai-cli.sh'" >> "${HOME}/.bashrc"
        echo -e "${GREEN}✅ Added .env loader and 'ai' alias to .bashrc${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}✅ Cockpit Codespace setup complete!${NC}"
    echo ""
    echo -e "${YELLOW}🎯 Next steps:${NC}"
    echo "  1. View available repos: ./setup.sh list"
    echo "  2. Clone a repo: ./setup.sh clone candy_world"
    echo "  3. Clone all repos: ./setup.sh clone-all"
    echo "  4. Check status: ./setup.sh status"
    echo "  5. Switch to a project: ./switch.sh candy_world"
    echo ""
    echo -e "${BLUE}📚 Resources:${NC}"
    echo "  - Projects: ${PROJECTS_DIR}"
    echo "  - Repos config: ${REPOS_FILE}"
    echo "  - Emscripten: /opt/emsdk"
    echo ""
}

# Main command dispatcher
case "${1:-}" in
    clone)
        if [ -z "${2:-}" ]; then
            echo -e "${RED}Error: Please specify a repo name${NC}"
            list_repos
            exit 1
        fi
        clone_repo "$2"
        ;;
    clone-all)
        clone_all
        ;;
    list)
        list_repos
        ;;
    status)
        show_status
        ;;
    help|--help|-h)
        show_help
        ;;
    "")
        initial_setup
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac
