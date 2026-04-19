---
name: pipeline-builder
description: >
  Build, validate, and maintain Git-backed Gabriel Operator pipeline state
  machines by editing assets/pipeline.json. Use this skill when defining
  pipeline columns as persisted actor context, stages as machine states, and
  transitions as Gabriel workflow executions with guards and persistence
  contracts that create, patch, or upsert records.
metadata:
  author: gabriel-operator
  version: "1.0"
compatibility: Requires Node.js 16+ for validation scripts.
---

# Pipeline Builder

## Git-backed pipeline repositories

When this skill is materialized as a Git repository for one pipeline, the repo
contains the scaffold plus `assets/pipeline.json`. The live Gabriel runtime uses
the synced default branch/database projection; non-default branches are for
authoring and review.

Use this skill when editing `assets/pipeline.json` for a Git-backed pipeline.

## Mental Model

- One pipeline is one state-machine definition.
- `pipeline.columns[]` is the persisted record/context schema. Each key is a field that can appear on a table row and in actor context.
- `pipeline.stages[]` is state metadata only: stable `id`, user-facing `name`, `type`, color, and description.
- `pipeline.transitions[]` is where behavior lives. A transition owns the workflow binding, source state, target state, guard, and persistence contract.
- Records, `_workflowState`, runtime snapshots, and table row data never belong in Git.
- Keep ids stable. Rename labels freely, but do not regenerate stage, transition, or column keys unless you intentionally migrate existing records and mappings.

## Canonical File

Edit only:

```text
assets/pipeline.json
```

Expected wrapper:

```json
{
  "schemaVersion": 1,
  "pageId": "page_123",
  "pipelineId": "pipe_123",
  "pipeline": {
    "id": "pipe_123",
    "pageId": "page_123",
    "name": "Grocery Automation",
    "collectionId": "pipeline_pipe_123",
    "columns": [],
    "stages": [],
    "transitions": []
  },
  "commitMessage": "Update pipeline machine definition"
}
```

## Columns

Columns are the machine context schema and the table schema.

```json
{
  "id": "col_total_eur",
  "key": "total_eur",
  "label": "Total EUR",
  "type": "number",
  "required": false,
  "order": 3
}
```

Allowed types are `text`, `number`, `boolean`, `select`, `date`, `datetime`, and `json`.

## Stages

Stages are state cards. They should not own workflow execution long-term.

```json
{
  "id": "reserve_order_slot",
  "name": "Reserve Order Slot",
  "type": "intermediate",
  "description": "Reserve a pickup or delivery slot.",
  "colorToken": "#3b82f6",
  "order": 1
}
```

Use `type: "initial"` for the first state and `type: "terminal"` for final states.

## Transitions

A transition is the software contract between a state, a workflow, and persisted records.

```json
{
  "id": "reserve_order_slot__default",
  "name": "Reserve delivery slot",
  "fromStageId": "reserve_order_slot",
  "toStageId": "search_and_add_groceries",
  "workflowEndpointId": "workflow_abc",
  "trigger": "manual",
  "selectionMode": "all_in_stage",
  "batchMode": "none",
  "success": {
    "advanceToStageId": "search_and_add_groceries",
    "persistMode": "shared_patch",
    "fieldMappings": [
      { "targetField": "slot_time", "sourcePath": "slot.time" },
      { "targetField": "store_name", "sourcePath": "store.name" }
    ]
  },
  "failure": {
    "advanceToStageId": "reserve_order_slot",
    "persistMode": "shared_patch",
    "fieldMappings": [
      { "targetField": "last_error", "sourcePath": "message" }
    ]
  }
}
```

## Guards

Use deterministic guard AST, not free-form instructions.

```json
{
  "guardText": "{{total_eur}} >= 50",
  "guardAst": {
    "type": "clause",
    "field": "total_eur",
    "op": ">=",
    "value": 50
  }
}
```

Supported operators are `=`, `!=`, `>`, `>=`, `<`, `<=`, `contains`, `is_empty`, and `is_not_empty`.

## Persistence Modes

- `shared_patch`: one workflow output object is mapped to every eligible record.
- `per_record_match`: workflow returns an array and each item is matched to one existing record.
- `create_or_upsert`: workflow returns an array and records are created or updated by correlation.

For array modes, define correlation:

```json
{
  "persistMode": "per_record_match",
  "arrayKey": "records",
  "correlation": {
    "recordField": "sku",
    "outputPath": "sku"
  }
}
```

## Common Edits

Add a stage:

1. Append a new object to `pipeline.stages[]`.
2. Use a stable lowercase id.
3. Add or update transitions that point to it.

Add a transition:

1. Add a `pipeline.transitions[]` entry.
2. Set `fromStageId` to an existing stage id.
3. Set `success.advanceToStageId` and/or `toStageId` to an existing stage id.
4. Bind `workflowEndpointId` only if the workflow should run for this transition.
5. Add field mappings only to existing column keys.

Change mappings:

1. Keep `targetField` equal to a `pipeline.columns[].key`.
2. Set `sourcePath` to a structured JSON path returned by the workflow End node.
3. Do not map plain text output; expose named JSON fields in the workflow first.

## Validation

Run:

```bash
node scripts/validate-pipeline.js assets/pipeline.json
```

The validator rejects duplicate columns, duplicate ids, missing stage references, invalid mappings, and invalid correlation fields.
