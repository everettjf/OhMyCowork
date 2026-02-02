import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolContext, createNotifier } from "./types.js";

export function createGetTimeTool({ requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("get_time", emitStatus, requestId);

  return tool(
    async () => {
      notify("tool_start");
      const now = new Date();
      const result = {
        iso: now.toISOString(),
        locale: now.toLocaleString(),
        epochMs: now.getTime(),
      };
      notify("tool_end");
      return result;
    },
    {
      name: "get_time",
      description: "Get the current local time with ISO, locale string, and epoch milliseconds.",
      schema: z.object({}),
    }
  );
}
