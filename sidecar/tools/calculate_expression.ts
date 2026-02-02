import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolContext, createNotifier } from "./types.js";

const SAFE_EXPRESSION = /^[0-9+\-*/().\s^%]+$/;

function safeEval(expression: string): number {
  const trimmed = expression.trim();
  if (!trimmed || !SAFE_EXPRESSION.test(trimmed)) {
    throw new Error("Expression contains unsupported characters.");
  }
  const normalized = trimmed.replace(/\^/g, "**");
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${normalized});`)();
}

export function createCalculateExpressionTool({ requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("calculate_expression", emitStatus, requestId);

  return tool(
    async ({ expression }: { expression: string }) => {
      notify("tool_start", { expression });
      const value = safeEval(expression);
      const result = { expression, value };
      notify("tool_end");
      return result;
    },
    {
      name: "calculate_expression",
      description: "Evaluate a basic math expression (+, -, *, /, %, parentheses, ^).",
      schema: z.object({
        expression: z.string().describe("Math expression to evaluate"),
      }),
    }
  );
}
