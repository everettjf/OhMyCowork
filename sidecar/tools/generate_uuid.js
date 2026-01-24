import { tool } from "@langchain/core/tools";
import { z } from "zod";

export function createGenerateUuidTool({ requestId, emitStatus }) {
  const notify = (stage, detail) => {
    if (typeof emitStatus === "function") {
      emitStatus({ stage, tool: "generate_uuid", detail, requestId });
    }
  };

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
