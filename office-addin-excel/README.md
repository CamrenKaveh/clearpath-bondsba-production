# BondSBA Excel Companion (Practical MVP Scaffold)

This scaffold is a practical starting point for teams who already run underwriting intake in Excel.

## What This MVP Does
- Reads selected worksheet rows from Excel.
- Maps them to BondSBA queue fields.
- Sends payload to BondSBA API endpoint (to be implemented/secured).
- Writes prioritized status back into worksheet columns.

## Why This Is Practical
- No workflow replacement: analysts stay inside their existing workbook.
- Adds automation only where it reduces repeat manual work.
- Produces owner-ready queue updates and handoff status.

## Structure
- `manifest.xml`: Office Add-in manifest.
- `taskpane.html`: Task pane shell.
- `taskpane.js`: MVP logic for selected-range ingestion and worksheet write-back.

## Next Build Steps
1. Host task pane assets on your production domain.
2. Register a secure API endpoint for queue scoring + recommendations.
3. Add OAuth token handoff from BondSBA session to add-in dialog flow.
4. Pilot with one broker team and one CPA team before broad rollout.

## Core Workflow Mapping
Expected columns in selected range:
1. Submission ID
2. Company
3. Lane
4. Missing Items Count
5. Readiness Status
6. Owner
7. Next Follow-Up Date
8. Notes

Write-back columns (right of selected range):
- Priority Score
- Recommended Action

## Security Notes
- Do not store sensitive documents in add-in local storage.
- Keep owner-scoped access controls in the API.
- Log audit events for each write-back batch.
