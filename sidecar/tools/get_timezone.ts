import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolContext, createNotifier } from "./types.js";

export function createGetTimezoneTool({ requestId, emitStatus }: ToolContext) {
  const notify = createNotifier("get_timezone", emitStatus, requestId);

  return tool(
    async () => {
      notify("tool_start");
      const now = new Date();
      const result = {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offsetMinutes: -now.getTimezoneOffset(),
      };
      notify("tool_end");
      return result;
    },
    {
      name: "get_timezone",
      description: "Get the local IANA timezone and current offset in minutes.",
      schema: z.object({}),
    }
  );
}
