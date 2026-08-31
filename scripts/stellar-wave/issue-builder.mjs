/**
 * Stellar Wave — issue body builder (plain section headers, no issue ids).
 * @param {{ area: string; topic: string; extraDescription?: string; extraAdditional?: string }} spec
 */
const DEFAULT_TASKS = [
  'Implement the change in the relevant code paths',
  'Wire or persist state where the feature touches runtime behavior',
  'Add tests (unit, integration, and/or contract/UI as appropriate)',
];

const DEFAULT_ADDITIONAL = [
  'Handle stale, disconnected, or invalid states gracefully where applicable',
  'Follow existing patterns in this repository (linting, modules, security)',
];

const DEFAULT_ACCEPTANCE = [
  'Behavior is covered by tests and documented where APIs changed',
  'No regressions in closely related user or API flows',
];

export function buildIssueBody(spec) {
  const area = spec.area;
  let desc = `Platform improvement for Tycoon (${area}: ${spec.topic}). Define scope, implement, and verify in CI or docs.`;
  if (spec.extraDescription) {
    desc = `${desc} ${spec.extraDescription}`;
  }

  const additional = [...DEFAULT_ADDITIONAL];
  if (spec.extraAdditional) {
    additional.push(spec.extraAdditional);
  }

  return `Description (${area})

${desc}

Tasks

${DEFAULT_TASKS.join('\n')}

Additional Requirements

${additional.join('\n')}

Acceptance Criteria

${DEFAULT_ACCEPTANCE.join('\n')}
`;
}

export function slugify(s) {
  return s
    .toLowerCase()
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
}
