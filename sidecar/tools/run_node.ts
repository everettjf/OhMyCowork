import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execFile, ExecFileException } from "node:child_process";
import { ToolContext, createNotifier } from "./types.js";

const MAX_BUFFER_BYTES = 1024 * 1024;

export function createRunNodeTool({ requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("run_node", emitStatus, requestId);

  return tool(
    async ({ code, timeoutMs = 5000 }: { code: string; timeoutMs?: number }) => {
      notify("tool_start", { timeoutMs });
      const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        // execFile avoids shell interpolation for safety.
        execFile(
          "node",
          ["-e", code],
          { timeout: timeoutMs, maxBuffer: MAX_BUFFER_BYTES },
          (error: ExecFileException | null, stdout: string, stderr: string) => {
            if (error) {
              const details = {
                message: error.message,
                code: error.code ?? null,
                signal: error.signal ?? null,
                stdout,
                stderr,
              };
              return reject(new Error(JSON.stringify(details)));
            }
            return resolve({ stdout, stderr });
          }
        );
      });
      notify("tool_end");
      return result;
    },
    {
      name: "run_node",
      description: "Execute a short Node.js script and return stdout/stderr. Use for quick calculations or transformations.",
      schema: z.object({
        code: z.string().describe("JavaScript code to run with node -e"),
        timeoutMs: z.number().optional().default(5000).describe("Execution timeout in milliseconds"),
      }),
    }
  );
}
