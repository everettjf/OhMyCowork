import { tool } from "@langchain/core/tools";
import { z } from "zod";

export function createGetTimezoneTool({ requestId, emitStatus }) {
  const notify = (stage, detail) => {
    if (typeof emitStatus === "function") {
      emitStatus({ stage, tool: "get_timezone", detail, requestId });
    }
  };

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
