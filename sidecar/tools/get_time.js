import { tool } from "@langchain/core/tools";
import { z } from "zod";

export function createGetTimeTool({ requestId, emitStatus }) {
  const notify = (stage, detail) => {
    if (typeof emitStatus === "function") {
      emitStatus({ stage, tool: "get_time", detail, requestId });
    }
  };

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
