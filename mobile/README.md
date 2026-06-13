# Ultra Training — Mobile App

React Native / Expo mobile companion to the Ultra Training web app. Uses the same Firebase project and Firestore database, so data is shared across both platforms in real time.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Prerequisites](#prerequisites)
3. [Firebase Setup](#firebase-setup)
4. [Google Cloud & OAuth Setup](#google-cloud--oauth-setup)
5. [Local Development Setup](#local-development-setup)
6. [Configuring Client IDs in the App](#configuring-client-ids-in-the-app)
7. [Running the App](#running-the-app)
8. [Building for Production](#building-for-production)
9. [Rebuilding After Code Changes](#rebuilding-after-code-changes)
10. [Updating the App](#updating-the-app)
11. [Project Structure](#project-structure)
12. [Firestore Data Model](#firestore-data-model)
13. [Troubleshooting](#troubleshooting)

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Expo (managed workflow) | ~56.0.9 |
| Language | TypeScript | ~6.0.3 |
| UI | React Native | 0.85.3 |
| React | React | 19.2.3 |
| Navigation | React Navigation — Bottom Tabs | ^7 |
| Auth | Firebase Auth + expo-auth-session | ^12 / ^56 |
| Database | Cloud Firestore | ^12 |
| OAuth flow | expo-auth-session (Google provider) | ^56 |
| Browser redirect | expo-web-browser | ^56 |
| Local persistence | @react-native-async-storage/async-storage | ^3 |
| Gradients | expo-linear-gradient | ^56 |

The app uses **Expo's managed workflow** and is distributed as a native build via **EAS Build** (Expo Application Services). Google Sign-in requires a proper native build — it does not work in Expo Go. You do not need Xcode or Android Studio to build or run the app; EAS compiles everything in the cloud.

> **Important:** This project is pinned to Expo v56. Always refer to the versioned docs at https://docs.expo.dev/versions/v56.0.0/ rather than the latest Expo docs, as APIs change between major versions.

---

## Prerequisites

- **Node.js** 18 or later (`node --version`)
- **npm** 9 or later (`npm --version`)
- **Expo CLI** — install globally once: `npm install -g expo-cli`
- **EAS CLI** — install globally once: `npm install -g eas-cli`
- A physical **iOS or Android device** with the app installed as a native build (see [Building for Production](#building-for-production))
- A **Google account** to sign in to Firebase Console
- A **Firebase project** (see [Firebase Setup](#firebase-setup) below)

> **Note on Expo Go:** This app does **not** use Expo Go. Google Sign-in requires native OAuth client IDs that are not compatible with the Expo Go sandbox. All testing and distribution is done through native EAS builds.

---

## Firebase Setup

The mobile app shares a Firebase project with the web app. If the web app is already set up, the Firestore database and Authentication are already configured — you just need to add a mobile client and retrieve the OAuth credentials.

### 1. Create or open the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. Select the existing **mwrazej-training** project, or create a new project if starting fresh.

### 2. Enable Firebase Authentication

1. In the left sidebar, click **Authentication**.
2. Click **Get started** if it hasn't been enabled yet.
3. Go to the **Sign-in method** tab.
4. Click **Google** and toggle it **Enabled**.
5. Set a **Project support email** (your Gmail address).
6. Click **Save**.

### 3. Enable Cloud Firestore

1. In the left sidebar, click **Firestore Database**.
2. Click **Create database**.
3. Choose **Production mode** (you will set rules next).
4. Select a region close to your users (e.g., `us-central` or `europe-west`).
5. Click **Enable**.

#### Firestore Security Rules

Replace the default rules with these so only authenticated users can read/write their own data:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Paste these in **Firestore Database → Rules**, then click **Publish**.

### 4. Register the mobile app in Firebase

Firebase needs to know about each platform client separately.

#### Android

1. In Firebase Console, open **Project settings** (gear icon, top left).
2. Under **Your apps**, click **Add app → Android**.
3. Enter the Android package name. The default for this project is `com.ultratraining.app` — if you haven't set a custom one in `app.json`, use that placeholder or update `app.json` first.
4. (Optional) Enter a nickname like "Ultra Training Android".
5. Click **Register app**.
6. Download `google-services.json`. You will need this for EAS builds — see [Building for Production](#building-for-production).
7. Skip the "Add Firebase SDK" steps — the SDK is already in the project.

#### iOS

1. Still in **Project settings → Your apps**, click **Add app → iOS**.
2. Enter the iOS bundle ID. Check `app.json` under `expo.ios.bundleIdentifier` — set one there if not already present (e.g., `com.ultratraining.app`).
3. (Optional) Enter a nickname like "Ultra Training iOS".
4. Click **Register app**.
5. Download `GoogleService-Info.plist`. Needed for native builds.
6. Skip the SDK steps.

### 5. Firebase config in the app

The Firebase credentials are already in `src/config/firebase.ts`. If you create a brand-new Firebase project, replace the values there with your project's config:

1. Go to **Project settings → Your apps → Web app** (the web client, not Android/iOS).
2. Under **SDK setup and configuration**, select **Config**.
3. Copy the config object and paste it into `src/config/firebase.ts`.

```ts
// src/config/firebase.ts
const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};
```

These values are safe to commit — they identify the Firebase project but access is controlled by Firestore Security Rules and Auth configuration.

---

## Google Cloud & OAuth Setup

Firebase Authentication uses Google OAuth behind the scenes. To make "Sign in with Google" work on iOS and Android native builds, you need OAuth 2.0 client IDs from Google Cloud Console.

### How the auth flow works

```
User taps "Sign in with Google"
  → expo-auth-session opens a browser tab
  → Google OAuth consent screen
  → Redirect back to the app with an id_token
  → Firebase Auth exchanges the token for a Firebase user session
  → App is authenticated
```

### 1. Open Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Select the project that matches your Firebase project (they share the same GCP project).

### 2. Enable the Google People API (if not already enabled)

1. In the left menu, go to **APIs & Services → Library**.
2. Search for **Google People API**.
3. Click it and click **Enable**.

### 3. Configure the OAuth Consent Screen

This is what users see when they sign in. You only need to do this once.

1. Go to **APIs & Services → OAuth consent screen**.
2. Select **External** (for any Google account to sign in).
3. Fill in:
   - **App name**: Ultra Training
   - **User support email**: your email
   - **Developer contact email**: your email
4. Click **Save and Continue** through the Scopes page (no extra scopes needed beyond the defaults).
5. Add yourself as a **test user** while the app is in testing mode.
6. Click **Save and Continue** then **Back to Dashboard**.

### 4. Create OAuth 2.0 Client IDs

You need three client IDs: one for Android, one for iOS, and one Web client (required by Firebase Auth even when using the mobile SDKs).

Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.

#### Web client ID

- **Application type**: Web application
- **Name**: Ultra Training Web Client
- **Authorized redirect URIs**: Add `https://auth.expo.io/@your-expo-username/ultra-training`
  - Replace `your-expo-username` with your actual Expo account username (run `expo whoami` to check).
  - Also add `https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler`
- Click **Create**.
- Copy the **Client ID** — this is your `GOOGLE_WEB_CLIENT_ID`.

#### Android client ID

- **Application type**: Android
- **Name**: Ultra Training Android
- **Package name**: must match what you put in Firebase (e.g., `com.ultratraining.app`)
- **SHA-1 certificate fingerprint**: Get this from your EAS build keystore. Run:
  ```bash
  cd mobile
  eas credentials
  ```
  Select Android, then view the keystore to retrieve the SHA-1. For production, use your release keystore's SHA-1.
- Click **Create**.
- Copy the **Client ID** — this is your `GOOGLE_ANDROID_CLIENT_ID`.

#### iOS client ID

- **Application type**: iOS
- **Name**: Ultra Training iOS
- **Bundle ID**: must match what you put in Firebase (e.g., `com.ultratraining.app`)
- Click **Create**.
- Copy the **Client ID** — this is your `GOOGLE_IOS_CLIENT_ID`.

### 5. Verify the Web Client ID in Firebase Auth

Firebase Auth uses the Web Client ID to validate tokens from the mobile OAuth flow:

1. Go back to **Firebase Console → Authentication → Sign-in method → Google**.
2. Expand **Web SDK configuration**.
3. Make sure the **Web client ID** matches the one you just created (or already exists — Firebase may have auto-created one).

---

## Local Development Setup

```bash
# 1. Clone the repo (skip if already cloned)
git clone https://github.com/mclairewrazej-goatgirl/ultra-training-app.git
cd ultra-training-app/mobile

# 2. Install dependencies
npm install

# 3. Configure your Google client IDs (see next section)

# 4. Log in to EAS
eas login

# 5. Start the dev server (connects to an installed native build)
npm start
```

---

## Configuring Client IDs in the App

Open `src/screens/LoginScreen.tsx` and replace the three placeholder values near the top of the file:

```ts
// src/screens/LoginScreen.tsx  (lines 21–23)

const GOOGLE_ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID     = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_WEB_CLIENT_ID     = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
```

Replace each `YOUR_*_CLIENT_ID` string with the actual client IDs you created in Google Cloud Console. The format is always `<numbers>-<hash>.apps.googleusercontent.com`.

All three client IDs are required — the Android and iOS client IDs are used by the native OAuth flow, and the Web client ID is required by Firebase Auth to validate the resulting token.

> Do not commit real client IDs to a public repository. Consider moving them to a `.env` file and loading them via `expo-constants` or a similar approach if your repo is public.

---

## Running the App

The app runs as a native build installed directly on your device. There is no Expo Go involved.

### On a physical device (native build)

1. Build the app with EAS (see [Building for Production](#building-for-production)) and install it on your device.
2. In the `mobile/` directory, run:
   ```bash
   npm start
   ```
3. With the native build open on your device, the app will connect to the local Metro bundler automatically (ensure your phone and computer are on the same network).

### On an Android Emulator

```bash
npm run android
```

Requires Android Studio and an AVD (Android Virtual Device) to be set up.

### On an iOS Simulator (Mac only)

```bash
npm run ios
```

Requires Xcode to be installed.

### In a web browser (limited)

```bash
npm run web
```

The web target is not the primary use case — use the dedicated web app at `mwrazej_training_log.html` for the full web experience.

---

## Building for Production

Production builds are done with **EAS Build** (Expo Application Services), Expo's hosted build service. It compiles the native iOS `.ipa` and Android `.apk`/`.aab` binaries in the cloud — you don't need a Mac for iOS builds.

### 1. Install EAS CLI

```bash
npm install -g eas-cli
eas login
```

### 2. Configure EAS

```bash
cd mobile
eas build:configure
```

This creates an `eas.json` file. A basic config looks like:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

### 3. Set up google-services.json and GoogleService-Info.plist

For production builds, EAS needs the Firebase config files:

```bash
# Upload Android config
eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json

# Upload iOS config
eas secret:create --scope project --name GOOGLE_SERVICE_INFO_PLIST --type file --value ./GoogleService-Info.plist
```

Then reference them in `app.json`:

```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    },
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist"
    }
  }
}
```

### 4. Run the build

```bash
# Android
eas build --platform android

# iOS
eas build --platform ios

# Both at once
eas build --platform all
```

EAS will prompt you for signing credentials (keystore for Android, certificates/provisioning profiles for iOS) and handle them automatically.

### 5. Install the build on your device

After the build completes, EAS provides a QR code and a download link in the terminal and at [expo.dev](https://expo.dev). Scan the QR code with your phone's camera to open the install page, then tap **Install** to load the app onto your device.

### 6. Submit to app stores

```bash
eas submit --platform android
eas submit --platform ios
```

---

## Rebuilding After Code Changes

Use this workflow whenever you make changes to the app — whether through Claude on the web, directly on GitHub, or in your local editor — and need to get those changes onto your phone.

### Step 1 — Pull the latest changes on your computer

Open a terminal, navigate to the project, and pull from the branch you edited:

```bash
cd ultra-training-app/mobile
git pull origin main
```

If you edited a feature branch (e.g., via Claude), replace `main` with that branch name, or merge it first.

### Step 2 — Install any new dependencies

```bash
npm install
```

Always run this after pulling — new packages may have been added.

### Step 3 — Decide what kind of rebuild you need

#### JavaScript/TypeScript changes only (no new native packages)

If you only changed files in `src/`, `assets/`, or `App.tsx`, you can push an **OTA (over-the-air) update** — no new build required, no app store submission:

```bash
eas update --branch production --message "Brief description of what changed"
```

The update will appear on your device the next time you open the app.

#### Changes that require a full native rebuild

You need a new native build if you:

- Added or removed an npm package that contains native code (any `expo-*` library or package with a `android/` or `ios/` folder)
- Changed `app.json` values like `bundleIdentifier`, `package`, `version`, or `versionCode`
- Upgraded the Expo SDK version
- Changed splash screen or app icon assets
- Added new native permissions

Run the build:

```bash
# Android only
eas build --platform android --profile preview

# iOS only
eas build --platform ios --profile preview

# Both platforms at once
eas build --platform all --profile preview
```

### Step 4 — Get the new build onto your phone

1. When the EAS build finishes, you will see a **QR code and a link** printed in your terminal.
2. **Scan the QR code** with your phone's camera app (not the barcode scanner — use the standard camera).
3. Your phone will open a page on [expo.dev](https://expo.dev) or a direct download link.
4. Tap **Install** (Android) or follow the prompts (iOS — you may need to trust the developer profile in **Settings → General → VPN & Device Management** before the app will launch).
5. Once installed, open the app and verify your changes are live.

> **Android tip:** If your phone blocks the install with "Install blocked," go to **Settings → Apps → Special app access → Install unknown apps**, find your browser or Files app, and enable "Allow from this source."

> **iOS tip:** If you're distributing to iOS outside the App Store, the device must be registered in your Apple Developer account (or you must use TestFlight). EAS handles device registration automatically when you use `--profile preview` with `distribution: internal`.

### Step 5 — Verify

Open the app, sign in, and confirm the change is working as expected. If something looks wrong, check the Metro bundler output in your terminal for errors.

---

## Updating the App

### JavaScript/TypeScript changes only

For changes that don't touch native code (any change to files in `src/`, `assets/`, `App.tsx`, etc.), you can push an **OTA (over-the-air) update** using Expo Updates — users get the new version automatically without going through the app stores:

```bash
eas update --branch production --message "Brief description of what changed"
```

### Changes that require a new native build

You need a full new build (and store submission) whenever you:

- Add or remove an npm package that has native code (e.g., a new `expo-*` library)
- Change `app.json` values like `bundleIdentifier`, `package`, `version`, or `versionCode`
- Upgrade the Expo SDK version
- Change splash screen or app icon assets
- Add new native permissions

For these, re-run `eas build` and submit the new binary.

### Dependency updates

```bash
# Check for outdated packages
npm outdated

# Update all packages within their semver range
npm update

# Update Expo SDK (major version bump — read the migration guide first)
npx expo install expo@<new-version>
npx expo install --fix
```

> **Caution with Expo upgrades:** This project is pinned to v56. Always read the [Expo upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/) before bumping the SDK version and test thoroughly — breaking changes between major versions are common.

---

## Project Structure

```
mobile/
├── App.tsx                        # Root component — sets up navigation and auth state
├── index.ts                       # Expo entry point
├── app.json                       # Expo/EAS app configuration
├── package.json                   # Dependencies and npm scripts
├── tsconfig.json                  # TypeScript config
├── assets/
│   ├── icon.png                   # App icon (1024×1024)
│   ├── splash-icon.png            # Splash screen logo
│   ├── favicon.png                # Web favicon
│   ├── android-icon-foreground.png
│   ├── android-icon-background.png
│   └── android-icon-monochrome.png
└── src/
    ├── theme.ts                   # Color palette (dark navy theme)
    ├── types.ts                   # TypeScript interfaces for all data models
    ├── config/
    │   └── firebase.ts            # Firebase app init, exports auth and db
    └── screens/
        ├── LoginScreen.tsx        # Google OAuth sign-in
        ├── DashboardScreen.tsx    # Weekly stats + recent activity feed
        ├── LogScreen.tsx          # Full activity list with type filters
        ├── AddWorkoutScreen.tsx   # Form to log a new workout
        └── ProfileScreen.tsx      # User profile and sign-out
```

### Key files explained

**`src/config/firebase.ts`** — Initialises the Firebase app (guards against double-init with `getApps()`), then exports `auth` (Firebase Auth instance) and `db` (Firestore instance). Both are imported throughout the app wherever auth or database access is needed.

**`src/types.ts`** — All TypeScript interfaces: `WorkoutEntry` (with subtypes for run, cross-training, strength, recovery), `Race`, `Goal`, `NutritionEntry`, and the top-level `TrainingData` shape that mirrors Firestore.

**`src/theme.ts`** — Single source of truth for the dark-mode colour palette. Activity type colours: pink (run), blue (cross-training), amber (strength), green (recovery).

**`App.tsx`** — Subscribes to `onAuthStateChanged` to determine whether to show `LoginScreen` or the main bottom-tab navigator. Also attaches the Firestore `onSnapshot` listener once the user is authenticated.

---

## Firestore Data Model

All data lives under a single document per user:

```
users/
  {uid}/
    db/
      data          ← document
        workouts: WorkoutEntry[]
        races:    Race[]
        goals:    Goal[]
        nutrition: NutritionEntry[]
        settings: { sportMode, seasonalOverlay, ... }
```

The mobile app reads and writes this document in real time. Because the web app uses the same path, changes made on one platform appear immediately on the other.

---

## Troubleshooting

### "Setup needed" alert on the sign-in screen

You haven't replaced the placeholder Google client IDs. See [Configuring Client IDs in the App](#configuring-client-ids-in-the-app).

### Google sign-in opens but immediately redirects back with an error

Common causes:
- The redirect URI in Google Cloud Console doesn't match. Make sure `https://auth.expo.io/@your-expo-username/ultra-training` (with your real Expo username) is listed under **Authorized redirect URIs** for the Web client ID.
- The SHA-1 fingerprint for the Android client ID doesn't match the one in your EAS keystore. Run `eas credentials` to verify the SHA-1 and update the Android OAuth client ID in Google Cloud Console if needed.

### "auth/configuration-not-found" Firebase error

The Google Sign-In method is not enabled in Firebase Console. Go to **Authentication → Sign-in method → Google** and enable it.

### App loads but shows no workout data

1. Confirm you're signed in with the **same Google account** as the web app.
2. Check your Firestore Security Rules — they must allow `read` for authenticated users on `users/{userId}/**`.
3. Open Firebase Console → Firestore → browse to `users/{your-uid}/db/data` to verify the document exists.

### Metro bundler cache issues after pulling new code

Reset the cache with the `--clear` flag:

```bash
npx expo start --clear
```

### TypeScript errors after updating packages

```bash
npx expo install --fix
```

This aligns all Expo-adjacent package versions to the ones tested with your Expo SDK version.

### Build fails on EAS with "google-services.json not found"

Make sure you've uploaded the file as an EAS secret (see [Building for Production](#building-for-production)) and that the path in `app.json` matches.
