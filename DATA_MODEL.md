# QA Manager Data Model

This document defines the structure of the data entities used in the QA Manager application. These structures are persisted in `localStorage`.

## 1. Project
**Storage Key:** `qa_projects` (Array)

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | UUID |
| `name` | `string` | Project name |
| `description` | `string` | Brief overview |
| `memberIds` | `string[]` | Array of Team Member IDs |
| `passRate` | `number` | Calculated percentage (0-100) |
| `createdAt` | `string` | ISO 8601 timestamp |

---

## 2. Test Case
**Storage Key:** `qa_testcases_{projectId}` (Array)

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | UUID |
| `sourceTcId` | `string` | Optional external ID (e.g., "TC-001") |
| `title` | `string` | Title of the test |
| `module` | `string` | Category/Module name |
| `scenario` | `string` | High-level testing scenario |
| `preconditions` | `string` | Setup required before testing |
| `priority` | `string` | `High` \| `Med` \| `Low` |
| `assignee` | `string` | Name of the assigned tester |
| `steps` | `string[]` | Ordered list of test steps |
| `testData` | `string` | Input values or sample data |
| `expected` | `string` | Expected behavior |
| `actual` | `string` | Last observed behavior |
| `status` | `string` | `Not Executed` \| `Pass` \| `Fail` \| `Skipped` \| `Blocker` |
| `devRemarks` | `string` | Notes for developers |
| `qaRemarks` | `string` | Internal QA notes |
| `attachments` | `Attachment[]` | Array of file attachments (Base64 encoded, max 1MB per file) |
| `createdAt` | `string` | ISO 8601 timestamp |
| `updatedAt` | `string` | Last update timestamp |
| `updatedBy` | `string` | Name of user who last updated |

### Attachment
*Stored within the `attachments` array of a Bug or Test Case.*
* `id`: `string` (UUID)
* `name`: `string` (Original filename)
* `type`: `string` (MIME type)
* `size`: `number` (File size in bytes)
* `data`: `string` (Base64 encoded data)

---

## 3. Bug
**Storage Key:** `qa_bugs_{projectId}` (Array)

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | UUID |
| `title` | `string` | Summary of the defect |
| `description` | `string` | Repro steps and details |
| `severity` | `string` | `Critical` \| `Major` \| `Minor` |
| `status` | `string` | `Open` \| `In review` \| `Closed` |
| `linkedTestCase` | `string` | Optional ID of the related Test Case |
| `attachments` | `Attachment[]` | Array of file attachments (Base64 encoded, max 1MB per file) |
| `history` | `object[]` | Array of activity logs |
| `createdAt` | `string` | ISO 8601 timestamp |

### Bug History Entry
*Stored within the `history` array of a Bug.*
* `id`: `string` (UUID)
* `type`: `string` (`created` | `status_change` | `comment` | `update`)
* `user`: `string` (Name of user)
* `timestamp`: `string` (ISO 8601)
* `details`: `string` (e.g., "Changed status from Open to In review")
* `from`: `string` (Optional, previous value)
* `to`: `string` (Optional, new value)

---

## 4. Test Run
**Storage Key:** `qa_runs_{projectId}` (Array)

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | UUID |
| `name` | `string` | Run name (e.g., "v1.2 Regression") |
| `build` | `string` | Build version or environment |
| `date` | `string` | Creation date (ISO 8601) |
| `completedAt` | `string` | Completion date (ISO 8601) |
| `executedBy` | `string` | Name of the tester |
| `total` | `number` | Count of cases in run |
| `passed` | `number` | Count of passed cases |
| `failed` | `number` | Count of failed cases |
| `blocker` | `number` | Count of blocker cases |
| `skipped` | `number` | Count of skipped cases |
| `pending` | `number` | Count of unexecuted cases |
| `cases` | `object[]` | Snapshot of test cases at run time |

### Test Run Case Snapshot
*Stored within the `cases` array of a Test Run.*
* `testCaseId`: `string`
* `title`: `string`
* `module`: `string`
* `priority`: `string`
* `assignee`: `string`
* `expected`: `string`
* `status`: `string`
* `actual`: `string`

---

## 5. Team Member
**Storage Key:** `qa_team_members` (Array)

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | UUID |
| `name` | `string` | Display name |

---

## 6. Backup (Export Format)
**JSON Structure**

| Path | Type | Description |
| :--- | :--- | :--- |
| `app` | `string` | Constant: `qa-manager` |
| `version` | `number` | Schema version (currently `1`) |
| `exportedAt` | `string` | ISO 8601 timestamp |
| `data.currentUser` | `string` | Last active user name |
| `data.teamMembers` | `array` | All Team Members |
| `data.projects` | `array` | All Projects |
| `data.projectData` | `object` | Keyed by `projectId`, contains `{ testCases, bugs, runs }` |
