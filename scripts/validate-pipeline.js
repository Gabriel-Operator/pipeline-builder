#!/usr/bin/env node
const fs = require('fs');

function fail(message) {
  throw new Error(message);
}

function assertNoDuplicates(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) fail(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function validateMappings(mappings, columnKeys, label) {
  for (const mapping of mappings || []) {
    if (!mapping.targetField || !columnKeys.has(mapping.targetField)) {
      fail(`${label} maps to missing column: ${mapping.targetField || '(empty)'}`);
    }
    if (!String(mapping.sourcePath || '').trim()) {
      fail(`${label} has an empty sourcePath for ${mapping.targetField}`);
    }
  }
}

function validate(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (parsed.schemaVersion !== 1) fail('schemaVersion must be 1');
  if (!parsed.pageId || !parsed.pipelineId) fail('pageId and pipelineId are required');
  if (!parsed.pipeline || typeof parsed.pipeline !== 'object') fail('pipeline object is required');

  const columns = Array.isArray(parsed.pipeline.columns) ? parsed.pipeline.columns : [];
  const stages = Array.isArray(parsed.pipeline.stages) ? parsed.pipeline.stages : [];
  const transitions = Array.isArray(parsed.pipeline.transitions) ? parsed.pipeline.transitions : [];
  const columnKeys = new Set(columns.map((column) => column.key).filter(Boolean));
  const stageIds = new Set(stages.map((stage) => stage.id).filter(Boolean));

  assertNoDuplicates(columns.map((column) => column.key || ''), 'column key');
  assertNoDuplicates(stages.map((stage) => stage.id || ''), 'stage id');
  assertNoDuplicates(transitions.map((transition) => transition.id || ''), 'transition id');

  for (const transition of transitions) {
    const id = transition.id || '(missing id)';
    if (!transition.fromStageId) fail(`Transition ${id} is missing fromStageId`);
    if (!stageIds.has(transition.fromStageId)) {
      fail(`Transition ${id} references missing fromStageId ${transition.fromStageId}`);
    }
    for (const target of [
      transition.toStageId,
      transition.failureStageId,
      transition.success && transition.success.advanceToStageId,
      transition.failure && transition.failure.advanceToStageId,
    ]) {
      if (target && target !== 'self' && !stageIds.has(target)) {
        fail(`Transition ${id} references missing target stage ${target}`);
      }
    }
    validateMappings(transition.fieldMappings, columnKeys, `Transition ${id}`);
    validateMappings(transition.success && transition.success.fieldMappings, columnKeys, `Transition ${id} success`);
    validateMappings(transition.failure && transition.failure.fieldMappings, columnKeys, `Transition ${id} failure`);
    for (const [name, outcome] of [['success', transition.success], ['failure', transition.failure]]) {
      const recordField = outcome && outcome.correlation && outcome.correlation.recordField;
      if (recordField && !columnKeys.has(recordField)) {
        fail(`Transition ${id} ${name} correlation uses missing record field ${recordField}`);
      }
      if (outcome && outcome.correlation && !String(outcome.correlation.outputPath || '').trim()) {
        fail(`Transition ${id} ${name} correlation is missing outputPath`);
      }
    }
  }
}

const filePath = process.argv[2] || 'assets/pipeline.json';
try {
  validate(filePath);
  console.log(`Valid pipeline definition: ${filePath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
