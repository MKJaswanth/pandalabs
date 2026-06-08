# Firebase Setup

QA Lab can run in two modes:

- Without Firebase env values: data stays local in the browser.
- With Firebase env values: projects, test cases, bugs, test runs, and team members sync through Firestore.

## 1. Create Firebase app

1. Open Firebase Console.
2. Create or select a project.
3. Add a Web app.
4. Copy the Firebase config values.
5. Create a local `.env` file from `.env.example`.

```bash
cp .env.example .env
```

Fill in:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_QA_WORKSPACE_ID=qa-lab-main
```

Everyone who opens the deployed app with the same `VITE_QA_WORKSPACE_ID` will share the same workspace data.

## 2. Enable Firestore

In Firebase Console, create a Firestore database.

For a private team beta, you can start with this simple rule while testing:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /workspaces/{workspaceId}/{document=**} {
      allow read, write: if true;
    }
  }
}
```

Do not use this open rule for a public launch. Before wider release, add Firebase Authentication and restrict reads/writes to allowed team members.

## 3. Run

```bash
npm run dev
```

If the env values are present, the app syncs with Firestore. If they are missing, it safely falls back to browser-only storage.
