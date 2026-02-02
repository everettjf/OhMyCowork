// @ts-nocheck
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as cheerio from "cheerio";
import Parser from "rss-parser";
import fs from "node:fs";
import path from "node:path";

function resolveWorkspacePath(workspaceRoot, targetPath) {
  const cleaned = targetPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolute = path.resolve(workspaceRoot, cleaned);
  const relative = path.relative(workspaceRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes workspace root.");
  }
  return absolute;
}

const WebOperationSchema = z.object({
  operation: z.enum([
    "http_request",
    "parse_html",
    "extract_links",
    "extract_text",
    "parse_rss",
    "download_file",
    "parse_json_api",
  ]).describe("The operation to perform"),
  url: z.string().optional().describe("URL to fetch"),
  // HTTP request options
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  // HTML parsing options
  html: z.string().optional().describe("HTML content to parse"),
  selector: z.string().optional().describe("CSS selector"),
  attribute: z.string().optional().describe("Attribute to extract"),
  // Download options
  outputPath: z.string().optional(),
  // RSS options
  rssLimit: z.number().optional().describe("Limit number of RSS items"),
});

export function createWebOperationsTool({ workspaceRoot, requestId, emitStatus }) {
  const notify = (stage, detail) => {
    if (typeof emitStatus === "function") {
      emitStatus({ stage, tool: "web_operations", detail, requestId });
    }
  };

  return tool(
    async (params) => {
      const {
        operation,
        url,
        method,
        headers,
        body,
        html,
        selector,
        attribute,
        outputPath,
        rssLimit,
      } = params;

      notify("tool_start", { operation, url });

      try {
        switch (operation) {
          case "http_request": {
            if (!url) {
              throw new Error("url is required");
            }

            const fetchOptions = {
              method: method || "GET",
              headers: headers || {},
            };

            if (body && method !== "GET") {
              if (typeof body === "object") {
                fetchOptions.body = JSON.stringify(body);
                fetchOptions.headers["Content-Type"] = fetchOptions.headers["Content-Type"] || "application/json";
              } else {
                fetchOptions.body = body;
              }
            }

            const response = await fetch(url, fetchOptions);
            const contentType = response.headers.get("content-type") || "";

            let responseBody;
            if (contentType.includes("application/json")) {
              responseBody = await response.json();
            } else {
              responseBody = await response.text();
              if (responseBody.length > 10000) {
                responseBody = responseBody.slice(0, 10000) + "... [truncated]";
              }
            }

            notify("tool_end", { operation });
            return JSON.stringify({
              url,
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              body: responseBody,
            }, null, 2);
          }

          case "parse_html": {
            let htmlContent = html;
            if (!htmlContent && url) {
              const response = await fetch(url);
              htmlContent = await response.text();
            }

            if (!htmlContent) {
              throw new Error("html or url is required");
            }

            const $ = cheerio.load(htmlContent);

            if (selector) {
              const elements = $(selector);
              const results = [];

              elements.each((i, el) => {
                const $el = $(el);
                if (attribute) {
                  results.push($el.attr(attribute));
                } else {
                  results.push({
                    text: $el.text().trim(),
                    html: $el.html()?.slice(0, 500),
                    attributes: el.attribs,
                  });
                }
              });

              notify("tool_end", { operation });
              return JSON.stringify({
                selector,
                matchCount: results.length,
                results: results.slice(0, 50),
              }, null, 2);
            }

            // Return document structure
            notify("tool_end", { operation });
            return JSON.stringify({
              title: $("title").text(),
              headings: {
                h1: $("h1").map((i, el) => $(el).text()).get(),
                h2: $("h2").map((i, el) => $(el).text()).get().slice(0, 10),
              },
              links: $("a[href]").map((i, el) => ({
                text: $(el).text().trim().slice(0, 50),
                href: $(el).attr("href"),
              })).get().slice(0, 20),
              images: $("img").map((i, el) => ({
                src: $(el).attr("src"),
                alt: $(el).attr("alt"),
              })).get().slice(0, 10),
            }, null, 2);
          }

          case "extract_links": {
            let htmlContent = html;
            if (!htmlContent && url) {
              const response = await fetch(url);
              htmlContent = await response.text();
            }

            if (!htmlContent) {
              throw new Error("html or url is required");
            }

            const $ = cheerio.load(htmlContent);
            const links = [];
            const baseUrl = url ? new URL(url) : null;

            $("a[href]").each((i, el) => {
              const href = $(el).attr("href");
              const text = $(el).text().trim();

              if (href) {
                let absoluteUrl = href;
                if (baseUrl && !href.startsWith("http")) {
                  try {
                    absoluteUrl = new URL(href, baseUrl).href;
                  } catch {
                    absoluteUrl = href;
                  }
                }

                links.push({
                  text: text.slice(0, 100),
                  href: absoluteUrl,
                  isExternal: baseUrl ? !absoluteUrl.startsWith(baseUrl.origin) : null,
                });
              }
            });

            notify("tool_end", { operation });
            return JSON.stringify({
              source: url || "provided html",
              totalLinks: links.length,
              links: links.slice(0, 100),
            }, null, 2);
          }

          case "extract_text": {
            let htmlContent = html;
            if (!htmlContent && url) {
              const response = await fetch(url);
              htmlContent = await response.text();
            }

            if (!htmlContent) {
              throw new Error("html or url is required");
            }

            const $ = cheerio.load(htmlContent);

            // Remove script and style elements
            $("script, style, noscript, iframe").remove();

            // Get text from body or specific selector
            const targetSelector = selector || "body";
            const text = $(targetSelector)
              .text()
              .replace(/\s+/g, " ")
              .trim();

            notify("tool_end", { operation });
            return JSON.stringify({
              source: url || "provided html",
              selector: targetSelector,
              textLength: text.length,
              text: text.slice(0, 10000),
            }, null, 2);
          }

          case "parse_rss": {
            if (!url) {
              throw new Error("url is required for RSS parsing");
            }

            const parser = new Parser();
            const feed = await parser.parseURL(url);

            const items = feed.items.slice(0, rssLimit || 20).map((item) => ({
              title: item.title,
              link: item.link,
              pubDate: item.pubDate,
              creator: item.creator,
              content: item.contentSnippet?.slice(0, 300),
              categories: item.categories,
            }));

            notify("tool_end", { operation });
            return JSON.stringify({
              feedTitle: feed.title,
              feedLink: feed.link,
              feedDescription: feed.description,
              lastBuildDate: feed.lastBuildDate,
              itemCount: feed.items.length,
              items,
            }, null, 2);
          }

          case "download_file": {
            if (!url) {
              throw new Error("url is required");
            }
            if (!outputPath) {
              throw new Error("outputPath is required");
            }

            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            const fullOutputPath = resolveWorkspacePath(workspaceRoot, outputPath);

            await fs.promises.mkdir(path.dirname(fullOutputPath), { recursive: true });
            await fs.promises.writeFile(fullOutputPath, buffer);

            notify("tool_end", { operation });
            return JSON.stringify({
              url,
              savedTo: outputPath,
              size: buffer.length,
              contentType: response.headers.get("content-type"),
            }, null, 2);
          }

          case "parse_json_api": {
            if (!url) {
              throw new Error("url is required");
            }

            const fetchOptions = {
              method: method || "GET",
              headers: {
                "Accept": "application/json",
                ...headers,
              },
            };

            if (body && method !== "GET") {
              fetchOptions.body = JSON.stringify(body);
              fetchOptions.headers["Content-Type"] = "application/json";
            }

            const response = await fetch(url, fetchOptions);
            const data = await response.json();

            // Analyze JSON structure
            const analyzeStructure = (obj, depth = 0) => {
              if (depth > 3) return "...";
              if (obj === null) return "null";
              if (Array.isArray(obj)) {
                if (obj.length === 0) return "[]";
                return `Array[${obj.length}] of ${analyzeStructure(obj[0], depth + 1)}`;
              }
              if (typeof obj === "object") {
                const keys = Object.keys(obj).slice(0, 10);
                return `{${keys.join(", ")}${Object.keys(obj).length > 10 ? ", ..." : ""}}`;
              }
              return typeof obj;
            };

            notify("tool_end", { operation });
            return JSON.stringify({
              url,
              status: response.status,
              structure: analyzeStructure(data),
              data: JSON.stringify(data).length > 10000
                ? { note: "Response too large, showing structure only", sample: JSON.stringify(data).slice(0, 2000) }
                : data,
            }, null, 2);
          }

          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      } catch (error) {
        notify("tool_error", { error: error.message });
        return `Error: ${error.message}`;
      }
    },
    {
      name: "web_operations",
      description: "Web operations: make HTTP requests, parse HTML with CSS selectors, extract links and text, parse RSS feeds, download files, and interact with JSON APIs.",
      schema: WebOperationSchema,
    }
  );
}
