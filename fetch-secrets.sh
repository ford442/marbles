#!/bin/bash
# Fetch secrets from remote FTP/HTTP server
# Usage: ./fetch-secrets.sh [URL]

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ENV_URL="${1:-}"
TARGET_FILE="${WORKSPACE_ROOT:-$(dirname "$0")}/.env"
BACKUP_FILE="${TARGET_FILE}.backup.$(date +%Y%m%d-%H%M%S)"

show_help() {
    echo "🔐 Fetch Secrets Script"
    echo "======================="
    echo ""
    echo "Downloads .env file from a remote URL (FTP/HTTP/HTTPS)"
    echo ""
    echo "Usage:"
    echo "  ./fetch-secrets.sh <url>       - Fetch from specific URL"
    echo "  ./fetch-secrets.sh             - Fetch from default URL in .env.remote"
    echo "  ./fetch-secrets.sh --help      - Show this help"
    echo ""
    echo "Examples:"
    echo '  ./fetch-secrets.sh "ftp://user:pass@ftp.example.com/secrets/.env"'
    echo '  ./fetch-secrets.sh "https://example.com/.env"'
    echo ""
    echo "Security Notes:"
    echo "  - Always use HTTPS or SFTP when possible"
    echo "  - The downloaded .env is gitignored automatically"
    echo "  - A backup of existing .env is created"
}

# Check if URL provided
if [ -z "$ENV_URL" ]; then
    # Try to load from config file
    if [ -f "${WORKSPACE_ROOT:-$(dirname "$0")}/.env.remote" ]; then
        ENV_URL=$(cat "${WORKSPACE_ROOT:-$(dirname "$0")}/.env.remote" | grep -E '^URL=' | cut -d'=' -f2- | tr -d '"' | tr -d "'")
        if [ -n "$ENV_URL" ]; then
            echo -e "${BLUE}📡 Using URL from .env.remote${NC}"
        fi
    fi
fi

if [ -z "$ENV_URL" ] || [ "$ENV_URL" = "--help" ] || [ "$ENV_URL" = "-h" ]; then
    show_help
    exit 1
fi

echo -e "${BLUE}🔐 Fetching secrets...${NC}"
echo "  URL: $ENV_URL"
echo "  Target: $TARGET_FILE"
echo ""

# Backup existing .env if present
if [ -f "$TARGET_FILE" ]; then
    echo -e "${YELLOW}💾 Backing up existing .env to $BACKUP_FILE${NC}"
    cp "$TARGET_FILE" "$BACKUP_FILE"
fi

# Download using wget or curl
if command -v wget &> /dev/null; then
    echo -e "${BLUE}📥 Downloading with wget...${NC}"
    if wget -q -O "$TARGET_FILE.tmp" "$ENV_URL" 2>/dev/null; then
        mv "$TARGET_FILE.tmp" "$TARGET_FILE"
        echo -e "${GREEN}✅ Downloaded successfully with wget${NC}"
    else
        echo -e "${RED}❌ wget download failed${NC}"
        rm -f "$TARGET_FILE.tmp"
        exit 1
    fi
elif command -v curl &> /dev/null; then
    echo -e "${BLUE}📥 Downloading with curl...${NC}"
    if curl -s -L -o "$TARGET_FILE.tmp" "$ENV_URL" 2>/dev/null; then
        mv "$TARGET_FILE.tmp" "$TARGET_FILE"
        echo -e "${GREEN}✅ Downloaded successfully with curl${NC}"
    else
        echo -e "${RED}❌ curl download failed${NC}"
        rm -f "$TARGET_FILE.tmp"
        exit 1
    fi
else
    echo -e "${RED}❌ Neither wget nor curl found${NC}"
    exit 1
fi

# Verify the downloaded file
if [ -f "$TARGET_FILE" ]; then
    # Check if it looks like a valid .env file
    if grep -q "API_KEY" "$TARGET_FILE" 2>/dev/null || grep -q "=" "$TARGET_FILE" 2>/dev/null; then
        echo -e "${GREEN}✅ Valid .env file downloaded${NC}"
        
        # Count keys
        key_count=$(grep -c "=" "$TARGET_FILE" 2>/dev/null || echo "0")
        echo -e "  Found ${CYAN}$key_count${NC} environment variables"
        
        # Load the environment
        echo ""
        echo -e "${BLUE}🔧 Loading environment...${NC}"
        set -a
        source "$TARGET_FILE"
        set +a
        
        # Update bashrc to auto-load
        if ! grep -q "source.*\.env" "${HOME}/.bashrc" 2>/dev/null; then
            echo '' >> "${HOME}/.bashrc"
            echo '# Load Cockpit environment' >> "${HOME}/.bashrc"
            echo "set -a; source ${TARGET_FILE} 2>/dev/null || true; set +a" >> "${HOME}/.bashrc"
        fi
        
        echo ""
        echo -e "${GREEN}✅ Secrets loaded and configured!${NC}"
        echo ""
        echo "Available keys:"
        grep "=" "$TARGET_FILE" | grep -v "^#" | cut -d'=' -f1 | sed 's/^/  - /'
        
    else
        echo -e "${YELLOW}⚠️  Downloaded file may not be a valid .env file${NC}"
        echo "  Content preview:"
        head -3 "$TARGET_FILE" | sed 's/^/    /'
    fi
else
    echo -e "${RED}❌ Download failed - file not created${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}💡 Next steps:${NC}"
echo "  1. Test APIs: ./ai-cli.sh test"
echo "  2. Start working: ./dev.sh start <repo>"
echo ""
