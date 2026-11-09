# Repository Guidelines

## Project Structure

This workspace is at the requirements stage for a demo repair request tracker. Start with `報修需求筆記.txt` in the root. It records the fields, workflow, access rules, and planned deliverables: an Excel field list with sample data, a six-slide PowerPoint proposal, a Word user guide, a web form and request list, and a Supabase schema with access policies. There are no source, test, or asset directories yet. When adding a deliverable, document its location and how to use it.

## Development and Style

There are no build, run, lint, or test commands yet. To read the requirements in PowerShell, run `Get-Content -LiteralPath '報修需求筆記.txt' -Encoding utf8`. When introducing runnable code, document setup, required configuration, and the commands to run and verify it. Keep field labels and allowed values consistent across the form, sample data, and documentation. Preserve the Traditional Chinese labels used in the requirements.

## Testing and Data Safety

There is no test framework or coverage target yet. When implementing the demo, verify that a visitor can submit a fictional request and read it in the list, and that the system generates the registration timestamp. Verify that requests made with the public Supabase key cannot update or delete records. Enable row-level security and keep privileged keys out of browser code and shared files. Use fictional names and locations in all examples. Login, status editing, and notifications are outside the current demo scope.

## Commits and Reviews

This workspace has no Git history to establish a commit convention. If version control is added, use short, descriptive commit subjects, such as `Add repair request sample data`. In review requests, summarize the affected deliverables, explain how you verified them, and include screenshots for visible web changes. Call out changes to fields or access rules so reviewers can check all affected deliverables.
