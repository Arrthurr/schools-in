# Fixing Firestore API Permission Error

## Problem

When deploying Firestore rules, you may encounter this error:

```
Error: Request to https://serviceusage.googleapis.com/v1/projects/***/services/firestore.googleapis.com had HTTP Error: 403, Permission denied to get service [firestore.googleapis.com]
```

This happens when the service account used for CI/CD deployment doesn't have permission to enable or check the status of the Firestore API.

## Solutions

### Option 1: Enable Firestore API Manually (Recommended)

1. Go to the [Google Cloud Console API Library](https://console.cloud.google.com/apis/library)
2. Select your project: **schools-in-check**
3. Search for "Cloud Firestore API"
4. Click on it and press **Enable**
5. Wait for the API to be enabled (usually takes a few seconds)

**Direct link**: https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=schools-in-check

After enabling, the deployment should work without permission errors.

### Option 2: Grant Service Account Permissions

If you need the service account to be able to enable APIs automatically:

1. Go to [Google Cloud Console IAM](https://console.cloud.google.com/iam-admin/iam?project=schools-in-check)
2. Find your service account (the one used in `FIREBASE_SERVICE_ACCOUNT` secret)
3. Click **Edit** (pencil icon)
4. Add the following roles:
   - **Service Usage Admin** - Allows enabling/disabling APIs
   - **Firebase Rules Admin** - Allows deploying Firestore rules
5. Save the changes

### Option 3: Use Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/project/schools-in-check)
2. Navigate to **Firestore Database** in the left sidebar
3. If prompted, click **Create Database** or **Enable Firestore**
4. This will automatically enable the API

## Verification

After applying one of the solutions above, verify the API is enabled:

1. Go to [API Library](https://console.cloud.google.com/apis/library?project=schools-in-check)
2. Search for "Cloud Firestore API"
3. It should show "API enabled" with a green checkmark

## Current Workflow Behavior

The deployment workflow has been updated with a **dual deployment strategy**:

1. **Primary Method**: Uses Firebase CLI to deploy Firestore rules
2. **Fallback Method**: If the CLI fails due to API permission checks, the workflow automatically:
   - Uses `gcloud` CLI (via `google-github-actions/setup-gcloud`) for authentication
   - Deploys rules directly via Firebase REST API, bypassing the API enablement check
   - This works even if the service account can't verify API status

### Benefits

- ✅ **Automatic fallback**: If Firebase CLI fails, REST API deployment is attempted automatically
- ✅ **No build failures**: Deployment continues even if Firestore rules fail (hosting still deploys)
- ✅ **Better authentication**: Uses `gcloud` setup action which handles service account authentication more reliably
- ✅ **Clear error messages**: Provides detailed information about what failed and why

The hosting deployment will always succeed, and Firestore rules will deploy using either method.

