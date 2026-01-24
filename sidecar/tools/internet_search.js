import { tool } from "@langchain/core/tools";
import { z } from "zod";

export function createInternetSearchTool({ tavilyApiKey, requestId, emitStatus }) {
  const notify = (stage, detail) => {
    if (typeof emitStatus === "function") {
      emitStatus({
        stage,
        tool: "internet_search",
        detail,
        requestId,
      });
    }
  };

  return tool(
    async ({
      query,
      maxResults = 5,
      topic = "general",
    }) => {
      notify("tool_start", { query, maxResults, topic });
      console.error(JSON.stringify({ event: "tavily_search_query", query, maxResults, topic }));
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tavilyApiKey}`,
        },
        body: JSON.stringify({
          query,
          search_depth: "advanced",
          max_results: maxResults,
          topic,
        }),
      });
      const text = await response.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text };
      }

      if (!response.ok) {
        console.error(
          JSON.stringify({
            event: "tavily_search_error",
            status: response.status,
            body: payload,
          })
        );
        notify("tool_error", { status: response.status });
        throw new Error(`Tavily request failed with status ${response.status}`);
      }

      const result = {
        answer: payload?.answer ?? null,
        results: payload?.results ?? [],
      };
      console.error(JSON.stringify({ event: "tavily_search_result", result }));
      notify("tool_end", { status: response.status });
      return result;
    },
    {
      name: "internet_search",
      description:
        "Search the internet for current information. Use this when you need to find up-to-date information, news, or facts that may not be in your training data.",
      schema: z.object({
        query: z.string().describe("The search query"),
        maxResults: z.number().optional().default(5).describe("Maximum number of results to return"),
        topic: z
          .enum(["general", "news", "finance"])
          .optional()
          .default("general")
          .describe("The topic category for the search"),
      }),
    }
  );
}
