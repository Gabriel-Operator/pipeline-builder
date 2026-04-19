# go-pipeline-builder-skills

Gabriel Operator pipeline-builder skill pack for Git-backed pipeline state machines.

## Install

```bash
npx github:go-code-bot/go-pipeline-builder-skills
npx github:go-code-bot/go-pipeline-builder-skills add ./my-pipeline
npx github:go-code-bot/go-pipeline-builder-skills sync ./my-pipeline
```

Or:

```bash
curl -fsSL https://raw.githubusercontent.com/go-code-bot/go-pipeline-builder-skills/main/install.sh | bash
curl -fsSL https://raw.githubusercontent.com/go-code-bot/go-pipeline-builder-skills/main/install.sh | bash -s -- ./my-pipeline
```

## What gets installed

```text
SKILL.md
assets/pipeline.json
scripts/validate-pipeline.js
```

`assets/pipeline.json` is the canonical machine definition. It stores columns,
stages, transitions, workflow endpoint bindings, guards, and persistence
contracts. It must not store live records, `_workflowState`, or list row data.

## Validate

```bash
node scripts/validate-pipeline.js assets/pipeline.json
```
