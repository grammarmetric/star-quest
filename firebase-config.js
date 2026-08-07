/* firebase-config.js
   ------------------------------------------------------------------
   Paste your own Firebase web-app config below. Until you do, the app
   detects the placeholders and runs in OFFLINE mode: the quest works
   completely, the report still generates, and only the live teacher
   view is unavailable.

   Firebase console -> Project settings -> General -> Your apps ->
   Web app -> "SDK setup and configuration" -> Config.

   IMPORTANT: databaseURL must be present. It does not appear in the
   snippet unless you have already created a Realtime Database, so
   create the database FIRST, then copy the config.
   ------------------------------------------------------------------ */

window.FIREBASE_CONFIG = {
  apiKey: 'PASTE_YOUR_API_KEY',
  authDomain: 'PASTE_YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://PASTE_YOUR_PROJECT-default-rtdb.REGION.firebasedatabase.app',
  projectId: 'PASTE_YOUR_PROJECT',
  storageBucket: 'PASTE_YOUR_PROJECT.appspot.com',
  messagingSenderId: 'PASTE_YOUR_SENDER_ID',
  appId: 'PASTE_YOUR_APP_ID'
};
