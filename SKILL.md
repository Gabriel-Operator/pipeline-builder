---
name: pipeline-builder
description: "Build, validate, and maintain Git-backed Gabriel Operator pipeline state machines by editing assets/pipeline.json. Use this skill when defining pipeline columns as persisted actor context, stages as machine states, and transitions as Gabriel workflow executions with guards and persistence contracts that create, patch, or upsert records."
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
- `pipeline.collectionId` is the canonical runtime list/collection for this machine. UI list metadata may name that list, but runtime reads/writes use `pipeline.collectionId`.
- `pipeline.stages[]` is state metadata only: stable `id`, user-facing `name`, `type`, color, and description.
- `pipeline.transitions[]` is where behavior lives. A transition owns the optional workflow binding, source state, target state, trigger, outcome guards, and persistence contract.
- Cross-machine communication is modeled declaratively with transition outcome `effects[]`; do not hardcode sibling pipeline calls in workflow instructions.
- Records, `_workflowState`, runtime snapshots, and table row data never belong in Git.
- Keep ids stable. Rename labels freely, but do not regenerate stage, transition, or column keys unless you intentionally migrate existing records and mappings.

## Canonical Files

```text
assets/pipeline.json          ← machine definition (stages, transitions, columns)
assets/blueprint.json         ← read-only simulation blueprints (optional)
tasks/<taskId>.json           ← one file per pipeline task (see Tasks section)
```

### `assets/pipeline.json`

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
  "taskIds": ["task_abc", "task_def"],
  "commitMessage": "Update pipeline machine definition"
}
```

`taskIds` is an optional array of task IDs. Each ID corresponds to a file at `tasks/<id>.json`. Do not embed task configs inline in `pipeline.json`; use the `tasks/` folder instead.

Optional documentation metadata:

- `blueprints[]` may be stored at the top level for read-only simulation docs.
- This is documentation-only and must not alter runtime machine behavior.
- Runtime still executes from `pipeline.stages[]` + `pipeline.transitions[]`.

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

Stages are state cards. They should not own workflow execution long-term, but
they may own trigger configuration used by the coordinator.

```json
{
  "id": "reserve_order_slot",
  "name": "Reserve Order Slot",
  "type": "intermediate",
  "description": "Reserve a pickup or delivery slot.",
  "triggerKind": "scheduled",
  "scheduledConfig": { "cronExpression": "0 21 * * *" },
  "colorToken": "#3b82f6",
  "order": 1
}
```

Use `type: "initial"` for the first state and `type: "terminal"` for final states.
Allowed `triggerKind` values are `manual`, `scheduled`, `reactive`, and
`data_change`.

For data-change stages, store the watch predicate on the stage:

```json
{
  "triggerKind": "data_change",
  "dataChangeConfig": {
    "guardText": "{{usage}} >= 80",
    "guardAst": {
      "type": "clause",
      "field": "usage",
      "op": ">=",
      "value": 80
    }
  }
}
```

`dataChangeConfig.guardAst` decides whether a row change should fire the
transition. `transition.success.guardAst` and `transition.failure.guardAst`
remain outcome guards evaluated after the trigger fires.

## Tasks

Pipeline tasks are named run configurations for a pipeline. Each task defines a set of input fields, how those inputs are sourced (manual, text prompt, or image), and how they are mapped to workflow start inputs.

Tasks are stored in the `tasks/` folder — one JSON file per task. The file name must match the `pipelineTaskConfig.id`.

### Task file format (`tasks/<taskId>.json`)

```json
{
  "schemaVersion": 1,
  "pipelineId": "pipe_123",
  "pageId": "page_123",
  "id": "tpl_abc",
  "title": "Weekly Grocery Run",
  "icon": "🛒",
  "description": "Run the full grocery automation for one household.",
  "visibility": "public",
  "pipelineTaskConfig": {
    "id": "task_abc",
    "pipelineId": "pipe_123",
    "name": "Weekly Grocery Run",
    "description": "Automated weekly shop.",
    "icon": "🛒",
    "inputDefinitions": [
      {
        "key": "supermarket",
        "label": "Supermarket",
        "type": "choice",
        "required": true,
        "options": [
          { "label": "Albert Heijn", "value": "albert_heijn" },
          { "label": "Jumbo", "value": "jumbo" }
        ]
      }
    ],
    "inputSources": [],
    "inputMappings": [],
    "inputBindings": [
      {
        "id": "bind_1",
        "inputKey": "supermarket",
        "target": {
          "kind": "start_input",
          "stageId": "stage_shop",
          "transitionId": "trans_shop__default",
          "workflowEndpointId": "workflow_abc",
          "fieldKey": "supermarket"
        }
      }
    ]
  }
}
```

### Task file fields

| Field | Required | Description |
|-------|----------|-------------|
| `schemaVersion` | yes | Must be `1` |
| `pipelineId` | yes | Must match the pipeline's id |
| `pageId` | yes | Must match the pipeline's pageId |
| `id` | no | The task template record id (stable; do not change after creation) |
| `title` | yes | Display name shown in the UI |
| `icon` | no | Emoji or icon string |
| `description` | no | Short description shown in the task picker |
| `visibility` | no | `"public"` (default) or `"private"` |
| `pipelineTaskConfig` | yes | The full task configuration (see below) |

### `pipelineTaskConfig` fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable unique id — must match the file name (`tasks/<id>.json`) |
| `pipelineId` | yes | Same as the outer `pipelineId` |
| `name` | yes | Internal name |
| `inputDefinitions` | yes | Array of input field definitions |
| `inputSources` | yes | Array of input sources (task prompt, image) |
| `inputMappings` | yes | Array of prompt/image → field mappings |
| `inputBindings` | yes | How each input field maps to workflow start inputs or connector inputs |

### `inputDefinitions` field types

Allowed `type` values: `text`, `number`, `boolean`, `choice`, `date`, `email`, `url`, `rich-text`, `image`, `array`, `object`, `json`, `task_prompt`, `task_prompt_with_image`.

For `choice` fields, include an `options` array:

```json
{ "key": "supermarket", "label": "Supermarket", "type": "choice", "required": true,
  "options": [{ "label": "Albert Heijn", "value": "albert_heijn" }] }
```

### `inputBindings` target kinds

| `target.kind` | Description |
|---------------|-------------|
| `start_input` | Binds to a workflow start node input field |
| `human_choice` | Binds to a `human_choice` node's `outputKey` (pre-answers the choice) |
| `member_input` | Binds to a connector step input |
| `member_variable` | Binds to a connector step variable |
| `stage_context` | Stores the value as stage context for that stage |

### Managing tasks

- To **add** a task: create `tasks/<newTaskId>.json` and add `"newTaskId"` to `taskIds` in `pipeline.json`.
- To **remove** a task: delete `tasks/<taskId>.json` and remove the id from `taskIds` in `pipeline.json`.
- To **rename** a task: update `title` in the task file. Do **not** change `pipelineTaskConfig.id` or the file name — that breaks existing saved runs.
- Keep `pipelineTaskConfig.id`, the file name, and the `taskIds` entry all in sync.

## Team-agent pages and first-step routing

**Default:** Prefer **one** manual transition from the **initial** stage with a single `workflowEndpointId` (the team-agent / page-builder workflow). Model parallel work (many repos or categories) **inside** `assets/team-agent.json` using **fork** and **join** in the workflow graph, not by creating one pipeline transition per branch.

**Multiple initial transitions:** Add two or more manual transitions from the same initial stage, each with `workflowEndpointId`, only when you need **different first workflows** or explicit route labels. The Results tab shows a route dropdown and sends `selectedTransitionId` on pipeline start and on stage **Resume** when multiple manual workflow transitions exist from that stage.

**N transitions does not require N Git repositories.** You may reuse the same `workflowEndpointId` on several transitions if you only need distinct transition ids and labels.

Example fragment (replace stage ids and endpoint uuid with yours):

```json
"transitions": [
  {
    "id": "ingest__route_alpha",
    "name": "Route Alpha",
    "fromStageId": "ingest",
    "toStageId": "enrich",
    "trigger": "manual",
    "workflowEndpointId": "00000000-0000-4000-8000-000000000001",
    "success": {
      "advanceToStageId": "enrich",
      "persistMode": "shared_patch",
      "fieldMappings": []
    }
  },
  {
    "id": "ingest__route_beta",
    "name": "Route Beta",
    "fromStageId": "ingest",
    "toStageId": "enrich",
    "trigger": "manual",
    "workflowEndpointId": "00000000-0000-4000-8000-000000000001",
    "success": {
      "advanceToStageId": "enrich",
      "persistMode": "shared_patch",
      "fieldMappings": []
    }
  }
]
```

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

`workflowEndpointId` is optional. Workflowless `scheduled`, `reactive`, and
`data_change` transitions are advanced directly through the row event path. When
`workflowEndpointId` is present, the workflow runs first and its success/failure
output is applied by the transition outcome contract.

Allowed `trigger` values are `manual`, `scheduled`, `reactive`, and
`data_change`.

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
- `replace`: workflow returns an array that hard-deletes all records in the associated pipeline list and inserts the new mapped records.

For matching array modes, define correlation:

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

For full replacement, define `arrayKey` and omit correlation:

```json
{
  "persistMode": "replace",
  "arrayKey": "records"
}
```

## Cross-Pipeline Effects

Use `success.effects[]` or `failure.effects[]` when one state machine must
create, upsert, patch, or run a transition in another pipeline.

```json
{
  "success": {
    "advanceToStageId": "monitor_usage",
    "effects": [
      {
        "type": "pipeline_transition",
        "targetPipelineId": "pl_grocery_order",
        "targetTransitionId": "reserve_slot__default",
        "targetCollectionId": "coll_grocery_orders",
        "operation": "create_or_upsert",
        "dispatch": "run_target_transition",
        "correlation": {
          "targetField": "order_key",
          "sourcePath": "source.record.reorder_key"
        },
        "mappings": [
          { "targetField": "items", "sourcePath": "source.records" },
          { "targetField": "status", "value": "draft" }
        ],
        "sourcePatches": [
          { "targetField": "current_order_id", "sourcePath": "target.record.id" }
        ]
      }
    ]
  }
}
```

Effect fields:

- `targetPipelineId`: required id of the sibling pipeline/state machine.
- `targetCollectionId`: optional override; defaults to the target pipeline's `collectionId`.
- `targetTransitionId`: optional transition to run after the target record exists.
- `operation`: `create`, `upsert`, `patch`, or `create_or_upsert`.
- `dispatch`: use `run_target_transition` to execute `targetTransitionId`; otherwise use `none`.
- `correlation.targetField`: field on the target list used to find an existing target record.
- `correlation.sourcePath`: scoped path that supplies the match value.
- `mappings[]`: writes target list columns.
- `sourcePatches[]`: writes columns back on the source list after the target record is created or updated.

Scoped source paths:

- `source.output.foo`: workflow output field from the source transition.
- `source.record.foo`: current source row field.
- `source.records`: all source rows selected/finalized by the source transition.
- `source.context.foo`: source actor snapshot context.
- `target.record.foo`: target row field after create/upsert/patch; use `target.record.id` for the target record id.

When mapping fields, qualify the intended list mentally even if the JSON stores
only the field key: target mappings must be columns on the target pipeline/list,
and `sourcePatches` must be columns on the source pipeline/list.

## Common Edits

Add a task:

1. Create `tasks/<taskId>.json` with `schemaVersion: 1`, `pipelineId`, `pageId`, and `pipelineTaskConfig`.
2. Add the task id to `taskIds[]` in `assets/pipeline.json`.
3. Wire `inputBindings` to the relevant stage transitions and workflow start input keys.

Remove a task:

1. Delete `tasks/<taskId>.json`.
2. Remove the id from `taskIds[]` in `assets/pipeline.json`.

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

Add a workflowless automatic transition:

1. Add a `pipeline.transitions[]` entry with `trigger` set to `scheduled`,
   `reactive`, or `data_change`.
2. Leave `workflowEndpointId` unset.
3. Set `success.advanceToStageId` to the next stage, and optionally add a
   success guard.
4. For `scheduled`, put `scheduledConfig.cronExpression` on the source stage.
5. For `data_change`, put the watch condition in the source stage's
   `dataChangeConfig.guardAst`.

Change mappings:

1. Keep `targetField` equal to a `pipeline.columns[].key`.
2. Set `sourcePath` to a structured JSON path returned by the workflow End node.
3. Do not map plain text output; expose named JSON fields in the workflow first.

Connect two pipelines:

1. Keep each machine in its own pipeline JSON with its own `collectionId`.
2. Add an outcome `effects[]` entry on the source transition.
3. Set the target pipeline/list/transition ids explicitly.
4. Map source data into target columns.
5. Add `sourcePatches[]` only for fields that should be written back to the source list.
6. Use `dispatch: "run_target_transition"` only when the target transition should run immediately.

## Validation

Run:

```bash
node scripts/validate-pipeline.js assets/pipeline.json
```

The validator rejects duplicate columns, duplicate ids, missing stage references,
invalid persist modes, invalid mappings, invalid correlation fields, and
malformed cross-pipeline effects.

Task files are validated at sync time by the runtime. Each `tasks/<taskId>.json` must:
- Have `schemaVersion: 1`
- Have `pipelineId` matching the pipeline's id
- Have `pageId` matching the pipeline's pageId
- Have a non-empty `pipelineTaskConfig.id` that matches the file name (without `.json`)
