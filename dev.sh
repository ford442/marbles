#!/bin/bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECTS_DIR="${HOME}/projects"
REPOS_FILE="${WORKSPACE_ROOT:-$(dirname "$0")}/repos.json"
ACTIVE_PROJECT_FILE="${HOME}/.active_project"

show_help() {
    echo "🛠️  Cockpit Dev CLI"
    echo "==================="
    echo ""
    echo "Usage: ./dev.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start <repo>           - Clone, switch, and serve"
    echo "  multi <repo1> <repo2>  - Open multiple repos in workspace"
    echo "  serve [repo]           - Start dev server"
    echo "  stop [repo]            - Stop dev server"
    echo "  status                 - Show status of all repos"
    echo "  pull-all               - Pull latest for all cloned repos"
    echo "  push-all               - Push all changes in all repos"
    echo "  pr <repo> <message>    - Create a commit and push for PR"
    echo "  clean <repo>           - Remove repo but keep in registry"
    echo "  search <query>         - Search across all cloned repos"
}

cmd_start() {
    local repo=$1
    if [ -z "$repo" ]; then
        echo -e "${RED}Error: Please specify a repo${NC}"
        show_help
        exit 1
    fi
    
    echo -e "${BLUE}🚀 Starting development on ${CYAN}$repo${NC}"
    echo ""
    
    if [ ! -d "${PROJECTS_DIR}/${repo}/.git" ]; then
        echo -e "${BLUE}📥 Cloning $repo...${NC}"
        ./setup.sh clone "$repo"
        echo ""
    fi
    
    ./switch.sh "$repo" --serve
}

cmd_multi() {
    if [ $# -lt 2 ]; then
        echo -e "${RED}Error: Please specify at least 2 repos${NC}"
        show_help
        exit 1
    fi
    
    echo -e "${BLUE}📂 Opening workspace with: $@${NC}"
    
    for repo in "$@"; do
        if [ ! -d "${PROJECTS_DIR}/${repo}/.git" ]; then
            echo -e "${YELLOW}⚠️  $repo not cloned, cloning now...${NC}"
            ./setup.sh clone "$repo"
        fi
    done
    
    local workspace_file="/tmp/cockpit-multi.code-workspace"
    local folders=""
    for repo in "$@"; do
        folders="${folders}{\"path\": \"${PROJECTS_DIR}/${repo}\"},"
    done
    folders="${folders%,}"
    
    cat > "$workspace_file" << EOF
{
    "folders": [$folders],
    "settings": {
        "terminal.integrated.defaultProfile.linux": "bash"
    }
}
EOF
    
    echo -e "${GREEN}✅ Opening multi-repo workspace${NC}"
    code "$workspace_file"
}

cmd_serve() {
    local repo=${1:-$(cat "$ACTIVE_PROJECT_FILE" 2>/dev/null || echo "")}
    
    if [ -z "$repo" ]; then
        echo -e "${RED}Error: No active project and no repo specified${NC}"
        exit 1
    fi
    
    local target_dir="${PROJECTS_DIR}/${repo}"
    if [ ! -d "$target_dir/.git" ]; then
        echo -e "${RED}Error: $repo not found${NC}"
        exit 1
    fi
    
    cd "$target_dir"
    
    local serve_cmd=""
    if command -v jq &> /dev/null; then
        serve_cmd=$(jq -r ".registry[\"$repo\"].serve_cmd // \"\"" "$REPOS_FILE")
    fi
    
    if [ -z "$serve_cmd" ] || [ "$serve_cmd" = "null" ]; then
        if [ -f "package.json" ]; then
            if grep -q '"dev"' package.json; then
                serve_cmd="npm run dev"
            elif grep -q '"start"' package.json; then
                serve_cmd="npm start"
            fi
        elif [ -f "Makefile" ]; then
            serve_cmd="make serve"
        else
            serve_cmd="python3 -m http.server 8080"
        fi
    fi
    
    echo -e "${BLUE}🚀 Starting dev server for ${CYAN}$repo${NC}"
    echo "  Command: $serve_cmd"
    echo ""
    
    eval "$serve_cmd" &
    local pid=$!
    echo $pid > "${HOME}/.${repo}.pid"
    
    sleep 2
    echo -e "${GREEN}✅ Dev server running (PID: $pid)${NC}"
    
    if command -v jq &> /dev/null; then
        local ports=$(jq -r ".registry[\"$repo\"].ports // [] | @tsv" "$REPOS_FILE")
        if [ -n "$ports" ]; then
            for port in $ports; do
                echo "  http://localhost:$port"
            done
        fi
    fi
}

cmd_stop() {
    local repo=${1:-$(cat "$ACTIVE_PROJECT_FILE" 2>/dev/null || echo "")}
    
    if [ -z "$repo" ]; then
        echo -e "${RED}Error: No active project and no repo specified${NC}"
        exit 1
    fi
    
    local pid_file="${HOME}/.${repo}.pid"
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${BLUE}🛑 Stopping dev server for $repo (PID: $pid)${NC}"
            kill "$pid" 2>/dev/null || true
            rm "$pid_file"
            echo -e "${GREEN}✅ Server stopped${NC}"
        else
            echo -e "${YELLOW}⚠️  Server not running${NC}"
            rm "$pid_file"
        fi
    else
        echo -e "${YELLOW}⚠️  No PID file found for $repo${NC}"
    fi
}

cmd_status() {
    FAST_STATUS="${FAST_STATUS:-false}" ./setup.sh status
}

cmd_pull_all() {
    echo -e "${BLUE}📥 Pulling latest for all repos...${NC}"
    echo ""
    
    if command -v jq &> /dev/null; then
        jq -r '.registry | keys[]' "$REPOS_FILE" | while read -r repo; do
            local target_dir="${PROJECTS_DIR}/${repo}"
            if [ -d "$target_dir/.git" ]; then
                echo -e "${CYAN}$repo:${NC}"
                
                local branch
                branch=$(git -C "$target_dir" branch --show-current 2>/dev/null || \
                         git -C "$target_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
                git -C "$target_dir" stash push -m "auto-stash-pull" 2>/dev/null || true
                
                if git -C "$target_dir" pull origin "$branch" 2>/dev/null; then
                    echo -e "  ${GREEN}✅ Pulled latest${NC}"
                else
                    echo -e "  ${YELLOW}⚠️  Could not pull${NC}"
                fi
                
                git -C "$target_dir" stash pop 2>/dev/null || true
            fi
        done
    fi
    echo ""
    echo -e "${GREEN}✅ Pull complete${NC}"
}

cmd_push_all() {
    echo -e "${BLUE}⬆️  Pushing changes for all repos...${NC}"
    echo ""
    
    if command -v jq &> /dev/null; then
        jq -r '.registry | keys[]' "$REPOS_FILE" | while read -r repo; do
            local target_dir="${PROJECTS_DIR}/${repo}"
            if [ -d "$target_dir/.git" ]; then
                local branch
                branch=$(git -C "$target_dir" branch --show-current 2>/dev/null || \
                         git -C "$target_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
                local changes
                changes=$(git -C "$target_dir" status --porcelain 2>/dev/null | wc -l)
                local unpushed
                unpushed=$(git -C "$target_dir" log "origin/${branch}..HEAD" --oneline 2>/dev/null | wc -l)
                
                if [ "$changes" -gt 0 ] || [ "$unpushed" -gt 0 ]; then
                    echo -e "${CYAN}$repo:${NC}"
                    
                    if [ "$changes" -gt 0 ]; then
                        echo -e "  ${YELLOW}⚠️  $changes uncommitted changes (skipping)${NC}"
                    elif [ "$unpushed" -gt 0 ]; then
                        git -C "$target_dir" push
                        echo -e "  ${GREEN}✅ Pushed $unpushed commits${NC}"
                    fi
                fi
            fi
        done
    fi
    echo ""
    echo -e "${GREEN}✅ Push complete${NC}"
}

cmd_pr() {
    local repo=$1
    local message=$2
    
    if [ -z "$repo" ] || [ -z "$message" ]; then
        echo -e "${RED}Error: Please specify repo and commit message${NC}"
        echo "  Usage: ./dev.sh pr <repo> \"message\""
        exit 1
    fi
    
    local target_dir="${PROJECTS_DIR}/${repo}"
    if [ ! -d "$target_dir/.git" ]; then
        echo -e "${RED}Error: $repo not found${NC}"
        exit 1
    fi
    
    cd "$target_dir"
    
    local changes=$(git status --porcelain | wc -l)
    if [ "$changes" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No changes to commit${NC}"
        exit 0
    fi
    
    echo -e "${BLUE}📦 Creating PR for ${CYAN}$repo${NC}"
    echo "  Message: $message"
    echo ""
    
    local branch=$(git branch --show-current)
    if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
        local new_branch="dev/$(date +%Y%m%d)-$(echo $message | tr ' ' '-' | tr -cd '[:alnum:]-' | head -c 30)"
        git checkout -b "$new_branch"
        branch="$new_branch"
        echo -e "  Created branch: ${CYAN}$branch${NC}"
    fi
    
    git add -A
    git commit -m "$message"
    git push -u origin "$branch"
    
    echo ""
    echo -e "${GREEN}✅ Changes pushed to branch: $branch${NC}"
    echo "  Create PR at: https://github.com/ford442/$repo/pull/new/$branch"
}

cmd_clean() {
    local repo=$1
    if [ -z "$repo" ]; then
        echo -e "${RED}Error: Please specify a repo${NC}"
        exit 1
    fi
    
    local target_dir="${PROJECTS_DIR}/${repo}"
    if [ ! -d "$target_dir/.git" ]; then
        echo -e "${YELLOW}⚠️  $repo not cloned${NC}"
        exit 0
    fi
    
    echo -e "${RED}⚠️  This will remove ${CYAN}${target_dir}${RED}${NC}"
    read -p "Are you sure? [y/N] " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$target_dir"
        if [ $(git status --porcelain | wc -l) -gt 0 ]; then
            local stash_name="backup-$(date +%Y%m%d-%H%M%S)"
            git stash push -m "$stash_name"
            echo -e "${YELLOW}💾 Changes stashed as: $stash_name${NC}"
        fi
        
        rm -rf "$target_dir"
        echo -e "${GREEN}✅ $repo removed${NC}"
    else
        echo "Cancelled"
    fi
}

cmd_search() {
    local query=$1
    if [ -z "$query" ]; then
        echo -e "${RED}Error: Please specify a search query${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}🔍 Searching for '${CYAN}$query${BLUE}' across all repos...${NC}"
    echo ""
    
    local found=false
    for dir in "$PROJECTS_DIR"/*/; do
        if [ -d "$dir/.git" ]; then
            local repo=$(basename "$dir")
            cd "$dir"
            
            local matches=$(git grep -l "$query" 2>/dev/null || true)
            if [ -n "$matches" ]; then
                found=true
                echo -e "${CYAN}$repo:${NC}"
                echo "$matches" | head -5 | sed 's/^/  /'
                local count=$(echo "$matches" | wc -l)
                if [ "$count" -gt 5 ]; then
                    echo "  ... and $((count - 5)) more files"
                fi
                echo ""
            fi
        fi
    done
    
    if [ "$found" = false ]; then
        echo -e "${YELLOW}No matches found${NC}"
    fi
}

case "${1:-}" in
    start)
        cmd_start "$2"
        ;;
    multi)
        shift
        cmd_multi "$@"
        ;;
    serve)
        cmd_serve "$2"
        ;;
    stop)
        cmd_stop "$2"
        ;;
    status)
        cmd_status
        ;;
    pull-all)
        cmd_pull_all
        ;;
    push-all)
        cmd_push_all
        ;;
    pr)
        cmd_pr "$2" "$3"
        ;;
    clean)
        cmd_clean "$2"
        ;;
    search)
        cmd_search "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    "")
        echo -e "${RED}Error: Please specify a command${NC}"
        show_help
        exit 1
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac
