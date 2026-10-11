# F07: Branches, departments and teams
Priority: Must (teams and org chart: Should)     Build step: 2     Depends on: F06
Source: P1-ORG-02, P1-ORG-03, P1-ORG-04, P1-ORG-05

## User story
As an admin, I model how my company is organised so cards and permissions match.

## Acceptance criteria
- Create, edit and archive branches with address, map pin, contact and a Branch Manager.
- Departments: defaults offered (Sales, Marketing, HR, Support, Development) plus custom. Global or branch-scoped.
- Teams under departments with a Team Lead. An employee has one primary team. Manager chain is derived. (Should)
- Archived branches are hidden from the public and history is kept.
- Starter allows 1 branch. Business and above allow unlimited. Enforced server-side.
- Org chart tree view. Drag-and-drop move updates the person's card branch and department and their access scope. (Should)
- All changes write to the audit log.

## States to design
Empty org, first-branch prompt, archive confirmation, plan limit reached.

## API and events
`CRUD /orgs/{id}/branches`, `/departments`, `/teams`.

## Data
`Branch`, `Department`, `Team`.

## Tests required
Plan limit enforcement, scope per role, archive hides from public, cycle prevention in the tree.

## Out of scope
Multi-company switcher.
