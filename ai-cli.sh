#!/bin/bash
# AI CLI Helper - Multi-model orchestration for X.AI, Moonshot, OpenAI, Anthropic

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

SCRIPT_DIR="${WORKSPACE_ROOT:-$(dirname "$0")}"
MODELS_FILE="${SCRIPT_DIR}/models.json"

show_help() {
    echo "🤖 AI CLI Helper — Multi-Model Orchestration"
    echo "============================================="
    echo ""
    echo "Query individual models or orchestrate multi-model workflows."
    echo ""
    echo "Single Model:"
    echo "  ./ai-cli.sh xai <prompt>                 - Query X.AI (Grok)"
    echo "  ./ai-cli.sh kimi <prompt>                - Query Kimi (kimi-pro)"
    echo "  ./ai-cli.sh openai <prompt>              - Query OpenAI"
    echo "  ./ai-cli.sh anthropic <prompt>           - Query Anthropic (Claude)"
    echo ""
    echo "Kimi Shortcuts:"
    echo "  ./ai-cli.sh --kimi <prompt>              - One-off Kimi assistant query"
    echo "  ./ai-cli.sh --kimi-swarm <prompt>        - Kimi swarm: plan→split→work→summarize"
    echo ""
    echo "Multi-Model Orchestration:"
    echo "  ./ai-cli.sh chain <prompt>               - Sequential chain: xai → kimi refines"
    echo "  ./ai-cli.sh consensus <prompt>           - Ask all, merge responses"
    echo "  ./ai-cli.sh delegate <role> <prompt>     - Route to best provider for role"
    echo "  ./ai-cli.sh pipeline <name> <prompt>     - Run a named multi-step pipeline"
    echo ""
    echo "Management:"
    echo "  ./ai-cli.sh test                         - Test all API connections"
    echo "  ./ai-cli.sh models                       - List available models"
    echo "  ./ai-cli.sh roles                        - List available roles"
    echo "  ./ai-cli.sh pipelines                    - List available pipelines"
    echo ""
    echo "Roles:     architect, coder, reviewer, researcher, planner, splitter, worker, summarizer"
    echo "Pipelines: code-review, design-implement, research-implement-review, kimi-assistant, kimi-swarm"
    echo ""
    echo "Environment:"
    echo "  KIMI_API_KEY      - Kimi API key (MOONSHOT_API_KEY accepted as fallback)"
    echo "  KIMI_DEFAULT=true - Use kimi:kimi-pro as the default single-model target"
    echo ""
    echo "Examples:"
    echo '  ./ai-cli.sh xai "Explain WebGPU compute shaders"'
    echo '  ./ai-cli.sh --kimi "Summarise this 100k-token document"'
    echo '  ./ai-cli.sh --kimi-swarm "Build a real-time audio visualiser"'
    echo '  ./ai-cli.sh chain "Optimize this WebAssembly module"'
    echo '  ./ai-cli.sh delegate coder "Write a WGSL vertex shader"'
    echo '  ./ai-cli.sh pipeline code-review "Add error handling to fetch calls"'
    echo '  ./ai-cli.sh consensus "Best approach for real-time audio in WASM?"'
}

test_apis() {
    echo -e "${BLUE}🧪 Testing API connections...${NC}"
    echo ""
    
    if [ -n "$XAI_API_KEY" ]; then
        echo -e "${BLUE}Testing X.AI...${NC}"
        local xai_response=$(curl -s -o /dev/null -w "%{http_code}" \
            https://api.x.ai/v1/models \
            -H "Authorization: Bearer $XAI_API_KEY" \
            -H "Content-Type: application/json" 2>/dev/null || echo "000")
        
        if [ "$xai_response" = "200" ]; then
            echo -e "  ${GREEN}✅ X.AI API connection successful${NC}"
        else
            echo -e "  ${YELLOW}⚠️  X.AI API returned HTTP $xai_response${NC}"
        fi
    else
        echo -e "  ${RED}❌ XAI_API_KEY not set${NC}"
    fi
    
    echo ""
    
    if [ -n "$KIMI_API_KEY" ] || [ -n "$MOONSHOT_API_KEY" ]; then
        echo -e "${BLUE}Testing Kimi...${NC}"
        local _kimi_key="${KIMI_API_KEY:-$MOONSHOT_API_KEY}"
        local kimi_response=$(curl -s -o /dev/null -w "%{http_code}" \
            https://api.moonshot.cn/v1/models \
            -H "Authorization: Bearer $_kimi_key" \
            -H "Content-Type: application/json" 2>/dev/null || echo "000")
        
        if [ "$kimi_response" = "200" ]; then
            echo -e "  ${GREEN}✅ Kimi API connection successful${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Kimi API returned HTTP $kimi_response${NC}"
        fi
    else
        echo -e "  ${RED}❌ KIMI_API_KEY (or MOONSHOT_API_KEY) not set${NC}"
    fi

    if [ -n "$OPENAI_API_KEY" ]; then
        echo -e "${BLUE}Testing OpenAI...${NC}"
        local openai_response=$(curl -s -o /dev/null -w "%{http_code}" \
            https://api.openai.com/v1/models \
            -H "Authorization: Bearer $OPENAI_API_KEY" \
            -H "Content-Type: application/json" 2>/dev/null || echo "000")

        if [ "$openai_response" = "200" ]; then
            echo -e "  ${GREEN}✅ OpenAI API connection successful${NC}"
        else
            echo -e "  ${YELLOW}⚠️  OpenAI API returned HTTP $openai_response${NC}"
        fi
    else
        echo -e "  ${RED}❌ OPENAI_API_KEY not set${NC}"
    fi

    echo ""

    if [ -n "$ANTHROPIC_API_KEY" ]; then
        echo -e "${BLUE}Testing Anthropic...${NC}"
        local anthropic_response=$(curl -s -o /dev/null -w "%{http_code}" \
            https://api.anthropic.com/v1/messages \
            -H "x-api-key: $ANTHROPIC_API_KEY" \
            -H "anthropic-version: 2023-06-01" \
            -H "Content-Type: application/json" 2>/dev/null || echo "000")

        # Anthropic returns 400 for missing body on valid key, 401 for bad key
        if [ "$anthropic_response" = "400" ] || [ "$anthropic_response" = "200" ]; then
            echo -e "  ${GREEN}✅ Anthropic API connection successful${NC}"
        elif [ "$anthropic_response" = "401" ]; then
            echo -e "  ${YELLOW}⚠️  Anthropic API key invalid (HTTP 401)${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Anthropic API returned HTTP $anthropic_response${NC}"
        fi
    else
        echo -e "  ${RED}❌ ANTHROPIC_API_KEY not set${NC}"
    fi
}

list_models() {
    echo -e "${BLUE}📋 Available Models:${NC}"
    echo ""
    
    echo -e "X.AI (Grok):"
    if [ -n "$XAI_API_KEY" ]; then
        curl -s https://api.x.ai/v1/models \
            -H "Authorization: Bearer $XAI_API_KEY" \
            -H "Content-Type: application/json" 2>/dev/null | \
            jq -r '.data[] | "  - \(.id): \(.object)"' 2>/dev/null || \
            echo "  (Could not fetch models - check API key)"
    else
        echo -e "  ${YELLOW}API key not configured${NC}"
    fi
    
    echo ""
    echo -e "Kimi:"
    local _kimi_key="${KIMI_API_KEY:-$MOONSHOT_API_KEY}"
    if [ -n "$_kimi_key" ]; then
        curl -s https://api.moonshot.cn/v1/models \
            -H "Authorization: Bearer $_kimi_key" \
            -H "Content-Type: application/json" 2>/dev/null | \
            jq -r '.data[] | "  - \(.id): \(.owned_by)"' 2>/dev/null || \
            echo "  (Could not fetch models - check API key)"
    else
        echo -e "  ${YELLOW}API key not configured (set KIMI_API_KEY or MOONSHOT_API_KEY)${NC}"
    fi

    echo ""
    echo -e "OpenAI:"
    if [ -n "$OPENAI_API_KEY" ]; then
        curl -s https://api.openai.com/v1/models \
            -H "Authorization: Bearer $OPENAI_API_KEY" \
            -H "Content-Type: application/json" 2>/dev/null | \
            jq -r '[.data[] | select(.id | test("gpt|o1"))] | sort_by(.id) | .[] | "  - \(.id)"' 2>/dev/null || \
            echo "  (Could not fetch models - check API key)"
    else
        echo -e "  ${YELLOW}API key not configured${NC}"
    fi

    echo ""
    echo -e "Anthropic (Claude):"
    if [ -n "$ANTHROPIC_API_KEY" ]; then
        echo "  - claude-sonnet-4-20250514"
        echo "  - claude-3-5-haiku-20241022"
        echo "  (Anthropic does not provide a model listing endpoint)"
    else
        echo -e "  ${YELLOW}API key not configured${NC}"
    fi

    echo ""
    echo -e "${CYAN}Configured in:${NC} ${MODELS_FILE}"
}

## ─── Generic query helpers ───────────────────────────────────────────────────

# query_provider <provider> <prompt> [system_prompt] [temperature_override]
# Unified function that queries any OpenAI-compatible provider.
# Anthropic uses its own format and is handled separately.
# For the kimi provider, KIMI_API_KEY is checked first; MOONSHOT_API_KEY is the fallback.
query_provider() {
    local provider="$1"
    local prompt="$2"
    local system_prompt="${3:-You are a helpful assistant.}"
    local temperature_override="${4:-}"

    if [ -z "$prompt" ]; then
        echo -e "${RED}Error: Please provide a prompt${NC}"
        return 1
    fi

    local api_base model api_key temperature
    api_base=$(jq -r ".providers[\"$provider\"].api_base // \"\"" "$MODELS_FILE")
    model=$(jq -r ".providers[\"$provider\"].default_model // \"\"" "$MODELS_FILE")
    temperature=$(jq -r ".providers[\"$provider\"].temperature // 0.7" "$MODELS_FILE")
    local env_key env_key_fallback
    env_key=$(jq -r ".providers[\"$provider\"].env_key // \"\"" "$MODELS_FILE")
    env_key_fallback=$(jq -r ".providers[\"$provider\"].env_key_fallback // \"\"" "$MODELS_FILE")
    api_key="${!env_key:-}"

    # Use fallback env key if primary is not set (e.g. MOONSHOT_API_KEY for kimi)
    if [ -z "$api_key" ] && [ -n "$env_key_fallback" ]; then
        api_key="${!env_key_fallback:-}"
    fi

    if [ -z "$api_key" ]; then
        local key_hint="$env_key"
        [ -n "$env_key_fallback" ] && key_hint="${key_hint} (or ${env_key_fallback})"
        echo -e "${RED}Error: $key_hint not set (required for $provider)${NC}"
        return 1
    fi

    # Apply KIMI_DEFAULT: override model when provider is kimi
    if [ "$provider" = "kimi" ] && [ "${KIMI_DEFAULT:-false}" = "true" ]; then
        model="kimi-pro"
    fi

    # Pipeline/caller may supply a temperature override
    if [ -n "$temperature_override" ]; then
        temperature="$temperature_override"
    fi

    if [ "$provider" = "anthropic" ]; then
        _query_anthropic "$api_key" "$model" "$system_prompt" "$prompt" "$temperature"
    else
        _query_openai_compat "$api_base" "$api_key" "$model" "$system_prompt" "$prompt" "$temperature"
    fi
}

# Internal: OpenAI-compatible chat completions (xai, kimi, openai)
_query_openai_compat() {
    local api_base="$1" api_key="$2" model="$3" system_prompt="$4" prompt="$5" temperature="$6"
    local escaped_system escaped_prompt
    escaped_system=$(printf '%s' "$system_prompt" | jq -Rs .)
    escaped_prompt=$(printf '%s' "$prompt" | jq -Rs .)

    curl -s "${api_base}/chat/completions" \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d "{
            \"model\": \"$model\",
            \"messages\": [
                {\"role\": \"system\", \"content\": $escaped_system},
                {\"role\": \"user\", \"content\": $escaped_prompt}
            ],
            \"temperature\": $temperature,
            \"stream\": false
        }" | jq -r '.choices[0].message.content // .error.message // "Error: Could not parse response"' 2>/dev/null
}

# Internal: Anthropic Messages API
_query_anthropic() {
    local api_key="$1" model="$2" system_prompt="$3" prompt="$4" temperature="$5"
    local escaped_system escaped_prompt
    escaped_system=$(printf '%s' "$system_prompt" | jq -Rs .)
    escaped_prompt=$(printf '%s' "$prompt" | jq -Rs .)

    curl -s "https://api.anthropic.com/v1/messages" \
        -H "x-api-key: $api_key" \
        -H "anthropic-version: 2023-06-01" \
        -H "Content-Type: application/json" \
        -d "{
            \"model\": \"$model\",
            \"max_tokens\": 4096,
            \"system\": $escaped_system,
            \"messages\": [
                {\"role\": \"user\", \"content\": $escaped_prompt}
            ],
            \"temperature\": $temperature
        }" | jq -r '.content[0].text // .error.message // "Error: Could not parse response"' 2>/dev/null
}

## ─── Single-model query wrappers ────────────────────────────────────────────

query_xai() {
    echo -e "${BLUE}🤖 Querying X.AI (Grok)...${NC}"
    echo ""
    query_provider "xai" "$*"
}

query_kimi() {
    echo -e "${BLUE}🌙 Querying Kimi...${NC}"
    echo ""
    query_provider "kimi" "$*"
}

query_openai() {
    echo -e "${BLUE}🧠 Querying OpenAI...${NC}"
    echo ""
    query_provider "openai" "$*"
}

query_anthropic() {
    echo -e "${BLUE}🟣 Querying Anthropic (Claude)...${NC}"
    echo ""
    query_provider "anthropic" "$*"
}

## ─── Multi-model orchestration ──────────────────────────────────────────────

# Get available providers (those with API keys set)
get_available_providers() {
    local providers=()
    for p in $(jq -r '.providers | keys[]' "$MODELS_FILE"); do
        local env_key env_key_fallback
        env_key=$(jq -r ".providers[\"$p\"].env_key" "$MODELS_FILE")
        env_key_fallback=$(jq -r ".providers[\"$p\"].env_key_fallback // \"\"" "$MODELS_FILE")
        if [ -n "${!env_key:-}" ] || { [ -n "$env_key_fallback" ] && [ -n "${!env_key_fallback:-}" ]; }; then
            providers+=("$p")
        fi
    done
    echo "${providers[@]}"
}

# chain: First model answers, second model refines
cmd_chain() {
    local prompt="$*"
    if [ -z "$prompt" ]; then
        echo -e "${RED}Error: Please provide a prompt${NC}"
        return 1
    fi

    local available
    available=($(get_available_providers))
    if [ "${#available[@]}" -lt 2 ]; then
        echo -e "${RED}Error: Chain requires at least 2 configured providers (found: ${available[*]:-none})${NC}"
        return 1
    fi

    local first="${available[0]}"
    local second="${available[1]}"
    local first_name second_name
    first_name=$(jq -r ".providers[\"$first\"].name" "$MODELS_FILE")
    second_name=$(jq -r ".providers[\"$second\"].name" "$MODELS_FILE")

    echo -e "${MAGENTA}🔗 Chain: ${first_name} → ${second_name}${NC}"
    echo ""

    echo -e "${CYAN}── Step 1: ${first_name} ──${NC}"
    local step1_result
    step1_result=$(query_provider "$first" "$prompt")
    echo "$step1_result"
    echo ""

    echo -e "${CYAN}── Step 2: ${second_name} (refining) ──${NC}"
    local refine_prompt="A previous AI assistant answered the following question.

Original question: ${prompt}

Previous answer:
${step1_result}

Please review, correct any errors, and provide an improved answer."
    query_provider "$second" "$refine_prompt"
}

# consensus: Ask all available providers, then summarize
cmd_consensus() {
    local prompt="$*"
    if [ -z "$prompt" ]; then
        echo -e "${RED}Error: Please provide a prompt${NC}"
        return 1
    fi

    local available
    available=($(get_available_providers))
    if [ "${#available[@]}" -lt 2 ]; then
        echo -e "${RED}Error: Consensus requires at least 2 configured providers (found: ${available[*]:-none})${NC}"
        return 1
    fi

    echo -e "${MAGENTA}🗳️  Consensus across ${#available[@]} models${NC}"
    echo ""

    local all_responses=""
    local i=1
    for provider in "${available[@]}"; do
        local pname
        pname=$(jq -r ".providers[\"$provider\"].name" "$MODELS_FILE")
        echo -e "${CYAN}── Response ${i}: ${pname} ──${NC}"
        local response
        response=$(query_provider "$provider" "$prompt")
        echo "$response"
        all_responses="${all_responses}
--- ${pname} ---
${response}
"
        echo ""
        i=$((i + 1))
    done

    # Use the first available provider to synthesize
    echo -e "${MAGENTA}── Consensus Summary ──${NC}"
    local synth_prompt="Multiple AI models answered this question: ${prompt}

Their responses:
${all_responses}

Synthesize a single, best answer that combines the strongest points from each response. Note any disagreements."
    query_provider "${available[0]}" "$synth_prompt" "You are a neutral synthesizer. Combine multiple AI responses into one clear, accurate answer."
}

# delegate: Route to the best provider for a given role
cmd_delegate() {
    local role="$1"
    shift
    local prompt="$*"

    if [ -z "$role" ] || [ -z "$prompt" ]; then
        echo -e "${RED}Error: Usage: ./ai-cli.sh delegate <role> <prompt>${NC}"
        echo "  Roles: architect, coder, reviewer, researcher"
        return 1
    fi

    local role_exists
    role_exists=$(jq -r ".roles[\"$role\"] // empty" "$MODELS_FILE")
    if [ -z "$role_exists" ]; then
        echo -e "${RED}Error: Unknown role '$role'${NC}"
        echo "  Available roles: $(jq -r '.roles | keys | join(", ")' "$MODELS_FILE")"
        return 1
    fi

    local system_prompt role_desc
    system_prompt=$(jq -r ".roles[\"$role\"].system_prompt" "$MODELS_FILE")
    role_desc=$(jq -r ".roles[\"$role\"].description" "$MODELS_FILE")

    # Pick the first preferred provider that has an API key configured
    local provider=""
    for p in $(jq -r ".roles[\"$role\"].preferred_providers[]" "$MODELS_FILE"); do
        local env_key
        env_key=$(jq -r ".providers[\"$p\"].env_key" "$MODELS_FILE")
        if [ -n "${!env_key:-}" ]; then
            provider="$p"
            break
        fi
    done

    if [ -z "$provider" ]; then
        # Fallback: use any available provider
        provider=$(get_available_providers | awk '{print $1}')
    fi

    if [ -z "$provider" ]; then
        echo -e "${RED}Error: No API keys configured for any provider${NC}"
        return 1
    fi

    local pname
    pname=$(jq -r ".providers[\"$provider\"].name" "$MODELS_FILE")
    echo -e "${MAGENTA}🎯 Delegate [${role}] → ${pname}${NC}"
    echo -e "${CYAN}   ${role_desc}${NC}"
    echo ""

    query_provider "$provider" "$prompt" "$system_prompt"
}

# pipeline: Run a named multi-step pipeline from models.json
cmd_pipeline() {
    local pipeline_name="$1"
    shift
    local prompt="$*"

    if [ -z "$pipeline_name" ] || [ -z "$prompt" ]; then
        echo -e "${RED}Error: Usage: ./ai-cli.sh pipeline <name> <prompt>${NC}"
        list_pipelines
        return 1
    fi

    local pipe_exists
    pipe_exists=$(jq -r ".pipelines[\"$pipeline_name\"] // empty" "$MODELS_FILE")
    if [ -z "$pipe_exists" ]; then
        echo -e "${RED}Error: Unknown pipeline '$pipeline_name'${NC}"
        list_pipelines
        return 1
    fi

    local pipe_desc
    pipe_desc=$(jq -r ".pipelines[\"$pipeline_name\"].description" "$MODELS_FILE")
    local step_count
    step_count=$(jq -r ".pipelines[\"$pipeline_name\"].steps | length" "$MODELS_FILE")
    # Optional pipeline-level temperature override
    local pipe_temp
    pipe_temp=$(jq -r ".pipelines[\"$pipeline_name\"].temperature // empty" "$MODELS_FILE")

    echo -e "${MAGENTA}🔄 Pipeline: ${pipeline_name} (${step_count} steps)${NC}"
    echo -e "${CYAN}   ${pipe_desc}${NC}"
    echo ""

    local context="$prompt"
    for i in $(seq 0 $((step_count - 1))); do
        local step_role step_action
        step_role=$(jq -r ".pipelines[\"$pipeline_name\"].steps[$i].role" "$MODELS_FILE")
        step_action=$(jq -r ".pipelines[\"$pipeline_name\"].steps[$i].action" "$MODELS_FILE")

        echo -e "${CYAN}── Step $((i + 1))/${step_count}: [${step_role}] ${step_action} ──${NC}"

        local system_prompt
        system_prompt=$(jq -r ".roles[\"$step_role\"].system_prompt" "$MODELS_FILE")

        # Pick best available provider for the role
        local provider=""
        for p in $(jq -r ".roles[\"$step_role\"].preferred_providers[]" "$MODELS_FILE"); do
            local env_key env_key_fallback
            env_key=$(jq -r ".providers[\"$p\"].env_key" "$MODELS_FILE")
            env_key_fallback=$(jq -r ".providers[\"$p\"].env_key_fallback // \"\"" "$MODELS_FILE")
            if [ -n "${!env_key:-}" ] || { [ -n "$env_key_fallback" ] && [ -n "${!env_key_fallback:-}" ]; }; then
                provider="$p"
                break
            fi
        done
        if [ -z "$provider" ]; then
            provider=$(get_available_providers | awk '{print $1}')
        fi

        if [ -z "$provider" ]; then
            echo -e "${RED}Error: No provider available for role '${step_role}'${NC}"
            return 1
        fi

        local pname
        pname=$(jq -r ".providers[\"$provider\"].name" "$MODELS_FILE")
        echo -e "  ${BLUE}Provider: ${pname}${NC}"

        local step_prompt="${step_action}

Context from previous steps:
${context}

Original request: ${prompt}"

        local result
        result=$(query_provider "$provider" "$step_prompt" "$system_prompt" "$pipe_temp")
        echo "$result"
        echo ""

        # Feed result forward as context for the next step
        context="${context}

--- Step $((i + 1)) [${step_role}] output ---
${result}"
    done

    echo -e "${GREEN}✅ Pipeline '${pipeline_name}' complete${NC}"
}

## ─── List roles and pipelines ───────────────────────────────────────────────

list_roles() {
    echo -e "${BLUE}🎭 Available Roles:${NC}"
    echo ""
    jq -r '.roles | to_entries[] | "  \(.key) — \(.value.description)\n    Preferred: \(.value.preferred_providers | join(", "))"' "$MODELS_FILE"
    echo ""
}

list_pipelines() {
    echo -e "${BLUE}🔄 Available Pipelines:${NC}"
    echo ""
    jq -r '.pipelines | to_entries[] | "  \(.key) — \(.value.description)\n    Steps: \([.value.steps[].role] | join(" → "))"' "$MODELS_FILE"
    echo ""
}

## ─── Command dispatcher ────────────────────────────────────────────────────

case "${1:-}" in
    xai|grok)
        shift
        query_xai "$*"
        ;;
    kimi|moonshot)
        shift
        query_kimi "$*"
        ;;
    --kimi)
        shift
        echo -e "${BLUE}🌙 Kimi assistant (kimi-pro)...${NC}"
        echo ""
        KIMI_DEFAULT=true cmd_pipeline "kimi-assistant" "$*"
        ;;
    --kimi-swarm)
        shift
        echo -e "${MAGENTA}🐝 Kimi swarm (kimi-pro)...${NC}"
        echo ""
        KIMI_DEFAULT=true cmd_pipeline "kimi-swarm" "$*"
        ;;
    openai|gpt)
        shift
        query_openai "$*"
        ;;
    anthropic|claude)
        shift
        query_anthropic "$*"
        ;;
    chain)
        shift
        cmd_chain "$*"
        ;;
    consensus)
        shift
        cmd_consensus "$*"
        ;;
    delegate)
        shift
        cmd_delegate "$@"
        ;;
    pipeline)
        shift
        cmd_pipeline "$@"
        ;;
    test)
        test_apis
        ;;
    models)
        list_models
        ;;
    roles)
        list_roles
        ;;
    pipelines)
        list_pipelines
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
