# Workflows

| # | Workflow | File | Trigger | Purpose |
|---|---------|------|---------|---------|
| W1 | Test | `W1-Test.yml` | Manual or called by W3 | Typecheck, lint, test, build, validate |
| W2 | Build | `W2-Build.yml` | Manual or called by W3 | Build, package, upload artifact |
| W3 | Release | `W3-Release-Chrome-Web-Store.yml` | Manual only | Run W1 + W2, then upload & publish to Chrome Web Store |

## Dependencies

```text
W3 → W1 (CI gate) → W2 (build + package) → release job
```

Nothing runs automatically. All three declare only `workflow_dispatch` and
`workflow_call`, so W1 and W2 run either on a manual dispatch or as part of W3.

## Comparison

| Step | W1 Test | W2 Build | W3 Release |
|---|:---:|:---:|:---:|
| Typecheck | yes | - | via W1 |
| Lint & format | yes | - | via W1 |
| Tests | yes | - | via W1 |
| `bun run validate` | yes | - | via W1 |
| Build + package | yes | yes | via W2 |
| Upload artifact | - | yes (30d) | yes (90d) |
| Build report summary | - | yes | via W2 |
| Version match check | - | - | yes |
| Upload to Chrome Web Store | - | - | yes |
| Publish to Chrome Web Store | - | - | if input |
| GitHub Release | - | - | if input |
