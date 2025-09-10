#!/bin/bash

# Production deployment script for Schools-In Firebase project
# This script handles the complete production deployment process

set -e  # Exit on any error

echo "🚀 Starting Schools-In Production Deployment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="schools-in-check"
BUILD_DIR="out"

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

# Check if Firebase CLI is installed
check_firebase_cli() {
    if ! command -v firebase &> /dev/null; then
        log_error "Firebase CLI not found. Please install it:"
        echo "npm install -g firebase-tools"
        exit 1
    fi
    log_success "Firebase CLI is installed"
}

# Check if user is logged in to Firebase
check_firebase_auth() {
    if ! firebase list --token "$FIREBASE_TOKEN" &> /dev/null && ! firebase list &> /dev/null; then
        log_error "Not authenticated with Firebase. Please run 'firebase login'"
        exit 1
    fi
    log_success "Firebase authentication verified"
}

# Validate environment variables
check_environment() {
    log_info "Validating environment configuration..."
    
    if [ ! -f ".env.production" ]; then
        log_error "Production environment file not found (.env.production)"
        exit 1
    fi

    # Check required environment variables
    required_vars=(
        "NEXT_PUBLIC_FIREBASE_API_KEY"
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
        "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
        "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
        "NEXT_PUBLIC_FIREBASE_APP_ID"
    )

    source .env.production

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done

    log_success "Environment configuration validated"
}

# Run tests
run_tests() {
    log_info "Running test suite..."
    
    # Unit tests
    if ! npm test -- --watchAll=false --coverage; then
        log_error "Unit tests failed"
        exit 1
    fi
    
    log_success "All tests passed"
}

# Validate Firebase rules
validate_rules() {
    log_info "Validating Firebase security rules..."
    
    # Validate Firestore rules
    if ! firebase firestore:rules:validate firestore.rules; then
        log_error "Firestore rules validation failed"
        exit 1
    fi
    
    # Validate Storage rules  
    if ! firebase storage:rules:validate storage.rules; then
        log_error "Storage rules validation failed"
        exit 1
    fi
    
    log_success "Firebase rules validation passed"
}

# Build the application
build_app() {
    log_info "Building production application..."
    
    # Clean previous build
    rm -rf out .next
    
    # Set production environment
    export NODE_ENV=production
    
    # Build with production environment
    if ! npm run build; then
        log_error "Production build failed"
        exit 1
    fi
    
    if [ ! -d "$BUILD_DIR" ]; then
        log_error "Build directory ($BUILD_DIR) not found after build"
        exit 1
    fi
    
    log_success "Production build completed"
}

# Deploy to Firebase
deploy_firebase() {
    log_info "Deploying to Firebase..."
    
    # Deploy Firestore rules and indexes
    if ! firebase deploy --only firestore; then
        log_error "Firestore deployment failed"
        exit 1
    fi
    
    # Deploy Storage rules
    if ! firebase deploy --only storage; then
        log_error "Storage deployment failed"
        exit 1
    fi
    
    # Deploy hosting
    if ! firebase deploy --only hosting; then
        log_error "Hosting deployment failed"
        exit 1
    fi
    
    log_success "Firebase deployment completed"
}

# Run post-deployment verification
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check if site is accessible
    SITE_URL="https://${PROJECT_ID}.web.app"
    
    if command -v curl &> /dev/null; then
        if curl -f -s "$SITE_URL" > /dev/null; then
            log_success "Site is accessible at $SITE_URL"
        else
            log_warning "Site accessibility check failed"
        fi
    else
        log_warning "curl not available, skipping accessibility check"
    fi
    
    log_info "Deployment URL: $SITE_URL"
}

# Main deployment process
main() {
    echo "================================================"
    echo "🏫 Schools-In Production Deployment"
    echo "================================================"
    
    # Pre-flight checks
    log_info "Running pre-flight checks..."
    check_firebase_cli
    check_firebase_auth
    check_environment
    
    # Validation and testing
    log_info "Running validation and tests..."
    validate_rules
    run_tests
    
    # Build and deploy
    log_info "Building and deploying..."
    build_app
    deploy_firebase
    
    # Verification
    verify_deployment
    
    echo ""
    echo "================================================"
    log_success "🎉 Production deployment completed successfully!"
    echo "================================================"
    echo ""
    log_info "Next steps:"
    echo "1. Monitor Firebase Console for any issues"
    echo "2. Test key functionality on the live site"
    echo "3. Monitor performance metrics"
    echo "4. Check error reporting in Sentry"
    echo ""
}

# Handle script arguments
case "${1:-}" in
    --skip-tests)
        log_warning "Skipping tests as requested"
        skip_tests=true
        ;;
    --dry-run)
        log_info "Dry run mode - no actual deployment"
        dry_run=true
        ;;
    --help)
        echo "Usage: $0 [--skip-tests] [--dry-run] [--help]"
        echo ""
        echo "Options:"
        echo "  --skip-tests  Skip running tests before deployment"
        echo "  --dry-run     Validate and build but don't deploy"
        echo "  --help        Show this help message"
        exit 0
        ;;
esac

# Run main deployment process
if [ "${dry_run}" = true ]; then
    log_info "Dry run mode - validating configuration..."
    check_firebase_cli
    check_firebase_auth
    check_environment
    validate_rules
    if [ "${skip_tests}" != true ]; then
        run_tests
    fi
    build_app
    log_success "Dry run completed successfully"
else
    main
fi
