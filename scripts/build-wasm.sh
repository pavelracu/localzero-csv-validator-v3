#!/bin/bash
set -e

echo "🦀 Building Rust Core for Web..."

# 1. Compile Rust to Wasm
# We output to a temporary 'pkg' folder first
cd core
wasm-pack build --target web --out-dir ../app/src/wasm --out-name localzero_core

echo "✅ Wasm compiled successfully to app/src/wasm"