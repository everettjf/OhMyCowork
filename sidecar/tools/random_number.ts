import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolContext, createNotifier } from "./types.js";

export function createRandomNumberTool({ requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("random_number", emitStatus, requestId);

  return tool(
    async ({ min = 0, max = 1, decimals = 0 }) => {
      notify("tool_start", { min, max, decimals });
      const low = Math.min(min, max);
      const high = Math.max(min, max);
      const factor = 10 ** Math.max(0, Math.min(6, decimals));
      const value = Math.floor((Math.random() * (high - low) + low) * factor) / factor;
      const result = { value, min: low, max: high, decimals: Math.max(0, Math.min(6, decimals)) };
      notify("tool_end", result);
      return result;
    },
    {
      name: "random_number",
      description: "Generate a random number between min and max with optional decimals.",
      schema: z.object({
        min: z.number().optional().default(0).describe("Minimum value"),
        max: z.number().optional().default(1).describe("Maximum value"),
        decimals: z.number().optional().default(0).describe("Decimal places (0-6)"),
      }),
    }
  );
}
