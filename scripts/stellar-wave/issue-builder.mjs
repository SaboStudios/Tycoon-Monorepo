/**
 * Stellar Wave — issue body builder (shared markdown shape).
 * @param {{ area: string; title: string; description: string; tasks: string[]; additional: string; acceptance: string[] }} spec
 */
export function buildIssueBody(spec) {
  const tasks = spec.tasks.map((t) => `- ${t}`).join('\n');
  const acceptance = spec.acceptance.map((a) => `- ${a}`).join('\n');
  return `### Description

${spec.description}

**Stellar Wave** — ${spec.area}

### Tasks

${tasks}

### Additional Requirements

${spec.additional}

### Acceptance Criteria

${acceptance}
`;
}

export function slugify(s) {
  return s
    .toLowerCase()
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
}
