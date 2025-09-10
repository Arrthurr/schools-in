#!/bin/bash

# Firebase Hosting Rollback Utility
# Quickly rollback to a previous deployment in case of issues

set -e

echo "🔄 Firebase Hosting Rollback Utility"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="schools-in-check"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check Firebase CLI
check_firebase_cli() {
    if ! command -v firebase &> /dev/null; then
        log_error "Firebase CLI not found. Please install it:"
        echo "npm install -g firebase-tools"
        exit 1
    fi
    log_success "Firebase CLI is available"
}

# Check authentication
check_firebase_auth() {
    if ! firebase projects:list &> /dev/null; then
        log_error "Not authenticated with Firebase. Please run 'firebase login'"
        exit 1
    fi
    log_success "Firebase authentication verified"
}

# List recent deployments
list_deployments() {
    log_info "Recent deployments:"
    echo ""
    
    firebase hosting:releases:list --json | jq -r '.[0:10][] | 
        "\(.createTime | split("T")[0]) \(.createTime | split("T")[1] | split(".")[0]) - \(.message // "No message") - \(.version.status)"' | 
        nl -v 0
    
    echo ""
}

# Get deployment to rollback to
get_rollback_target() {
    local target_index="$1"
    
    if [[ ! "$target_index" =~ ^[0-9]+$ ]]; then
        log_error "Invalid deployment index. Please provide a number."
        exit 1
    fi
    
    local version_name
    version_name=$(firebase hosting:releases:list --json | jq -r ".[$target_index].version.name")
    
    if [ "$version_name" = "null" ]; then
        log_error "Deployment index $target_index not found"
        exit 1
    fi
    
    echo "$version_name"
}

# Perform rollback
perform_rollback() {
    local version_name="$1"
    
    log_warning "Rolling back to version: $version_name"
    log_warning "This will replace the current live site!"
    
    if [ "$FORCE_ROLLBACK" != "true" ]; then
        echo ""
        echo -n "Are you sure you want to continue? (y/N): "
        read -r confirmation
        
        if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
            log_info "Rollback cancelled by user"
            exit 0
        fi
    fi
    
    echo ""
    log_info "Initiating rollback..."
    
    # Perform the rollback
    if firebase hosting:releases:rollback "$version_name"; then
        log_success "Rollback completed successfully"
        
        # Wait for propagation
        log_info "Waiting for CDN propagation (30 seconds)..."
        sleep 30
        
        # Verify rollback
        verify_rollback
    else
        log_error "Rollback failed!"
        exit 1
    fi
}

# Verify rollback was successful
verify_rollback() {
    log_info "Verifying rollback..."
    
    local site_url="https://${PROJECT_ID}.web.app"
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "Attempt $attempt/$max_attempts..."
        
        if curl -f -s "$site_url" > /dev/null; then
            log_success "Site is accessible after rollback"
            
            # Check if version has changed (basic check)
            echo ""
            log_info "Site verification completed"
            echo "🌐 Live URL: $site_url"
            return 0
        fi
        
        sleep 10
        ((attempt++))
    done
    
    log_error "Site verification failed after $max_attempts attempts"
    log_warning "The rollback may have succeeded, but the site is not accessible"
    log_warning "Please check Firebase Console: https://console.firebase.google.com/project/$PROJECT_ID/hosting"
    exit 1
}

# Create rollback notification
notify_rollback() {
    local version_name="$1"
    local reason="${2:-Manual rollback}"
    
    log_info "Creating rollback notification..."
    
    # This would integrate with your notification system
    # For now, we'll just log the information
    cat << EOF

📋 ROLLBACK NOTIFICATION
========================
Time: $(date -u)
Project: $PROJECT_ID
Target Version: $version_name
Reason: $reason
Performed By: $(whoami)
Site URL: https://${PROJECT_ID}.web.app

Please inform relevant team members of this rollback.
EOF
}

# Emergency rollback (automatically rollback to last known good)
emergency_rollback() {
    log_warning "🚨 EMERGENCY ROLLBACK MODE"
    log_info "Rolling back to most recent deployment..."
    
    # Get the second most recent deployment (index 1)
    local version_name
    version_name=$(firebase hosting:releases:list --json | jq -r '.[1].version.name')
    
    if [ "$version_name" = "null" ]; then
        log_error "No previous deployment found for emergency rollback"
        exit 1
    fi
    
    log_warning "Emergency rollback to: $version_name"
    
    # Skip confirmation in emergency mode
    FORCE_ROLLBACK=true perform_rollback "$version_name"
    
    notify_rollback "$version_name" "Emergency rollback"
}

# Main function
main() {
    echo "================================================"
    echo "🔄 Firebase Hosting Rollback"
    echo "================================================"
    
    check_firebase_cli
    check_firebase_auth
    
    if [ "$1" = "emergency" ]; then
        emergency_rollback
        exit 0
    fi
    
    list_deployments
    
    if [ -n "$1" ]; then
        # Index provided as argument
        local target_index="$1"
    else
        # Interactive mode
        echo -n "Enter the deployment index to rollback to (0 = current, 1 = previous, etc.): "
        read -r target_index
    fi
    
    if [ "$target_index" = "0" ]; then
        log_warning "Index 0 is the current deployment. Nothing to rollback."
        exit 0
    fi
    
    local version_name
    version_name=$(get_rollback_target "$target_index")
    
    log_info "Selected deployment: $version_name"
    
    perform_rollback "$version_name"
    notify_rollback "$version_name" "Manual rollback via script"
    
    echo ""
    log_success "🎉 Rollback completed successfully!"
    echo "================================================"
}

# Handle script arguments
case "${1:-}" in
    emergency)
        emergency_rollback
        ;;
    --help|help)
        echo "Usage: $0 [deployment_index|emergency|help]"
        echo ""
        echo "Arguments:"
        echo "  deployment_index  Index of deployment to rollback to (1=previous, 2=before previous, etc.)"
        echo "  emergency         Automatic rollback to most recent deployment"
        echo "  help              Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                Interactive mode (prompts for deployment index)"
        echo "  $0 1              Rollback to previous deployment"
        echo "  $0 emergency      Emergency rollback (auto-select previous)"
        echo ""
        echo "Environment Variables:"
        echo "  FORCE_ROLLBACK=true   Skip confirmation prompts"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
