# React Native & Mobile Development — Personalized Training Course

> **This course is built entirely around your Ultra Training App.**  
> Every concept is illustrated with real code from your codebase, so you're not learning abstract examples — you're learning to understand what you've already built.

---

## How This Course Works

Each module explains a concept, shows how it appears in your app, and contrasts it with how you'd do the same thing in a web app (including your `mwrazej_training_log.html`). Read the modules in order — they build on each other.

---

## Module 1: What Is React Native, and How Is It Different?

### The Big Idea

In a regular web app, React renders HTML elements (`<div>`, `<button>`, `<input>`) that run in a browser. The browser handles layout, fonts, scrolling, taps, and everything visual.

React Native is React, but instead of rendering HTML, it renders **native UI components** — the actual platform-native widgets that live in iOS and Android. There's no browser involved on mobile.

```
Web React:         JSX → HTML elements → Browser renders pixels
React Native:      JSX → Native Views  → iOS/Android renders pixels
Your Expo app:     JSX → Native Views  → iOS / Android / Web (via Expo)
```

### What changes?

| Web React | React Native |
|-----------|-------------|
| `<div>`   | `<View>` |
| `<p>`, `<h1>`, `<span>` | `<Text>` |
| `<img>` | `<Image>` |
| `<input>` | `<TextInput>` |
| `<button>` | `<TouchableOpacity>` or `<Pressable>` |
| `<ul>`, `<li>` | `<FlatList>` or `<ScrollView>` |
| CSS files / class names | `StyleSheet.create({})` objects |
| `onClick` | `onPress` |
| `overflow: scroll` | `<ScrollView>` is a component, not a CSS property |

### In Your App

Open `mobile/src/screens/DashboardScreen.tsx` line 1–6:

```tsx
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
```

Every one of those is a React Native primitive. Compare to your web app (`mwrazej_training_log.html`) which uses raw `<div>`, `<button>`, etc. Same visual result, completely different render path.

### Why Does This Matter?

- Native components feel and behave like the platform expects — smooth scrolling physics, correct keyboard behavior, system fonts, accessibility built in.
- You can't use browser APIs (`document.querySelector`, `localStorage`, `window`) in React Native. They don't exist on the native side.
- Your app solves this: it uses **Firebase Firestore** instead of `localStorage`, and **AsyncStorage** instead of `sessionStorage`.

---

## Module 2: The Component Model (Same as React, But Worth Reviewing)

React Native uses the exact same component model as React. If you know React, you know this part. But it's worth reviewing through the lens of your app.

### Functional Components and Props

Your app passes `user` and `db` down to every screen. Look at `mobile/src/screens/DashboardScreen.tsx` lines 11–14:

```tsx
interface Props {
  user: User;
  db: TrainingDB;
}

export default function DashboardScreen({ user, db }: Props) {
```

This is a **functional component** receiving typed props. The parent (`App.tsx`) passes these in:

```tsx
// App.tsx line 136–140
<Tab.Screen name="Dashboard">
  {() => (
    <DashboardScreen
      user={user}
      db={db}
    />
  )}
</Tab.Screen>
```

The `{() => (...)}` syntax is a **render function** — it lets you pass props to a screen in React Navigation without losing the navigation context. More on navigation in Module 5.

### TypeScript Makes Props Explicit

Your app is fully typed. `TrainingDB` (defined in `mobile/src/types.ts`) is the single source of truth for what data looks like. This is excellent practice: when you change a type, TypeScript tells you every place that breaks.

```ts
// types.ts — the entire database shape
export interface TrainingDB {
  runs: RunEntry[];
  crosses: CrossEntry[];
  strengths: StrengthEntry[];
  recoveries: RecoveryEntry[];
  races: Race[];
  plans: PlannedWorkout[];
  // ...
}
```

Your web app replicates the same shape using plain JavaScript objects — same data, no compile-time safety.

---

## Module 3: Layout with Flexbox (No CSS Files!)

### How Styling Works

In a browser, you write CSS in a `.css` file or a `<style>` tag, and reference classes with `className`. React Native has no CSS files. Instead:

1. You define styles with `StyleSheet.create({})` — this returns a plain object.
2. You apply styles with the `style` prop: `<View style={styles.container}>`.
3. Styles are JavaScript objects, not CSS strings.

```tsx
// At the bottom of almost every screen file
const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashEmoji: { fontSize: 64 },
});
```
*(From `App.tsx` lines 178–187)*

### Flexbox Is the Only Layout System

React Native doesn't have CSS Grid, floats, or block layout. Everything is **Flexbox**. The good news: it's the same Flexbox you'd use in CSS, with two small differences:

- `flexDirection` defaults to `'column'` (vertical), not `'row'` like in CSS.
- Flex values are numbers, not strings: `flex: 1` not `"1"`.

### `flex: 1` Is Everywhere — What Does It Mean?

`flex: 1` means "take up all remaining space in your parent's main axis." This is how you make a screen fill the entire phone display. Look at `App.tsx` line 179:

```tsx
splash: {
  flex: 1,           // fill the whole screen
  backgroundColor: colors.bg,
  alignItems: 'center',
  justifyContent: 'center',
},
```

Without `flex: 1`, a `View` is only as tall as its children — it won't fill the screen.

### No `px` — Density-Independent Points

React Native uses **points**, not pixels. A point on a 3x-density iPhone retina screen equals 3 physical pixels, but you never worry about that. You just write `fontSize: 16` and it looks right on every device.

### Your Theme System

Your app centralizes all colors in `mobile/src/theme.ts`:

```ts
export const colors = {
  bg:       '#0d1117',
  surface:  '#161b27',
  pink:     '#e91e8c',
  // ...
};
```

Instead of CSS variables (`--color-pink: #e91e8c`), you import and reference this object. Same concept, different mechanism.

---

## Module 4: State and Effects (Where React Native Gets Interesting)

This is pure React — but seeing it in a real app makes it click.

### `useState` — Local Component State

Your `AddWorkoutScreen` has a lot of state:

```tsx
// AddWorkoutScreen.tsx lines 38–58
const [actType,  setActType]  = useState<ActType>(initialType ?? 'run');
const [date,     setDate]     = useState(todayISO());
const [dist,     setDist]     = useState('');
const [dur,      setDur]      = useState('');
const [vert,     setVert]     = useState('');
const [notes,    setNotes]    = useState('');
const [saving,   setSaving]   = useState(false);
```

Each `useState` call creates one reactive variable. When you call the setter (e.g. `setDist('42.2')`), React re-renders the component and the UI updates. No DOM manipulation required — you just change state.

**Web equivalent in your HTML app:** You'd directly manipulate DOM elements: `document.getElementById('dist').value`. In React Native you never touch the UI directly — you update state and let React figure out what to redraw.

### `useEffect` — Side Effects and Subscriptions

`useEffect` runs code in response to renders or dependency changes. Your `App.tsx` has two critical effects:

**Effect 1 — Firebase Auth listener (lines 46–53):**
```tsx
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (u) => {
    setUser(u);
    setAuthReady(true);
    if (!u) setDB(emptyDB);
  });
  return unsubscribe;  // cleanup: unsubscribe when component unmounts
}, []);               // [] = run once on mount, never again
```

The empty `[]` dependency array means "run once when the app starts." The returned `unsubscribe` function is the **cleanup** — React calls it when the component unmounts (when the app closes), preventing memory leaks.

**Effect 2 — Firestore real-time listener (lines 56–69):**
```tsx
useEffect(() => {
  if (!user) return;
  const docRef = doc(firestoreDB, 'users', user.uid, 'db', 'data');
  const unsubscribe = onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      setDB({ ...emptyDB, ...snap.data() } as TrainingDB);
    }
  });
  return unsubscribe;
}, [user]);  // re-run whenever `user` changes
```

`[user]` as the dependency means: "re-run this effect whenever the `user` value changes." So when you sign in, this effect fires and starts listening to Firestore. When you sign out, it cleans up the old listener.

### `useMemo` — Expensive Computations

`useMemo` caches computed values so they don't recalculate on every render:

```tsx
// DashboardScreen.tsx lines 62–65
const allActivities: ActivityEntry[] = useMemo(() => (
  [...db.runs, ...db.crosses, ...db.strengths, ...db.recoveries]
    .sort((a, b) => b.date.localeCompare(a.date))
), [db]);
```

Without `useMemo`, this sort would run on every single render — even if `db` hasn't changed. With it, the sort only re-runs when `db` actually changes. This matters for a list of hundreds of workouts.

### `useCallback` — Stable Function References

```tsx
// App.tsx lines 71–73
const handleDBUpdate = useCallback((updated: TrainingDB) => {
  setDB(updated);
}, []);
```

`useCallback` returns the same function reference between renders unless its dependencies change. This prevents child components from re-rendering unnecessarily when they receive a callback prop.

---

## Module 5: Navigation — The Mobile App's Skeleton

Web apps navigate with URLs (`/dashboard`, `/log`). React Native has no URL bar. Navigation is a library you add on top.

### Your Navigation Stack

Your app uses `@react-navigation/bottom-tabs`:

```tsx
// App.tsx lines 23, 115–173
const Tab = createBottomTabNavigator();

<NavigationContainer>
  <Tab.Navigator screenOptions={...}>
    <Tab.Screen name="Dashboard" ... />
    <Tab.Screen name="Activity Log" ... />
    <Tab.Screen name="Add" ... />
    <Tab.Screen name="Calendar" ... />
    <Tab.Screen name="Profile" ... />
  </Tab.Navigator>
</NavigationContainer>
```

**`NavigationContainer`** — wraps the entire navigation tree. There's exactly one. It manages navigation state.

**`Tab.Navigator`** — creates a bottom tab bar. The `screenOptions` prop configures every tab's appearance globally.

**`Tab.Screen`** — registers one tab. The `name` prop is the route name. The child `{() => <DashboardScreen ... />}` is a render function that creates the screen component.

### The Tab Bar Icon System

```tsx
// App.tsx lines 25–37
const TAB_ICONS: Record<string, [string, string]> = {
  Dashboard:      ['grid',       'grid-outline'      ],
  'Activity Log': ['pulse',      'pulse-outline'     ],
  Add:            ['add-circle', 'add-circle-outline'],
  // ...
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const [active, inactive] = TAB_ICONS[label] ?? ['ellipse', 'ellipse-outline'];
  const color = label === 'Add' ? colors.pink : focused ? colors.pink : colors.muted;
  return <Ionicons name={(focused ? active : inactive) as any} size={focused ? 24 : 22} color={color} />;
}
```

`focused` is provided by React Navigation — it's `true` when that tab is the active one. The icon switches between filled and outline versions based on focus state. This is the standard mobile pattern.

### Modal Navigation (EditWorkoutModal)

Your app also has a modal pattern — `EditWorkoutModal` sits outside the tab navigator and is controlled with a visibility flag:

```tsx
// App.tsx lines 107–114
<EditWorkoutModal
  visible={!!editingEntry}
  entry={editingEntry}
  user={user}
  db={db}
  onSaved={handleDBUpdate}
  onClose={() => setEditingEntry(null)}
/>
```

When any screen calls `onEditEntry(someEntry)`, `editingEntry` gets set in `App.tsx` state, the modal becomes visible, slides up over the tabs, and the user edits the workout. On close, `editingEntry` goes back to `null`. This is the **lifting state up** pattern.

### Web Equivalent

In your HTML app, "navigation" is showing/hiding `<div>` sections or using `history.pushState()`. In React Native, navigation is a full library managing a stack of screens with animations, gestures, and back-button behavior built in.

---

## Module 6: Handling User Input

User input in React Native is fundamentally different from the web because there's no DOM.

### TextInput

The React Native text input component connects to state directly:

```tsx
// AddWorkoutScreen pattern
<TextInput
  style={styles.input}
  value={dist}
  onChangeText={setDist}
  keyboardType="decimal-pad"
  placeholder="0.0"
  placeholderTextColor={colors.muted}
/>
```

Key differences from `<input>` in HTML:
- `onChangeText` receives the new value directly (not an event object — no `.target.value`).
- `keyboardType` tells the phone which keyboard to show: `"decimal-pad"`, `"number-pad"`, `"email-address"`, etc.
- `placeholderTextColor` must be set explicitly — it doesn't inherit from CSS.
- `value` + `onChangeText` = **controlled input** (same concept as React on web).

### Touchable Components

There's no `onClick` in React Native. Touch is handled by wrapping content:

```tsx
<TouchableOpacity onPress={() => setWeekOffset(w => w + 1)} style={styles.btn}>
  <Text style={styles.btnText}>‹</Text>
</TouchableOpacity>
```

**`TouchableOpacity`** — dims slightly when pressed (the standard mobile feedback).  
**`Pressable`** — more flexible, lets you style the pressed state however you want.  
**`TouchableHighlight`** — highlights the background when pressed.

### Alert

Your app uses `Alert.alert()` for validation errors:

```tsx
// AddWorkoutScreen.tsx line 90–92
if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
  Alert.alert('Invalid date', 'Use YYYY-MM-DD format');
  return;
}
```

`Alert.alert(title, message)` shows the platform's native alert dialog. On iOS it looks like an iOS alert; on Android it looks like a Material alert. Compare to `window.alert()` in your web app — same concept, native platform presentation.

---

## Module 7: Scrollable Lists

One of the most important performance decisions in mobile development is how you render lists.

### ScrollView vs FlatList

**`ScrollView`** renders all its children at once. Fine for short, fixed content (forms, settings pages). Your `AddWorkoutScreen` uses a `ScrollView` because the form has a fixed number of fields.

**`FlatList`** only renders items visible on screen — it "virtualizes" the list. Crucial for long lists of workouts. Your `LogScreen` almost certainly uses this for the activity history.

```tsx
// Typical FlatList pattern
<FlatList
  data={sortedActivities}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <WorkoutRow entry={item} />}
/>
```

`keyExtractor` is the React Native equivalent of `key` in web React — it helps React track which items changed, moved, or were removed.

### Web Equivalent

In your HTML app, the activity log renders everything with a `forEach` loop building DOM nodes. That works in a browser because the browser handles virtualization itself. In React Native, you must opt into virtualization explicitly with `FlatList`.

---

## Module 8: Platform Integration — What Makes Mobile Special

This is where React Native diverges most from web development.

### The Status Bar

```tsx
// App.tsx line 100
<StatusBar style="light" />
```

The status bar (time, battery, signal at the top of the phone) is part of your app in React Native. `expo-status-bar` lets you set it to `"light"` (white icons) to match your dark theme. In a web app, you have no control over the browser chrome.

### Safe Areas

Phones have notches, rounded corners, and home indicators. On iPhones with Face ID, the top 44pt and bottom 34pt are "unsafe" — your content shouldn't appear there without padding. Expo's `SafeAreaView` or the `react-native-safe-area-context` library handles this automatically. React Navigation's tab bar already accounts for this.

### Keyboard Avoidance

When the keyboard pops up on mobile, it can cover your text inputs. `KeyboardAvoidingView` wraps your content and shifts it up when the keyboard appears. Your `AddWorkoutScreen` scroll view handles this reasonably, but a production app often wraps forms in `KeyboardAvoidingView`.

### Async Storage vs localStorage

Your web app uses `localStorage`:
```js
// mwrazej_training_log.html
localStorage.setItem('trainingDB', JSON.stringify(db));
```

React Native doesn't have `localStorage`. Your mobile app uses **Firebase Firestore** as the source of truth (the right call for a multi-device app), with Firestore's built-in offline persistence.

If you needed simple key-value storage, you'd use `@react-native-async-storage/async-storage` — it's already in your `package.json`:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.setItem('key', JSON.stringify(value));
```

It's async (returns a Promise) because reading from device storage takes real I/O time. `localStorage` is synchronous and blocks the thread — a design flaw that React Native correctly avoids.

---

## Module 9: Expo — What It Does for You

Your app uses Expo, which is a layer on top of React Native. Understanding what Expo provides is important.

### What Expo Gives You

| Without Expo | With Expo (your app) |
|---|---|
| Configure Xcode + Android Studio | `npx expo start` and you're running |
| Write native Swift/Kotlin for device features | Import `expo-*` packages |
| Manage signing certificates manually | EAS handles it |
| Test on device via USB | Scan a QR code with Expo Go |
| Build native binaries yourself | `eas build` in the cloud |

### Key Expo Packages in Your App

- **`expo-status-bar`** — controls the status bar appearance
- **`expo-linear-gradient`** — gradient backgrounds in JS (no native code)
- **`expo-web-browser`** — opens a browser for OAuth (Strava login)
- **`@expo/vector-icons`** — 30,000+ icons, including `Ionicons` used throughout your app

### `app.json` — Your App's Identity

```json
// mobile/app.json (partial)
{
  "expo": {
    "name": "Ultra Training",
    "slug": "ultra-training",
    "scheme": "ultratraining",
    "ios": { "bundleIdentifier": "com.yourcompany.ultratraining" },
    "android": { "package": "com.yourcompany.ultratraining" }
  }
}
```

This is the equivalent of a web app's `package.json` + domain name. The `scheme` (`ultratraining://`) is how other apps can deep-link into yours — it's how Strava OAuth redirects back to your app after login.

### `eas.json` — Building for Production

```json
// mobile/eas.json
{
  "build": {
    "development": { "developmentClient": true },
    "production": {}
  }
}
```

EAS (Expo Application Services) builds your app in the cloud for iOS and Android without you needing a Mac for iOS builds. `eas build --platform ios --profile production` produces an `.ipa` ready for the App Store.

---

## Module 10: Firebase Integration — Data and Auth

Your app uses Firebase for two things: **Authentication** and **Firestore** (database). This is exactly the same library as your web app — Firebase's JS SDK works in both environments.

### Firebase Auth

```tsx
// App.tsx lines 46–53
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (u) => {
    setUser(u);      // null = signed out, User object = signed in
    setAuthReady(true);
  });
  return unsubscribe;
}, []);
```

`onAuthStateChanged` fires immediately with the current auth state when the app loads (from persisted credentials), and again whenever sign-in/sign-out happens. This is why your app shows a spinner on first load — it's waiting for Firebase to confirm whether the user is already signed in.

### Firestore Real-Time Sync

```tsx
// App.tsx lines 56–69
const docRef = doc(firestoreDB, 'users', user.uid, 'db', 'data');
const unsubscribe = onSnapshot(docRef, (snap) => {
  if (snap.exists()) {
    setDB({ ...emptyDB, ...snap.data() } as TrainingDB);
  }
});
```

`onSnapshot` is a **real-time listener** — every time the document changes in Firestore (from any device or the web app), your mobile app immediately gets the new data and re-renders. This is how your mobile and web apps stay in sync.

The document path `users/{uid}/db/data` means:
- Collection: `users`
- Document: the user's Firebase UID (unique per user)
- Sub-collection: `db`
- Sub-document: `data`

### Saving Data

```tsx
// AddWorkoutScreen.tsx (saving pattern)
const newDB = { ...db, runs: [...db.runs, newEntry] };
await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), newDB);
onSaved(newDB);  // update local state immediately
```

`setDoc` writes the entire document. Because Firestore's `onSnapshot` listener is running, the write will trigger a re-render — but `onSaved(newDB)` also updates the state locally so the UI feels instant even if the network is slow.

---

## Module 11: The Strava OAuth Flow

This is the most complex integration in your app. OAuth on mobile is different from the web.

### Why Mobile OAuth Is Different

On the web, OAuth redirects to `https://your-app.com/callback?code=...`. On mobile, there's no URL to redirect to — you redirect to a **custom URL scheme**: `ultratraining://strava-callback`.

### Your OAuth Flow

```
1. User taps "Connect Strava"
2. expo-web-browser opens an in-app browser to Strava's auth page
3. User grants permission
4. Strava redirects to ultratraining://strava-callback?code=abc123
5. The OS recognizes this scheme → opens your app
6. Your app extracts the code
7. Your app calls your Netlify function (strava-exchange-token)
8. Netlify function calls Strava's API with the code + your CLIENT_SECRET
9. Strava returns access_token + refresh_token
10. You store these tokens in Firestore
```

The crucial step is 7–8: **your Netlify function acts as a proxy**. The `CLIENT_SECRET` must never be in the mobile app — anyone could extract it from the binary. The serverless function keeps it server-side.

```js
// netlify/functions/strava-exchange-token.js
const response = await fetch('https://www.strava.com/oauth/token', {
  method: 'POST',
  body: JSON.stringify({
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,  // safely server-side
    code: event.queryStringParameters.code,
    grant_type: 'authorization_code',
  }),
});
```

---

## Module 12: Performance Patterns in Your App

### `useMemo` for Derived Data

```tsx
// DashboardScreen.tsx lines 72–83
const weekRuns = useMemo(() => db.runs.filter(r => inWeek(r.date)), [db, monday]);

const runStats = useMemo(() => {
  const dist = weekRuns.reduce((s, r) => s + (Number(r.dist) || 0), 0);
  const vert = weekRuns.reduce((s, r) => s + (Number(r.vert) || 0), 0);
  const mins = weekRuns.reduce((s, r) => s + (Number(r.dur)  || 0), 0);
  return { dist, vert, mins };
}, [weekRuns]);
```

Each computation only re-runs when its specific inputs change. `weekRuns` only recomputes when `db` or `monday` changes. `runStats` only recomputes when `weekRuns` changes. This chain of memoization keeps the dashboard snappy even with a large history.

### Firestore Offline Persistence

```ts
// firebase.ts
const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
```

This one line makes Firestore cache all data locally. When the user opens the app with no network, they still see all their workouts. Writes are queued and synced when connectivity returns. Your web app needs `localStorage` to achieve the same thing manually.

---

## Module 13: The Web App Contrast — Same App, Different World

Your `mwrazej_training_log.html` is a fascinating counterpoint. Here's a side-by-side of the same conceptual operations:

### Data Loading

**Web app (HTML):**
```js
// Direct DOM + global variable
let db = JSON.parse(localStorage.getItem('trainingDB')) || emptyDB;
// Or fetch from Firebase with one-time get
```

**Mobile app:**
```tsx
// Reactive state + real-time listener
const [db, setDB] = useState<TrainingDB>(emptyDB);
useEffect(() => {
  const unsub = onSnapshot(docRef, snap => setDB(snap.data()));
  return unsub;
}, [user]);
```

### Rendering a List

**Web app:**
```js
function renderLog() {
  const container = document.getElementById('log-list');
  container.innerHTML = '';
  db.runs.forEach(run => {
    const div = document.createElement('div');
    div.innerHTML = `<strong>${run.date}</strong>: ${run.dist} km`;
    container.appendChild(div);
  });
}
```

**Mobile app:**
```tsx
<FlatList
  data={db.runs.sort((a, b) => b.date.localeCompare(a.date))}
  keyExtractor={item => item.id}
  renderItem={({ item }) => (
    <View style={styles.row}>
      <Text style={styles.date}>{item.date}</Text>
      <Text style={styles.dist}>{item.dist} km</Text>
    </View>
  )}
/>
```

### Navigation

**Web app:** Show/hide divs, maybe use `history.pushState` for URLs.

**Mobile app:** React Navigation's tab navigator with animated transitions, gesture support, and a native-feeling back button.

### Saving Data

**Web app:**
```js
function saveDB() {
  localStorage.setItem('trainingDB', JSON.stringify(db));
  // AND save to Firebase (if online)
}
```

**Mobile app:**
```tsx
await setDoc(docRef, newDB);  // Firebase is the only source of truth
```

### Key Takeaway

The web app has ~8,700 lines because it manually manages everything a browser/React/Firebase library would handle. The mobile app is ~5,600 lines because libraries absorb the boilerplate. The complexity shifts from manual DOM updates to understanding component lifecycles and reactive data flow.

---

## Module 14: Putting It All Together — Reading the App Flow

Now you have enough background to read the entire app flow from cold start to saving a workout:

```
1. index.ts
   └─ registerRootComponent(App)
       App component mounts

2. App.tsx mounts
   ├─ useEffect([]) → onAuthStateChanged fires
   │    ├─ Firebase checks persisted credentials (AsyncStorage)
   │    └─ setUser(u) + setAuthReady(true)
   │
   └─ if !authReady → show spinner (ActivityIndicator)

3. Auth resolved:
   ├─ if !user → render <LoginScreen />
   └─ if user →
        ├─ useEffect([user]) → onSnapshot fires
        │    └─ setDB(firestoreData)
        │
        └─ render <NavigationContainer> with 5 tabs

4. User taps "Add" tab
   └─ AddWorkoutScreen renders
        ├─ useState for each form field
        └─ ScrollView shows the form

5. User fills form, taps "Save"
   └─ handleSave()
        ├─ Validate date
        ├─ Build RunEntry object
        ├─ newDB = { ...db, runs: [...db.runs, entry] }
        ├─ setDoc(firestoreRef, newDB)  ← writes to Firestore
        └─ onSaved(newDB)              ← updates App.tsx state immediately

6. Firestore onSnapshot fires (from step 3's listener)
   └─ setDB(updatedData)              ← confirms the save round-tripped
```

This cycle — local state update + Firestore write + Firestore listener confirms — is the pattern used for every data operation in the app.

---

## Exercises

These exercises use your actual codebase. They range from reading to small modifications.

### Exercise 1 — Find All Native Primitives (Beginner)
Search the codebase for React Native imports. How many different primitive components do you use? Make a list. Notice how `ScrollView`, `View`, `Text`, and `TouchableOpacity` appear in almost every screen.

### Exercise 2 — Trace a State Update (Beginner)
Pick the "week back" button on the Dashboard. Trace what happens: what state changes, what memoized values re-compute, what gets re-rendered.

```tsx
// Hint: DashboardScreen.tsx line 57
const [weekOffset, setWeekOffset] = useState(0);
const { monday, sunday } = useMemo(() => getWeekRange(weekOffset), [weekOffset]);
```

### Exercise 3 — Add a New Form Field (Intermediate)
Add a "Workout Details" text field to `AddWorkoutScreen` for runs only. You'll need to:
1. Add `useState` for the new field
2. Render a `TextInput` conditionally (when `actType === 'run'`)
3. Include the field in the `RunEntry` object when saving

Note: `RunEntry` already has a `workoutDetails?: string` field in `types.ts`. You just need to wire up the UI.

### Exercise 4 — Understand the Navigation Render Function (Intermediate)
In `App.tsx`, the screens are rendered with `{() => <DashboardScreen ... />}`. Try to explain in your own words why this pattern is used instead of `component={DashboardScreen}`. What problem does passing props inside the render function solve?

### Exercise 5 — Add a New Stat to the Dashboard (Advanced)
Add "Longest run this week" to the Dashboard stats display. `runStats` in `DashboardScreen.tsx` already calculates `longest` — you just need to display it. This exercise requires understanding how the layout is structured and adding a new `View`/`Text` pair in the correct place.

---

## Quick Reference: Web vs React Native

| Concept | Web (your HTML app) | React Native (your mobile app) |
|---|---|---|
| Container | `<div>` | `<View>` |
| Text | `<p>`, `<span>`, `<h1>` | `<Text>` |
| Image | `<img>` | `<Image>` |
| Button | `<button>` | `<TouchableOpacity>` |
| Text input | `<input type="text">` | `<TextInput>` |
| Scroll | CSS `overflow: scroll` | `<ScrollView>` or `<FlatList>` |
| Styling | CSS files / `className` | `StyleSheet.create({})` / `style={}` |
| Click | `onClick` | `onPress` |
| Alert | `window.alert()` | `Alert.alert()` |
| Local storage | `localStorage` | `AsyncStorage` |
| Navigation | URLs / `history.pushState` | React Navigation library |
| Network | `fetch` | `fetch` (same!) |
| Real-time data | WebSocket / Firebase SDK | Firebase SDK (same!) |
| Build output | HTML/CSS/JS files | Native `.ipa` / `.apk` binary |

---

## What to Explore Next

1. **React Navigation deep dive** — your app only uses bottom tabs, but React Navigation also supports stack navigators (for push/pop screens like a settings drill-down) and drawer navigators.

2. **Animations** — `react-native-reanimated` and the built-in `Animated` API let you build smooth, gesture-driven animations. Your app's static UI would feel much more alive with subtle transitions.

3. **Expo Camera / Location** — add GPS tracking to automatically record distance during a run. This would require `expo-location` and a background task.

4. **Push Notifications** — remind yourself to log a workout. Expo Notifications makes this straightforward.

5. **Testing** — React Native Testing Library (same API as Testing Library for web) lets you write unit tests for your components.

6. **Over-the-Air Updates** — with EAS Update (`expo-updates`), you can push JavaScript changes to production without going through App Store review. Only native changes require a full build.

---

*Course built from your Ultra Training App source code at `/home/user/Ultra-Training-App/mobile`.*
