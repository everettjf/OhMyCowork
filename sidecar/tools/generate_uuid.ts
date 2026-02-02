import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolContext, createNotifier } from "./types.js";

export function createGenerateUuidTool({ requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("generate_uuid", emitStatus, requestId);

  return tool(
    async () => {
      notify("tool_start");
      const result = { uuid: crypto.randomUUID() };
      notify("tool_end");
      return result;
    },
    {
      name: "generate_uuid",
      description: "Generate a UUID v4.",
      schema: z.object({}),
    }
  );
}
