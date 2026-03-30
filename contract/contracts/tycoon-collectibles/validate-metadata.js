#!/usr/bin/env node
/**
 * Off-chain metadata schema validator for Tycoon Collectibles.
 * Validates that token metadata JSON passes marketplace requirements.
 *
 * Usage:
 *   node validate-metadata.js sample-metadata.json
 *   node validate-metadata.js https://api.tycoon.com/metadata/2000000001
 */

const fs = require("fs");
const https = require("https");
const http = require("http");

// ── Schema rules ────────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ["name", "description", "image"];

const VALID_DISPLAY_TYPES = ["number", "boost_number", "boost_percentage", "date"];

const VALID_IMAGE_SCHEMES = ["https://", "http://", "ipfs://", "ar://"];

const MAX_METADATA_BYTES = 100_000; // 100 KB — Blur requirement

// ── Validator ───────────────────────────────────────────────────────────────

function validate(metadata) {
  const errors = [];
  const warnings = [];

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!metadata[field] || typeof metadata[field] !== "string" || !metadata[field].trim()) {
      errors.push(`Missing or empty required field: "${field}"`);
    }
  }

  // Image URL scheme
  if (metadata.image) {
    const hasValidScheme = VALID_IMAGE_SCHEMES.some((s) => metadata.image.startsWith(s));
    if (!hasValidScheme) {
      errors.push(`"image" must start with one of: ${VALID_IMAGE_SCHEMES.join(", ")}`);
    }
  }

  // animation_url — optional but must be a string if present
  if (metadata.animation_url !== undefined && typeof metadata.animation_url !== "string") {
    errors.push('"animation_url" must be a string');
  }

  // external_url — optional but must be a string if present
  if (metadata.external_url !== undefined && typeof metadata.external_url !== "string") {
    errors.push('"external_url" must be a string');
  }

  // Attributes
  if (metadata.attributes !== undefined) {
    if (!Array.isArray(metadata.attributes)) {
      errors.push('"attributes" must be an array');
    } else {
      metadata.attributes.forEach((attr, i) => {
        if (!attr.trait_type || typeof attr.trait_type !== "string") {
          errors.push(`attributes[${i}]: missing or invalid "trait_type"`);
        }
        if (attr.value === undefined || attr.value === null) {
          errors.push(`attributes[${i}]: missing "value"`);
        }
        if (attr.display_type !== undefined) {
          if (!VALID_DISPLAY_TYPES.includes(attr.display_type)) {
            errors.push(
              `attributes[${i}]: invalid display_type "${attr.display_type}". Valid: ${VALID_DISPLAY_TYPES.join(", ")}`
            );
          }
          // When display_type is "number", value should be numeric
          if (attr.display_type === "number" && typeof attr.value !== "number") {
            warnings.push(
              `attributes[${i}]: display_type is "number" but value "${attr.value}" is not a number — some marketplaces may reject this`
            );
          }
        }
      });
    }
  } else {
    warnings.push('"attributes" is missing — traits will not display on marketplaces');
  }

  // Size check
  const bytes = Buffer.byteLength(JSON.stringify(metadata), "utf8");
  if (bytes > MAX_METADATA_BYTES) {
    errors.push(`Metadata size ${bytes} bytes exceeds ${MAX_METADATA_BYTES} byte limit`);
  }

  return { errors, warnings, bytes };
}

// ── Runner ──────────────────────────────────────────────────────────────────

function run(metadata) {
  const { errors, warnings, bytes } = validate(metadata);

  console.log(`\nMetadata size: ${bytes} bytes`);

  if (warnings.length) {
    console.log("\n⚠  Warnings:");
    warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (errors.length) {
    console.log("\n✗  Validation FAILED:");
    errors.forEach((e) => console.log(`   - ${e}`));
    process.exit(1);
  } else {
    console.log("\n✓  Validation PASSED — metadata is marketplace-compliant");
  }
}

function fetchAndValidate(url) {
  const client = url.startsWith("https") ? https : http;
  client
    .get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          run(JSON.parse(data));
        } catch (e) {
          console.error("Failed to parse JSON:", e.message);
          process.exit(1);
        }
      });
    })
    .on("error", (e) => {
      console.error("Fetch error:", e.message);
      process.exit(1);
    });
}

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: node validate-metadata.js <file.json|url>");
  process.exit(1);
}

if (arg.startsWith("http://") || arg.startsWith("https://")) {
  fetchAndValidate(arg);
} else {
  try {
    run(JSON.parse(fs.readFileSync(arg, "utf8")));
  } catch (e) {
    console.error("Error reading file:", e.message);
    process.exit(1);
  }
}
