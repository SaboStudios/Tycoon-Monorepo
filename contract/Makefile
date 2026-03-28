# Tycoon Soroban workspace — single entrypoint for fmt, clippy, test, and WASM release builds.
# Run from this directory: `cd contract && make <target>`
#
# CI parity:
#   • .github/workflows/ci.yml — job "Contracts" (build, wasm size check, test)
#   • .github/workflows/contract-build.yml — adds integration tests + artifact upload
#   • .github/workflows/contract-hygiene.yml — cargo fmt --check + clippy -D warnings
#
# Artifact layout (deploy / Actions):
#   • Release WASM: target/wasm32-unknown-unknown/release/*.wasm
#   • Size report:  deploy/wasm-size-report.md (after `make wasm-check`)
#   • Hash list:    deploy/wasm-hashes.txt (after `make wasm-hashes`, also generated in CI)

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

CARGO ?= cargo
WASM_TARGET := wasm32-unknown-unknown
RELEASE_WASM_DIR := target/$(WASM_TARGET)/release
DEPLOY_DIR := deploy
SCRIPTS_DIR := scripts

# Contract packages that produce WASM (integration-tests is test-only; no wasm-% target)
CONTRACT_PKGS := tycoon-main-game tycoon-game tycoon-token tycoon-reward-system tycoon-collectibles tycoon-boost-system tycoon-lib
# All packages that support fmt / clippy / test via -p
ALL_PKGS := $(CONTRACT_PKGS) tycoon-integration-tests

.DEFAULT_GOAL := help

.PHONY: help
help:
	@echo "Tycoon contracts — Makefile targets"
	@echo ""
	@echo "  Quickstart (new devs):"
	@echo "    make dev              fmt + clippy + test + release WASM (local verification)"
	@echo ""
	@echo "  CI — matches GitHub Actions commands exactly:"
	@echo "    make hygiene            = contract-hygiene.yml: fmt --check + clippy -D warnings"
	@echo "    make ci                 = hygiene + ci.yml Contracts job: build-wasm, wasm-check, test"
	@echo "    make ci-full            = ci + integration tests (contract-build.yml tests)"
	@echo ""
	@echo "  Workspace:"
	@echo "    make fmt | fmt-check | clippy | clippy-deny | test | build-wasm | wasm-check | clean"
	@echo "    make test-integration   cargo test --package tycoon-integration-tests -- --nocapture"
	@echo "    make test-snapshot      run only snapshot/error-branch tests (tycoon-token)"
	@echo "    make wasm-hashes        SHA-256 list → $(DEPLOY_DIR)/wasm-hashes.txt (needs build-wasm)"
	@echo ""
	@echo "  Per crate (PACKAGE=name with hyphens, e.g. tycoon-game):"
	@echo "    make fmt-PKG  clippy-PKG  test-PKG  wasm-PKG"
	@echo ""
	@echo "  Optional:"
	@echo "    make audit              cargo-audit (install: cargo install cargo-audit)"
	@echo ""
	@echo "  Paths: release WASM → $(RELEASE_WASM_DIR)/*.wasm"
	@echo ""
	@echo "  Branch coverage checklist (tycoon-token):"
	@echo "    ✓ initialize / double-initialize"
	@echo "    ✓ mint: zero, negative, overflow, non-admin"
	@echo "    ✓ transfer: negative, zero (no-op), insufficient balance"
	@echo "    ✓ transfer_from: negative, zero (no-op), insufficient allowance/balance"
	@echo "    ✓ approve: negative, zero (clear), normal"
	@echo "    ✓ burn: zero, negative, insufficient balance"
	@echo "    ✓ burn_from: zero allowance, insufficient allowance"
	@echo "    ✓ set_admin: unauthorized"
	@echo "    ✓ pre-initialize calls (mint before init)"
	@echo "    ✓ default-value paths (balance/allowance/total_supply for unknown keys)"
	@echo "    ✓ inline snapshots: metadata, state after deterministic ops"

# --- Quickstart (README) ------------------------------------------------------

.PHONY: dev
dev: fmt clippy test build-wasm
	@echo "make dev: OK (fmt, clippy, test, release WASM)"

# --- CI (.github/workflows/ci.yml — Contracts job) ----------------------------

# Mirrors: cargo build --target wasm32-unknown-unknown --release
.PHONY: build-wasm
build-wasm:
	$(CARGO) build --target $(WASM_TARGET) --release

# Mirrors: bash scripts/check-wasm-sizes.sh  (requires jq)
.PHONY: wasm-check
wasm-check:
	bash $(SCRIPTS_DIR)/check-wasm-sizes.sh

# Mirrors: cargo test --all
.PHONY: test
test:
	$(CARGO) test --all

# Hygiene checks that mirror contract-hygiene.yml (fmt-check + clippy-deny)
.PHONY: hygiene
hygiene: fmt-check clippy-deny
	@echo "make hygiene: OK (fmt --check + clippy -D warnings)"

.PHONY: ci
ci: hygiene build-wasm wasm-check test
	@echo "make ci: OK (hygiene + build + wasm-check + test)"

# --- contract-build.yml extra test step -------------------------------------

# Mirrors: cargo test --package tycoon-integration-tests -- --nocapture
.PHONY: test-integration
test-integration:
	$(CARGO) test --package tycoon-integration-tests -- --nocapture

# Run only the snapshot and error-branch tests for tycoon-token.
# Useful for quick regression checks after token logic changes.
.PHONY: test-snapshot
test-snapshot:
	$(CARGO) test --package tycoon-token error_branch_tests -- --nocapture

.PHONY: ci-full
ci-full: build-wasm wasm-check test test-integration
	@echo "make ci-full: OK (ci.yml + integration tests from contract-build.yml)"

# --- Workspace-wide quality (not separate jobs in CI, but standard locally) ---

.PHONY: fmt
fmt:
	$(CARGO) fmt --all

# CI-safe: fails if any file is not cargo fmt-clean
.PHONY: fmt-check
fmt-check:
	$(CARGO) fmt --all -- --check

.PHONY: clippy
clippy:
	$(CARGO) clippy --workspace --all-targets

# CI-safe: treats every warning as a hard error
.PHONY: clippy-deny
clippy-deny:
	$(CARGO) clippy --workspace --all-targets -- -D warnings

# --- Per-crate targets (pattern %) --------------------------------------------

.PHONY: fmt-% clippy-% test-% wasm-%
fmt-%:
	@if [[ ! " $(ALL_PKGS) " =~ " $* " ]]; then echo "Unknown package: $*"; echo "Expected one of: $(ALL_PKGS)"; exit 1; fi
	$(CARGO) fmt -p $*

clippy-%:
	@if [[ ! " $(ALL_PKGS) " =~ " $* " ]]; then echo "Unknown package: $*"; echo "Expected one of: $(ALL_PKGS)"; exit 1; fi
	$(CARGO) clippy -p $* --all-targets

test-%:
	@if [[ ! " $(ALL_PKGS) " =~ " $* " ]]; then echo "Unknown package: $*"; echo "Expected one of: $(ALL_PKGS)"; exit 1; fi
	$(CARGO) test -p $*

wasm-%:
	@if [[ ! " $(CONTRACT_PKGS) " =~ " $* " ]]; then echo "Unknown package for WASM: $*"; echo "Expected one of: $(CONTRACT_PKGS)"; exit 1; fi
	$(CARGO) build -p $* --target $(WASM_TARGET) --release

# --- Deploy-oriented artifacts (local parity with pipeline) ------------------

.PHONY: wasm-hashes
wasm-hashes: build-wasm
	@mkdir -p $(DEPLOY_DIR)
	@{ echo "# WASM SHA-256 Hashes (local make wasm-hashes)"; \
	echo "# Generated: $$(date -u +%Y-%m-%dT%H:%M:%SZ)"; echo ""; \
	find target -name "*.wasm" -path "*/release/*" | sort | while read -r WASM; do \
	  NAME=$$(basename "$$WASM"); \
	  HASH=$$(sha256sum "$$WASM" | awk '{print $$1}'); \
	  echo "$$HASH  $$NAME"; \
	done; } > $(DEPLOY_DIR)/wasm-hashes.txt
	@echo "Wrote $(DEPLOY_DIR)/wasm-hashes.txt"
	@cat $(DEPLOY_DIR)/wasm-hashes.txt

# --- Optional audit -----------------------------------------------------------

.PHONY: audit
audit:
	@command -v cargo-audit >/dev/null 2>&1 || { echo "Install cargo-audit: cargo install cargo-audit"; exit 1; }
	cargo audit

# --- Clean (phony) ------------------------------------------------------------

.PHONY: clean
clean:
	$(CARGO) clean
