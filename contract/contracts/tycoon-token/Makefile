default: build

all: test

test: build
	cargo test

build:
	stellar contract build
	@ls -l target/wasm32-unknown-unknown/release/*.wasm

fmt:
	cargo fmt --all

clean:
	cargo clean

install:
	stellar contract install --wasm target/wasm32-unknown-unknown/release/tycoon_token.wasm

deploy:
	stellar contract deploy --wasm target/wasm32-unknown-unknown/release/tycoon_token.wasm
