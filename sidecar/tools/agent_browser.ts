import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn, ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ToolContext, createNotifier } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

function resolveAgentBrowserBin(): string | null {
  const envBin = process.env.AGENT_BROWSER_BIN;
  if (envBin && fs.existsSync(envBin)) return envBin;

  const candidates = [
    path.join(process.cwd(), "node_modules", ".bin", "agent-browser"),
    path.join(REPO_ROOT, "node_modules", ".bin", "agent-browser"),
    path.join(REPO_ROOT, "node_modules", ".bin", "agent-browser.cmd"),
    path.join(REPO_ROOT, "node_modules", ".bin", "agent-browser.exe"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

interface AgentBrowserResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

export function createAgentBrowserTool({ requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("agent_browser", emitStatus, requestId);

  return tool(
    async ({
      args,
      session,
      profile,
      timeoutMs,
      cwd,
    }: {
      args: string[];
      session?: string;
      profile?: string;
      timeoutMs?: number;
      cwd?: string;
    }) => {
      const bin = resolveAgentBrowserBin() ?? "agent-browser";
      const effectiveSession = session ?? requestId ?? "default";
      const effectiveTimeout = Number.isFinite(timeoutMs) ? timeoutMs! : 120000;
      const workingDir = cwd || process.cwd();

      notify("tool_start", { args, session: effectiveSession });

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        AGENT_BROWSER_SESSION: effectiveSession,
      };
      if (profile) {
        env.AGENT_BROWSER_PROFILE = profile;
      }

      const result = await new Promise<AgentBrowserResult>((resolve, reject) => {
        const child: ChildProcess = spawn(bin, args, {
          cwd: workingDir,
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        const onData = (chunk: Buffer, target: "stdout" | "stderr") => {
          const text = chunk.toString();
          if (target === "stdout") stdout += text;
          else stderr += text;
        };

        child.stdout?.on("data", (chunk: Buffer) => onData(chunk, "stdout"));
        child.stderr?.on("data", (chunk: Buffer) => onData(chunk, "stderr"));

        const timer = setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error(`agent-browser timed out after ${effectiveTimeout}ms`));
        }, effectiveTimeout);

        child.on("error", (error: NodeJS.ErrnoException) => {
          clearTimeout(timer);
          if (error?.code === "ENOENT") {
            notify("tool_error", { reason: "binary_missing" });
            reject(
              new Error(
                "agent-browser not found. Install it (npm install -g agent-browser; agent-browser install) or set AGENT_BROWSER_BIN."
              )
            );
            return;
          }
          reject(error);
        });

        child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
          clearTimeout(timer);
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code ?? null,
            signal: signal ?? null,
          });
        });
      });

      notify("tool_end", { exitCode: result.exitCode });
      return result;
    },
    {
      name: "agent_browser",
      description:
        "Control a headless browser via the agent-browser CLI. Use to open pages, click, fill, snapshot, or screenshot. Each call runs one CLI command; use the same session to keep browser state.",
      schema: z.object({
        args: z.array(z.string()).describe("Arguments passed to agent-browser CLI, e.g. ['open', 'example.com']"),
        session: z.string().optional().describe("Browser session name (defaults to request id)"),
        profile: z.string().optional().describe("Persistent profile path for cookies/storage"),
        timeoutMs: z.number().optional().describe("Command timeout in milliseconds"),
        cwd: z.string().optional().describe("Working directory for the command"),
      }),
    }
  );
}
