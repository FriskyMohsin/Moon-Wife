# Maryam Local Tool Runner (Windows)

Local companion service for Maryam, binding strictly to `127.0.0.1`.

## Purpose
Enables Maryam to check system health and detect the real installation of the **OmniRoute CLI** on your local Windows laptop without simulation.

## Strict Security Rules
- **Localhost only**: Bound strictly to `127.0.0.1:48123`.
- **Predefined Tools Only**:
  - `system.health`: OS metrics, platform, memory.
  - `omniroute.status`: Checks if `omniroute` is in PATH on Windows (`where omniroute`) and verifies its executable presence.
  - `omniroute.version`: Checks `omniroute --version`.
- **Arbitrary commands blocked**: No model-generated shell/PowerShell commands are accepted.
- **Authentication**: Protected by an auto-generated token in `.runner-token`.

## Quick Start on Windows

1. Double-click `start-runner.bat`
   OR in Command Prompt / PowerShell:
   ```cmd
   cd local-runner
   node runner.js
   ```

2. The runner will output:
   ```text
   ===============================================================
               MARYAM LOCAL TOOL RUNNER (WINDOWS)
   ===============================================================
   [Service] Bound strictly to: http://127.0.0.1:48123
   [Auth Token] <YOUR-SECRET-TOKEN>
   [OmniRoute Status] ...
   ```

3. In Maryam's web UI, click **Tools** in the top bar:
   - Enter your token (or connect via relay)
   - The connection state updates to **Local Runner Connected** and shows whether OmniRoute is available!
