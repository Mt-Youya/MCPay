# Issue tracker: GitHub

Issues and specs for this repo live as GitHub Issues. Use the `gh` CLI for all operations.

## Conventions

- Create an issue with `gh issue create --title "..." --body "..."`.
- Read an issue with `gh issue view <number> --comments`.
- List issues with `gh issue list`, adding state or label filters when needed.
- Comment with `gh issue comment <number> --body "..."`.
- Apply or remove labels with `gh issue edit <number> --add-label "..."` and `--remove-label "..."`.
- Close an issue with `gh issue close <number> --comment "..."`.

Infer the repository from the configured GitHub remote. Pull requests are not a triage surface.

When a skill says to publish to the issue tracker, create a GitHub Issue.
