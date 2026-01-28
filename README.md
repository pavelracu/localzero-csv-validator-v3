Markdown

# LocalZero 🟢

**The Privacy-First Data Onboarding Engine.**  
_Process 1GB CSV files in the browser. Zero data exfiltration. Physics-bound speed._

---

## 🏗 Architecture

LocalZero is an "Infrastructure-as-Software" product. It is deployed as a static Docker container within the customer's VPC.

### The "Zero-Copy" Protocol

We do not use standard `JSON.parse`. We use a shared memory model to prevent browser crashes on large files.

1.  **Ingest:** File is loaded into a `SharedArrayBuffer` in the Main Thread.
2.  **Handshake:** A pointer to this memory is passed to the Rust Wasm worker.
3.  **Indexing:** Rust scans the bytes (SIMD) to build a `Columnar DataFrame`.
4.  **View:** React requests only the rows currently visible in the viewport.

### The Stack

*   **Core:** Rust (wasm-bindgen, arrow-lite architecture).
*   **UI:** React, Vite, TanStack Table (Virtualized).
*   **Runtime:** Nginx (Alpine/Distroless).
*   **Security:** Strict CSP, `GET`\-only API, Air-gapped logic.

---

## 🚀 Quick Start

### Prerequisites & Installation

To run LocalZero, you need Rust (Logic), Wasm-Pack (Glue), and Node (UI).
*   Rust (latest stable)
*   Node.js 20+
*   Docker

#### 1. Install Rust (The Language)
We use the latest stable version of Rust.
```bash
# MacOS / Linux
curl --proto '=https' --tlsv1.2 -sSf [https://sh.rustup.rs](https://sh.rustup.rs) | sh
# Windows
# Download and run rustup-init.exe from [https://rustup.rs/](https://rustup.rs/)
```
#### 2. Install wasm-pack
This tool compiles your Rust code into WebAssembly that the browser can understand.

```bash
# MacOS / Linux / Windows (via Cargo)
cargo install wasm-pack
```
#### 3. Install Node.js & pnpm (The Runtime)
We recommend using fnm (Fast Node Manager) to handle Node versions, and pnpm for fast, disk-efficient package management.

```bash
# 1. Install fnm (Fast Node Manager)
curl -fsSL [https://fnm.vercel.app/install](https://fnm.vercel.app/install) | bash

# 2. Install Node 20 (LTS)
fnm install 20
fnm use 20

# 3. Install pnpm (Package Manager)
npm install -g pnpm
```


### 1. Build the Physics Engine (Wasm)

```
cd core
wasm-pack build --target web --out-dir ../app/src/wasm
```

1.  Run the UI (Local Dev)

```
cd app
npm install
npm run dev
```

# App opens at http://localhost:5173

1.  Run the Full Container (Production Mode)

```
./scripts/build-container.sh
docker run -p 8080:80 localzero:latest
```

# Verify "Air Gap": Try sending a POST request to localhost:8080. It should fail (405).

🛡️ Security Model  
The "Sealed Room" Guarantee: LocalZero is designed to prove to a CISO that data cannot leave the browser.

Network Isolation: The Nginx container is configured to reject all POST, PUT, and DELETE requests. It serves static assets only.  
Memory Isolation: Data processing happens in Wasm memory. The raw CSV data never leaves the browser tab.  
Export Safety: Exports are generated client-side via StreamSaver, saving directly to the user's disk.

📂 Project Layout  
/core: The Rust library. This is where the "Mechanic" logic lives.  
/app: The React application. Handles the Virtual Scroll and UI interactions.  
/scripts: CI/CD automation scripts.

🧪 Testing  
Rust (Logic): cd core && cargo test  
Wasm (Browser): cd core && wasm-pack test --headless --firefox