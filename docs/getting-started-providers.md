# Getting Started Guide for Service Providers

Welcome to the **DMDL CampusAccess** beta testing program! This guide will help you get started with the application and understand all the features available to you as a service provider.

## What is DMDL CampusAccess?

DMDL CampusAccess is a location-based attendance tracking application designed specifically for service providers who work at multiple school locations. The app uses advanced geofencing technology to automatically track when you arrive at and leave assigned schools, making it easy to log your time without manual check-ins.

### Key Benefits

- **Automatic Check-In/Out**: The app detects when you enter or leave a school's geofence and can automatically log your sessions
- **Offline Support**: Continue working even without internet connection - your check-ins will sync when you're back online
- **Real-Time Tracking**: See your current session, hours worked, and location assignments at a glance
- **Mobile-Optimized**: Designed to work seamlessly on your phone while you're on the go

---

## Getting Started: Logging In

### Step 1: Access the Application

Visit the application at: **https://schools-in-check.web.app**

### Step 2: Sign In with Microsoft

1. On the login page, click the **"Sign in with Microsoft"** button
2. You'll be redirected to Microsoft's login page
3. Enter your work or school Microsoft account credentials
4. Grant the requested permissions when prompted
5. You'll be automatically redirected to your provider dashboard

> **Note**: You must use a Microsoft account that has been authorized by your administrator. If you see an "Account not authorized" error, please contact your administrator to ensure your account has been added to the system.

### What Happens on First Login?

- Your account is automatically assigned the "provider" role
- You'll be directed to your personal dashboard
- Your assigned school locations will be loaded
- The app will request permission to access your device location

---

## Your Provider Dashboard

After logging in, you'll see your provider dashboard with several key sections:

### Current Session Card

This is the most important section, especially on mobile devices. It shows:

- **Active Session Status**: Whether you're currently checked in at a location
- **Session Timer**: Real-time display of how long you've been at the current location
- **End Session Button**: Tap this to manually check out when you're done

> **Tip**: On mobile, the End Session button is full-width and easy to tap, making it simple to check out quickly.

### Assigned Schools Card

This section displays all the schools you've been assigned to:

- **School Names**: List of your assigned locations
- **Distance Calculations**: Real-time distance from your current location to each school
- **Get Location Button**: Refreshes your current GPS position to update distances
- **Navigation**: Tap on a school to see details and get directions via Google Maps

### Your Metrics

View your performance at a glance:

- **Total Sessions**: Number of check-ins you've completed
- **Hours Worked**: Total time logged across all locations
- **Active Locations**: Number of schools you're currently assigned to

### Recent Activity Feed

See your recent check-in and check-out history:

- Session timestamps
- Location names
- Duration of each session
- Check-in/out methods used

---

## How Auto Check-In/Check-Out Works

One of the most powerful features of DMDL CampusAccess is automatic geofencing. Here's how it works:

### The Geofencing System

The app uses your device's GPS to detect when you enter or leave a school's designated area (typically a 100-200 meter radius). When you cross this boundary, the app can automatically check you in or out.

### Adaptive Detection Strategy

The app automatically selects the best detection method based on your device and browser:

1. **Chrome/Android**: Uses background sync for the most reliable detection, even when the app isn't open
2. **Safari (iOS)**: Uses foreground detection with screen wake lock to prevent your device from sleeping
3. **Firefox**: Uses visibility-based polling when the app is open
4. **Fallback**: Manual check-in with optional notification reminders

### How It Works in Practice

1. **Entering a School**: When you arrive within the geofence radius, you'll see a notification
2. **Countdown Timer**: A countdown (typically 30 seconds) gives you time to cancel if needed
3. **Automatic Check-In**: If you don't cancel, you're automatically checked in
4. **Leaving a School**: The same process happens when you leave the geofence
5. **Visual Feedback**: Toast notifications keep you informed of all actions

### Controlling Auto Check-In/Out

- **Enable/Disable**: You can turn auto-geofencing on or off in your settings
- **Manual Override**: You can always check in or out manually using the dashboard buttons
- **Cancel During Countdown**: If you see the countdown and don't want to auto check-in/out, simply tap "Cancel"

> **Important**: Auto check-in/out requires location permissions and works best when location services are always enabled for the app.

---

## Enabling Device Location

For the app to work properly, you need to grant location permissions:

### Granting Location Permissions

#### On iOS Safari:

1. When prompted, tap **"Allow"** for location access
2. Choose **"Allow While Using App"** or **"Always Allow"** for best results
3. If you missed the prompt, go to Settings > Safari > Location and enable it
4. You may also need to enable Location Services in Settings > Privacy > Location Services

#### On Android Chrome:

1. When prompted, tap **"Allow"** for location access
2. Choose **"Allow all the time"** for background detection
3. If you missed the prompt, go to Chrome Settings > Site Settings > Location
4. Find schools-in-check.web.app and set to "Allow"

#### On Desktop Browsers:

1. Click **"Allow"** when the browser asks for location permission
2. If blocked, click the lock icon in the address bar
3. Find Location permissions and set to "Allow"

### GPS Accuracy Tips

For the most accurate check-ins:

- **Outdoor is Best**: GPS works best outdoors with clear sky visibility
- **Wait for Accuracy**: The app may wait for better GPS accuracy before allowing check-in
- **Poor Signal**: If indoors, try moving near a window
- **Battery Saver**: Disable battery saver mode, as it can reduce GPS accuracy

> **Battery Considerations**: Location tracking does use battery, but the app is optimized to minimize impact. For best results, keep your device charged or bring a portable charger.

---

## The "Refresh Schools" Button

Sometimes you may need to manually refresh your school assignments:

### When to Use Refresh

- After your administrator assigns you to new schools
- If your school list appears outdated
- When distance calculations seem incorrect
- After being removed from a school assignment

### How to Refresh

1. Look for the **"Get Location"** or refresh button in the Assigned Schools section
2. Tap the button
3. The app will fetch the latest assignments from the server
4. Location data and distances will be updated

> **Note**: The app automatically caches your school data for offline use, so refreshing ensures you have the most up-to-date information.

---

## Working Offline: Sync Features

DMDL CampusAccess is designed to work even when you don't have internet connection:

### What Works Offline

- **View Dashboard**: Access your cached school list and session history
- **Check-In/Out**: Perform check-ins and check-outs (they'll be queued)
- **View Metrics**: See your previously loaded statistics
- **Navigation**: View school details and cached information

### Offline Indicators

When you're offline, you'll see:

- An **offline status indicator** at the top of the app
- A banner message: "Working offline - changes will sync when connected"
- Queue status showing how many actions are pending

### Action Queueing

When you check in or out while offline:

1. The action is saved locally on your device
2. A queue indicator shows pending actions
3. Actions persist even if you close the browser
4. When connection is restored, actions automatically sync

### Automatic Sync

When you reconnect to the internet:

1. The app detects the connection automatically
2. Queued actions sync in priority order (check-outs first, then check-ins)
3. You'll see sync progress notifications
4. Success or error messages confirm the sync status

### Installing as a Progressive Web App (PWA)

For the best offline experience, you can install the app on your device:

#### On iOS:

1. Open the app in Safari
2. Tap the Share button
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm
5. The app icon will appear on your home screen

#### On Android:

1. Open the app in Chrome
2. Tap the menu (three dots)
3. Tap "Add to Home screen" or "Install app"
4. Confirm the installation
5. The app will appear in your app drawer

#### On Desktop:

1. Look for the install icon in the address bar
2. Click it and confirm installation
3. The app will open in its own window

**Benefits of Installing:**

- Faster loading times
- Works more reliably offline
- Appears like a native app
- Can receive notifications (if enabled)

---

## Best Practices for Beta Testing

As a beta tester, your feedback is invaluable. Here are some tips:

### General Usage

- **Keep Location Services Enabled**: For the best experience, allow location access at all times
- **Test Different Scenarios**: Try checking in/out at different times and locations
- **Try Offline Mode**: Intentionally go offline to test the sync features
- **Use Different Devices**: Test on both mobile and desktop if possible
- **Try Different Browsers**: Chrome, Safari, Firefox, and Edge all work differently

### What to Pay Attention To

- **GPS Accuracy**: Note any issues with location detection
- **Auto Check-In Timing**: Is the countdown timing appropriate?
- **Battery Usage**: Does the app drain your battery excessively?
- **Offline Sync**: Do your offline actions sync correctly when reconnected?
- **User Interface**: Is everything easy to understand and use?
- **Performance**: Does the app feel fast and responsive?

---

## Troubleshooting Common Issues

### Location Permission Denied

**Problem**: The app says it can't access your location.

**Solution**:

1. Check your browser's location settings
2. Ensure Location Services are enabled on your device
3. Try refreshing the page and granting permission again
4. On iOS, check Settings > Privacy > Location Services > Safari

### GPS Timeout or Poor Accuracy

**Problem**: Check-in button is disabled or says "Waiting for accurate location."

**Solution**:

1. Move outdoors or near a window
2. Wait a few moments for GPS to acquire satellites
3. Ensure you're not in airplane mode
4. Restart location services on your device
5. Try the "Get Location" button to refresh

### Offline Sync Failures

**Problem**: Actions aren't syncing when you reconnect.

**Solution**:

1. Check that you have a stable internet connection
2. Try manually refreshing the page
3. Look for error messages in the queue status
4. If persistent, try logging out and back in
5. Contact support if the issue continues

### Session Not Ending Automatically

**Problem**: You left a school but weren't automatically checked out.

**Solution**:

1. Ensure auto-geofencing is enabled in settings
2. Check that location permissions are set to "Always Allow"
3. Verify you actually left the geofence radius (may be 100-200m from school)
4. Manually check out using the End Session button
5. Report the issue with details about when and where it occurred

### Distance Calculations Incorrect

**Problem**: The app shows wrong distances to schools.

**Solution**:

1. Tap the "Get Location" button to refresh your position
2. Wait for GPS accuracy to improve
3. Try the "Refresh Schools" button to update school locations
4. Ensure location permissions are granted
5. Report if school coordinates seem wrong

### App Not Responding

**Problem**: The app is frozen or very slow.

**Solution**:

1. Refresh the page (pull down on mobile)
2. Clear your browser cache
3. Close other tabs/apps to free up memory
4. Try a different browser
5. Restart your device if necessary
6. Check if your internet connection is stable

---

## Providing Feedback

Your feedback helps us improve the app! Here's how to report issues:

### What to Report

- **Bugs**: Anything that doesn't work as expected
- **GPS Issues**: Problems with location detection or accuracy
- **Sync Problems**: Offline actions not syncing properly
- **UI/UX Feedback**: Confusing interfaces or hard-to-use features
- **Performance Issues**: Slow loading, freezing, or crashes
- **Feature Requests**: Ideas for improvements

### How to Describe Issues

When reporting a problem, please include:

1. **What happened**: Describe the issue clearly
2. **What you expected**: What should have happened instead
3. **Steps to reproduce**: How can we recreate the issue?
4. **Device/Browser**: What device and browser were you using?
5. **Screenshots**: If possible, include screenshots
6. **Time/Location**: When and where did it happen?

### Example Good Bug Report

> "When I tried to check in at Lincoln Elementary at 9:15 AM on my iPhone 13 using Safari, the check-in button was grayed out even though I was standing right in front of the school. The app said 'Waiting for accurate location' for over 5 minutes. I have location permissions set to 'Always Allow'. Screenshot attached."

### Contact Information

Please send your feedback to: [Your contact email or feedback system]

---

## Quick Reference

### Common Actions

- **Check In**: Tap school name, then tap "Check In" button
- **Check Out**: Tap "End Session" button on dashboard
- **Refresh Schools**: Tap "Get Location" or refresh button
- **View History**: Scroll to "Recent Activity" section
- **Get Directions**: Tap school name, then "Get Directions"

### Keyboard Shortcuts (Desktop)

- **Refresh Page**: Ctrl+R (Windows) or Cmd+R (Mac)
- **Open Settings**: Look for settings icon in navigation

### Support Resources

- **Production URL**: https://schools-in-check.web.app
- **This Guide**: https://schools-in-check.web.app/getting-started-providers.md
- **Technical Support**: [Your support contact]

---

## Thank You!

Thank you for participating in the DMDL CampusAccess beta testing program. Your feedback and testing help us create a better product for all service providers. If you have any questions or concerns, don't hesitate to reach out.

Happy testing!

---

_Last Updated: January 2026_  
_Version: 1.0.0 Beta_
