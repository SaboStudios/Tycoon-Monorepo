# Requirements Document

## Introduction

This feature establishes a single source of truth for the Tycoon frontend design tokens — covering color, spacing, border radius, and typography scales. The documentation will live in the repository as a markdown token table and as annotated Storybook stories, with do/don't usage examples and a link from CONTRIBUTING.md. The goal is that a new contributor can theme a component (e.g. a button) using only the docs, without needing to read source code. The token documentation must stay in sync with `globals.css` and the Tailwind v4 `@theme` block.

## Glossary

- **Design_Token**: A named, versioned CSS custom property (e.g. `--tycoon-accent`) that represents a single design decision such as a color, spacing value, or font family.
- **Token_Table**: A structured markdown table listing every Design_Token with its name, value, Tailwind utility class, and intended usage.
- **Token_Docs**: The markdown file `frontend/docs/design-tokens.md` that contains the Token_Table and do/don't examples.
- **Storybook**: The component development environment at `frontend/.storybook/` used to render interactive UI examples.
- **Token_Story**: A Storybook story file (`frontend/src/components/ui/design-tokens.stories.tsx`) that renders a visual token reference page.
- **Contributor**: A developer who is new to the project and has not previously worked with the Tycoon design system.
- **CONTRIBUTING.md**: The root-level contributor guide file that onboards new developers to the project.
- **Theme_Source**: The canonical token definitions in `frontend/src/app/globals.css` (`:root` block and `@theme inline` block).
- **Sync_Check**: A CI script or lint rule that verifies every token defined in Theme_Source is also documented in Token_Docs.

---

## Requirements

### Requirement 1: Token Table Documentation

**User Story:** As a Contributor, I want a single markdown file listing all design tokens, so that I can find the correct token name and value without reading source CSS.

#### Acceptance Criteria

1. THE Token_Docs SHALL contain a Token_Table with columns: Token Name, CSS Variable, Value (light mode), Tailwind Utility Class, and Usage Description.
2. THE Token_Table SHALL include every Design_Token currently defined in the Theme_Source, covering the categories: color, typography (font family), and any spacing or radius tokens added in future.
3. WHEN a Design_Token is added to Theme_Source, THE Token_Docs SHALL be updated to include the new token in the Token_Table before the change is merged.
4. THE Token_Docs SHALL document the following tokens at minimum: `--tycoon-bg`, `--tycoon-accent`, `--tycoon-border`, `--tycoon-text`, `--tycoon-card-bg`, `--background`, `--foreground`, and the three font families (`font-krona`, `font-orbitron`, `font-dm-sans`).

---

### Requirement 2: Do/Don't Usage Examples

**User Story:** As a Contributor, I want concrete do/don't examples in the docs, so that I understand how to apply tokens correctly and avoid common mistakes.

#### Acceptance Criteria

1. THE Token_Docs SHALL include at least one "Do" and one "Don't" example for each token category (color, typography).
2. THE Token_Docs SHALL show "Do" examples using the Tailwind utility class form (e.g. `bg-tycoon-accent`) and "Don't" examples using hardcoded hex values (e.g. `bg-[#00F0FF]`).
3. THE Token_Docs SHALL include a complete themed-button example demonstrating how a Contributor can apply `bg-tycoon-accent`, `text-tycoon-bg`, and `rounded-md` to produce a correctly styled button using tokens alone.
4. WHEN a "Don't" example is shown, THE Token_Docs SHALL include a one-sentence explanation of why the pattern is discouraged.

---

### Requirement 3: Storybook Token Reference Story

**User Story:** As a Contributor, I want a visual token reference in Storybook, so that I can see rendered color swatches and typography samples alongside token names.

#### Acceptance Criteria

1. THE Token_Story SHALL render a color swatch for each color Design_Token, displaying the token name, CSS variable, hex value, and Tailwind utility class.
2. THE Token_Story SHALL render a typography sample for each font family token, showing the font name and a sample string rendered in that font.
3. WHEN the Token_Story is viewed in Storybook, THE Token_Story SHALL read token values from the live CSS custom properties so that the displayed values always reflect the current Theme_Source.
4. THE Token_Story SHALL be tagged with `autodocs` so that Storybook generates a documentation page automatically.

---

### Requirement 4: CONTRIBUTING.md Link

**User Story:** As a Contributor, I want the contributor guide to point me to the design token docs, so that I discover them during onboarding without searching.

#### Acceptance Criteria

1. THE CONTRIBUTING.md SHALL contain a section titled "Design Tokens" that links to `frontend/docs/design-tokens.md`.
2. THE CONTRIBUTING.md SHALL include a one-paragraph summary explaining what design tokens are and why contributors must use them instead of hardcoded values.
3. THE CONTRIBUTING.md SHALL link to the Storybook token reference story by its Storybook path (`Design System/Design Tokens`).

---

### Requirement 5: Sync Between Docs and Theme Source

**User Story:** As a maintainer, I want an automated check that the token docs stay in sync with the CSS source, so that the documentation never silently drifts out of date.

#### Acceptance Criteria

1. THE Sync_Check SHALL parse the token names listed in the Token_Table and compare them against the Design_Tokens defined in Theme_Source.
2. WHEN the Sync_Check detects a token present in Theme_Source but absent from Token_Docs, THE Sync_Check SHALL exit with a non-zero status code and print the name of each missing token.
3. WHEN the Sync_Check detects a token present in Token_Docs but absent from Theme_Source, THE Sync_Check SHALL exit with a non-zero status code and print the name of each stale token.
4. THE Sync_Check SHALL be runnable as a standalone script (`node scripts/check-design-tokens.mjs`) so that it can be integrated into CI without additional tooling.
5. WHEN all tokens in Theme_Source are present in Token_Docs and no stale tokens exist, THE Sync_Check SHALL exit with status code 0 and print a confirmation message.

---

### Requirement 6: New Contributor Theming Walkthrough

**User Story:** As a Contributor, I want a step-by-step walkthrough in the docs showing how to theme a button from scratch, so that I can validate my understanding of the token system end-to-end.

#### Acceptance Criteria

1. THE Token_Docs SHALL include a "Theming a Button" walkthrough section that guides a Contributor through selecting a background token, a text token, and a border-radius value to produce a styled button.
2. THE walkthrough SHALL reference only tokens defined in the Token_Table and Tailwind utility classes derived from Theme_Source.
3. WHEN a Contributor follows the walkthrough steps exactly, THE resulting button component SHALL render correctly in the browser using only token-based classes with no hardcoded color values.
4. THE walkthrough SHALL include the final code snippet a Contributor can copy directly into a component file.
