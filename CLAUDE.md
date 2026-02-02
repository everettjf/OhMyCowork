# OhMyCowork Project Guidelines

## Code Language Requirements

**All code in this project MUST be written in TypeScript.**

- No JavaScript (.js) files allowed in source code
- All tools in `sidecar/tools/` must be `.ts` files
- All tests in `sidecar/tests/` must be `.ts` files
- Agent code (`sidecar/agent.ts`) must be TypeScript
- Configuration files (vitest.config.ts, tsconfig.json) use TypeScript

## Project Structure

```
OhMyCowork/
├── src/              # Tauri frontend (React + TypeScript)
├── src-tauri/        # Rust backend
└── sidecar/          # Node.js sidecar (TypeScript)
    ├── tools/        # LangChain tools (TypeScript)
    ├── tests/        # Vitest tests (TypeScript)
    ├── agent.ts      # Main agent entry point
    ├── tsconfig.json # TypeScript configuration
    └── package.json  # Dependencies
```

## Sidecar Tools Architecture

All tools follow this pattern:

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolContext, createNotifier, resolveWorkspacePath } from "./types.js";

export function createXxxTool({ workspaceRoot, requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("xxx", emitStatus, requestId);

  return tool(
    async (params) => {
      notify("tool_start", { /* details */ });

      if (!workspaceRoot) {
        throw new Error("workspaceRoot is required");
      }

      try {
        // Tool implementation
        notify("tool_end");
        return result;
      } catch (error) {
        const err = error as Error;
        notify("tool_error", { error: err.message });
        return `Error: ${err.message}`;
      }
    },
    {
      name: "xxx",
      description: "Tool description",
      schema: z.object({ /* Zod schema */ }),
    }
  );
}
```

## Shared Types (types.ts)

- `ToolContext`: Interface with workspaceRoot, requestId, emitStatus
- `StatusEvent`: Event interface for tool lifecycle (tool_start, tool_end, tool_error)
- `StatusEmitter`: Function type for emitting status events
- `createNotifier`: Helper to create status notification functions
- `resolveWorkspacePath`: Security helper to ensure paths stay within workspace

## TypeScript Configuration

- Target: ES2022
- Module: NodeNext
- Strict mode enabled
- Output to `dist/` directory

## Running Tests

See [TEST.md](./TEST.md) for test instructions.
