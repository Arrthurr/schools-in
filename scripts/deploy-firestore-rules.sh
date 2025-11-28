#!/bin/bash
# Deploy Firestore rules using Firebase REST API
# This bypasses the Firebase CLI's API enablement check

set -e

PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-schools-in-check}"
RULES_FILE="${1:-firestore.rules}"

if [ ! -f "$RULES_FILE" ]; then
  echo "Error: Rules file not found: $RULES_FILE"
  exit 1
fi

if [ -z "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
  echo "Error: GOOGLE_APPLICATION_CREDENTIALS not set"
  exit 1
fi

echo "Deploying Firestore rules for project: $PROJECT_ID"

# Get access token using gcloud or service account
if command -v gcloud &> /dev/null; then
  # Use gcloud to get access token
  ACCESS_TOKEN=$(gcloud auth print-access-token --key-file="$GOOGLE_APPLICATION_CREDENTIALS" 2>/dev/null || \
    gcloud auth activate-service-account --key-file="$GOOGLE_APPLICATION_CREDENTIALS" --quiet && \
    gcloud auth print-access-token)
else
  # Use service account JSON to get token (requires jq and openssl)
  if command -v jq &> /dev/null && command -v openssl &> /dev/null; then
    echo "Using service account JSON to generate token..."
    # This is more complex - for now, require gcloud
    echo "Error: gcloud CLI is required for token generation"
    exit 1
  else
    echo "Error: gcloud CLI is required"
    exit 1
  fi
fi

# Read rules file
RULES_CONTENT=$(cat "$RULES_FILE")

# Create ruleset using Firebase Rules API
echo "Creating ruleset..."

# First, create a ruleset
RULESET_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"source\": {
      \"files\": [{
        \"name\": \"firestore.rules\",
        \"content\": $(echo "$RULES_CONTENT" | jq -Rs .)
      }]
    }
  }" \
  "https://firebaserules.googleapis.com/v1/projects/$PROJECT_ID/rulesets")

RULESET_NAME=$(echo "$RULESET_RESPONSE" | jq -r '.name // empty')

if [ -z "$RULESET_NAME" ] || [ "$RULESET_NAME" == "null" ]; then
  echo "Error creating ruleset:"
  echo "$RULESET_RESPONSE" | jq '.'
  exit 1
fi

echo "Ruleset created: $RULESET_NAME"

# Release the ruleset
echo "Releasing ruleset..."

RELEASE_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"rulesetName\": \"$RULESET_NAME\",
    \"release\": {
      \"name\": \"projects/$PROJECT_ID/releases/cloud.firestore\"
    }
  }" \
  "https://firebaserules.googleapis.com/v1/projects/$PROJECT_ID/releases")

if echo "$RELEASE_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo "Error releasing ruleset:"
  echo "$RELEASE_RESPONSE" | jq '.'
  exit 1
fi

echo "✅ Firestore rules deployed successfully!"
echo "Release: $(echo "$RELEASE_RESPONSE" | jq -r '.name // "N/A"')"

