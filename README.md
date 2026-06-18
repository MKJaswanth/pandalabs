# QA Lab

QA Lab is a modern, fast, and lightweight test management dashboard designed for QA teams to track projects, test cases, bug reports, and test runs without the enterprise clutter of traditional tools.

## Features

- **Dashboard**: Track overall metrics, project test pass rates, latest bug status, and recent activity.
- **Projects Management**: Organize test efforts by creating, editing, and managing multiple projects.
- **Test Case Management**: Define test suites, modules, priorities, preconditions, steps, expected results, and track execution status.
- **Bug Tracker**: Report bugs, link them to failed test cases, assign severities, manage lifecycles, and view bug history logs.
- **Test Runs**: Group and execute test runs (e.g., regressions or smoke tests) and capture metrics.
- **Team Management**: Manage project members and assignees.
- **Backup & Restore**: Easily export/import all your workspace data to a local JSON file.
- **Dual Storage Modes**:
  - **Local Mode (Default)**: Saves all data securely in your browser's local storage. Great for individual testing.
  - **Firebase/Sync Mode**: Enable real-time sync across team members by configuring Firebase/Firestore database.

---

## Local Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v22 or later recommended)
- npm (installed with Node)

### 2. Installation
Clone this repository to your local machine:
```bash
git clone <repository-url>
cd QA-labs
```

Install project dependencies:
```bash
npm install
```

### 3. Environment Configuration
Copy the template environment file:
```bash
cp .env.example .env
```

Open `.env` in your editor and fill in your keys:
- If you want to use the **Local-only Mode**, you can leave the Firebase keys blank or commented out.
- If you want **Firebase/Firestore Mode**, provide your web app credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_QA_WORKSPACE_ID=pandalabs-main
```

### 4. Running Locally
Start the local development server:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173` (or the port specified in the terminal).

### 5. Production Build
To build the project for production:
```bash
npm run build
```
The output files will be built inside the `/dist` directory.

---

## Firebase Setup

To successfully sync data across multiple devices:
1. Enable **Firestore Database** in your Firebase console.
2. In **Firebase Console → Authentication**, click **Get Started** and enable the following Sign-in methods:
   - **Email/Password**
   - **Anonymous** (required for "Continue as guest")
   - **Google** (optional)
3. Set your Firestore rules (during testing or inside a private team environment) to allow read/write access under the workspace path. See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for more details.

---

## Deployment

This project is configured to build and deploy to **GitHub Pages** automatically on every push to the `main` branch using GitHub Actions.

### Steps to enable Deployment on your Repository:
1. Navigate to your GitHub repository **Settings** -> **Pages**.
2. Change the **Source** under "Build and deployment" from "Deploy from a branch" to **GitHub Actions**.
3. Under repository **Settings** -> **Secrets and variables** -> **Actions** -> **Variables** tab, add your Firebase environment credentials as Repository Variables (e.g., `VITE_FIREBASE_API_KEY`, etc.), so the build process can bundle them.
