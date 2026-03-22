#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROJECTS_DIR="${HOME}/projects"
REPOS_FILE="${WORKSPACE_ROOT:-$(dirname "$0")}/repos.json"
ACTIVE_PROJECT_FILE="${HOME}/.active_project"

show_help() {
    echo "🔄 Cockpit Project Switcher"
    echo "==========================="
    echo ""
    echo "Usage: ./switch.sh <repo-name> [options]"
    echo "       ./switch.sh list"
    echo "       ./switch.sh current"
    echo ""
    echo "Commands:"
    echo "  <repo-name>       - Switch to a project"
    echo "  list              - List all available projects"
    echo "  current           - Show currently active project"
    echo ""
    echo "Options:"
    echo "  --serve           - Start dev server after switching"
    echo "  --code            - Open VS Code after switching"
    echo ""
    echo "Examples:"
    echo "  ./switch.sh candy_world"
    echo "  ./switch.sh mod-player --serve"
    echo "  ./switch.sh web_sequencer --code"
}

list_projects() {
    echo -e "${BLUE}📋 Available Projects:${NC}"
    echo ""
    
    if command -v jq &> /dev/null; then
        jq -r '.registry | to_entries[] | "\(.key)"' "$REPOS_FILE" | while read -r repo; do
            local target_dir="${PROJECTS_DIR}/${repo}"
            local status=""
            
            if [ -d "$target_dir/.git" ]; then
                local branch
                branch=$(git -C "$target_dir" branch --show-current 2>/dev/null || echo "unknown")
                status="${GREEN}[${branch}]${NC} cloned"
            else
                status="${RED}[not cloned]${NC}"
            fi
            
            local desc
            desc=$(jq -r ".registry[\"$repo\"].description // \"\"" "$REPOS_FILE")
            printf "  %-20s %s\n" "$repo" "$desc"
            echo -e "                       $status"
        done
    else
        echo "  Install jq for formatted output"
    fi
    echo ""
}

show_current() {
    if [ -f "$ACTIVE_PROJECT_FILE" ]; then
        local current
        current=$(cat "$ACTIVE_PROJECT_FILE")
        echo -e "${BLUE}🔹 Current project:${NC} ${GREEN}$current${NC}"
        echo ""
        
        local target_dir="${PROJECTS_DIR}/${current}"
        if [ -d "$target_dir/.git" ]; then
            local branch changes
            branch=$(git -C "$target_dir" branch --show-current 2>/dev/null || echo "unknown")
            changes=$(git -C "$target_dir" status --porcelain 2>/dev/null | wc -l)
            
            echo "  Branch: $branch"
            echo "  Location: $target_dir"
            if [ "$changes" -gt 0 ]; then
                echo -e "  Status: ${YELLOW}$changes uncommitted changes${NC}"
            else
                echo -e "  Status: ${GREEN}clean${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  No active project set${NC}"
        echo "  Use: ./switch.sh <repo-name>"
    fi
    echo ""
}

switch_to() {
    local repo_name=$1
    local serve=${2:-false}
    local open_code=${3:-false}
    local target_dir="${PROJECTS_DIR}/${repo_name}"
    
    if command -v jq &> /dev/null; then
        if ! jq -e ".registry[\"$repo_name\"]" "$REPOS_FILE" > /dev/null 2>&1; then
            echo -e "${RED}❌ Error: '$repo_name' not found in registry${NC}"
            echo "  Run './switch.sh list' to see available projects"
            exit 1
        fi
    fi
    
    if [ ! -d "$target_dir/.git" ]; then
        echo -e "${YELLOW}⚠️  $repo_name not cloned yet.${NC}"
        echo -e "${BLUE}📥 Cloning now...${NC}"
        ./setup.sh clone "$repo_name"
    fi
    
    local serve_cmd=""
    local ports=""
    if command -v jq &> /dev/null; then
        serve_cmd=$(jq -r ".registry[\"$repo_name\"].serve_cmd // \"\"" "$REPOS_FILE")
        ports=$(jq -r ".registry[\"$repo_name\"].ports // [] | @tsv" "$REPOS_FILE")
    fi
    
    cd "$target_dir"
    echo "$repo_name" > "$ACTIVE_PROJECT_FILE"
    export COCKPIT_PROJECT="$repo_name"
    
    echo ""
    echo -e "${GREEN}✅ Switched to ${CYAN}$repo_name${NC}"
    echo "  Location: $target_dir"
    echo "  Branch: $(git -C "$target_dir" branch --show-current 2>/dev/null || echo "unknown")"
    if [ -n "$ports" ] && [ "$ports" != "null" ]; then
        echo "  Ports: $ports"
    fi
    echo ""
    
    echo -e "${BLUE}Quick commands:${NC}"
    echo "  cd $target_dir        # Project directory"
    if [ -n "$serve_cmd" ] && [ "$serve_cmd" != "null" ]; then
        echo "  $serve_cmd            # Start dev server"
    fi
    echo ""
    
    if [ "$serve" = "true" ] && [ -n "$serve_cmd" ] && [ "$serve_cmd" != "null" ]; then
        echo -e "${BLUE}🚀 Starting dev server...${NC}"
        echo "  Command: $serve_cmd"
        echo ""
        eval "$serve_cmd" &
        local server_pid=$!
        echo $server_pid > "${HOME}/.${repo_name}.pid"
        sleep 2
        echo -e "${GREEN}✅ Dev server running (PID: $server_pid)${NC}"
        if [ -n "$ports" ]; then
            echo "  URL: http://localhost:$(echo $ports | awk '{print $1}')"
        fi
        echo ""
    fi
    
    if [ "$open_code" = "true" ]; then
        echo -e "${BLUE}📂 Opening VS Code...${NC}"
        code "$target_dir" &
    fi
    
    if [ -n "$BASH_VERSION" ]; then
        PS1="\[\e[36m\]($repo_name)\[\e[0m\] $PS1"
        export PS1
    fi
    
    echo -e "${CYAN}💡 Tip:${NC} Use 'cd $target_dir' to navigate to project"
}

case "${1:-}" in
    list|ls)
        list_projects
        ;;
    current|status)
        show_current
        ;;
    help|--help|-h)
        show_help
        ;;
    "")
        echo -e "${RED}Error: Please specify a project name${NC}"
        show_help
        exit 1
        ;;
    *)
        SERVE=false
        OPEN_CODE=false
        
        for arg in "${@:2}"; do
            case "$arg" in
                --serve|-s)
                    SERVE=true
                    ;;
                --code|-c)
                    OPEN_CODE=true
                    ;;
            esac
        done
        
        switch_to "$1" "$SERVE" "$OPEN_CODE"
        ;;
esac
