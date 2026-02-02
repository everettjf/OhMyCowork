import { tool } from "@langchain/core/tools";
import { z } from "zod";
import sharp from "sharp";
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

const ImageOperationSchema = z.object({
  operation: z.enum([
    "resize",
    "crop",
    "convert",
    "compress",
    "rotate",
    "flip",
    "blur",
    "sharpen",
    "grayscale",
    "tint",
    "watermark",
    "get_info",
    "thumbnail",
    "composite",
  ]).describe("The operation to perform"),
  filePath: z.string().describe("Path to the image file (relative to workspace)"),
  outputPath: z.string().optional().describe("Output file path"),
  // Resize options
  width: z.number().optional(),
  height: z.number().optional(),
  fit: z.enum(["cover", "contain", "fill", "inside", "outside"]).optional(),
  // Crop options
  cropLeft: z.number().optional(),
  cropTop: z.number().optional(),
  cropWidth: z.number().optional(),
  cropHeight: z.number().optional(),
  // Convert options
  format: z.enum(["jpeg", "png", "webp", "avif", "gif", "tiff"]).optional(),
  // Compress options
  quality: z.number().optional().describe("Quality 1-100 for JPEG/WebP"),
  // Rotate options
  angle: z.number().optional(),
  // Flip options
  flipDirection: z.enum(["horizontal", "vertical", "both"]).optional(),
  // Blur options
  blurSigma: z.number().optional().describe("Blur sigma (0.3-1000)"),
  // Sharpen options
  sharpenSigma: z.number().optional(),
  // Tint options
  tintColor: z.object({
    r: z.number(),
    g: z.number(),
    b: z.number(),
  }).optional(),
  // Watermark options
  watermarkText: z.string().optional(),
  watermarkPosition: z.enum(["center", "top-left", "top-right", "bottom-left", "bottom-right"]).optional(),
  watermarkOpacity: z.number().optional(),
  // Composite options
  overlayPath: z.string().optional(),
  overlayPosition: z.object({
    left: z.number().optional(),
    top: z.number().optional(),
  }).optional(),
  // Batch options
  batchFiles: z.array(z.string()).optional().describe("Multiple files to process"),
});

export function createImageOperationsTool({ workspaceRoot, requestId, emitStatus }) {
  const notify = (stage, detail) => {
    if (typeof emitStatus === "function") {
      emitStatus({ stage, tool: "image_operations", detail, requestId });
    }
  };

  return tool(
    async (params) => {
      const {
        operation,
        filePath,
        outputPath,
        width,
        height,
        fit,
        cropLeft,
        cropTop,
        cropWidth,
        cropHeight,
        format,
        quality,
        angle,
        flipDirection,
        blurSigma,
        sharpenSigma,
        tintColor,
        watermarkText,
        watermarkPosition,
        watermarkOpacity,
        overlayPath,
        overlayPosition,
        batchFiles,
      } = params;

      notify("tool_start", { operation, filePath });

      try {
        const fullPath = resolveWorkspacePath(workspaceRoot, filePath);

        // Handle batch processing
        const filesToProcess = batchFiles && batchFiles.length > 0
          ? batchFiles.map((f) => resolveWorkspacePath(workspaceRoot, f))
          : [fullPath];

        const results = [];

        for (const inputPath of filesToProcess) {
          if (!fs.existsSync(inputPath)) {
            results.push({ file: path.relative(workspaceRoot, inputPath), error: "File not found" });
            continue;
          }

          const inputRelative = path.relative(workspaceRoot, inputPath);
          let image = sharp(inputPath);

          switch (operation) {
            case "resize":
              if (!width && !height) {
                throw new Error("width or height is required for resize");
              }
              image = image.resize(width, height, {
                fit: fit || "cover",
                withoutEnlargement: true,
              });
              break;

            case "crop":
              if (!cropWidth || !cropHeight) {
                throw new Error("cropWidth and cropHeight are required");
              }
              image = image.extract({
                left: cropLeft || 0,
                top: cropTop || 0,
                width: cropWidth,
                height: cropHeight,
              });
              break;

            case "convert":
              if (!format) {
                throw new Error("format is required for convert");
              }
              image = image.toFormat(format, {
                quality: quality || 80,
              });
              break;

            case "compress":
              const metadata = await image.metadata();
              const fmt = format || metadata.format || "jpeg";
              image = image.toFormat(fmt, {
                quality: quality || 70,
                mozjpeg: fmt === "jpeg",
              });
              break;

            case "rotate":
              image = image.rotate(angle || 90);
              break;

            case "flip":
              if (flipDirection === "horizontal" || flipDirection === "both") {
                image = image.flop();
              }
              if (flipDirection === "vertical" || flipDirection === "both") {
                image = image.flip();
              }
              break;

            case "blur":
              image = image.blur(blurSigma || 5);
              break;

            case "sharpen":
              image = image.sharpen(sharpenSigma || 1);
              break;

            case "grayscale":
              image = image.grayscale();
              break;

            case "tint":
              if (tintColor) {
                image = image.tint(tintColor);
              }
              break;

            case "watermark":
              if (watermarkText) {
                const metadata = await sharp(inputPath).metadata();
                const svgWidth = metadata.width || 800;
                const svgHeight = 60;

                // Create text watermark as SVG
                const svg = `
                  <svg width="${svgWidth}" height="${svgHeight}">
                    <text
                      x="50%"
                      y="50%"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      font-family="Arial"
                      font-size="24"
                      fill="rgba(255,255,255,${watermarkOpacity || 0.5})"
                      stroke="rgba(0,0,0,0.3)"
                      stroke-width="1"
                    >${watermarkText}</text>
                  </svg>
                `;

                const watermarkBuffer = Buffer.from(svg);

                let gravity = "center";
                switch (watermarkPosition) {
                  case "top-left": gravity = "northwest"; break;
                  case "top-right": gravity = "northeast"; break;
                  case "bottom-left": gravity = "southwest"; break;
                  case "bottom-right": gravity = "southeast"; break;
                  default: gravity = "center";
                }

                image = image.composite([{
                  input: watermarkBuffer,
                  gravity,
                }]);
              }
              break;

            case "thumbnail":
              image = image.resize(width || 200, height || 200, {
                fit: "cover",
                position: "attention", // Smart crop
              });
              break;

            case "composite":
              if (overlayPath) {
                const overlayFullPath = resolveWorkspacePath(workspaceRoot, overlayPath);
                if (fs.existsSync(overlayFullPath)) {
                  image = image.composite([{
                    input: overlayFullPath,
                    left: overlayPosition?.left || 0,
                    top: overlayPosition?.top || 0,
                  }]);
                }
              }
              break;

            case "get_info":
              const info = await sharp(inputPath).metadata();
              results.push({
                file: inputRelative,
                info: {
                  width: info.width,
                  height: info.height,
                  format: info.format,
                  space: info.space,
                  channels: info.channels,
                  depth: info.depth,
                  density: info.density,
                  hasAlpha: info.hasAlpha,
                  orientation: info.orientation,
                  size: fs.statSync(inputPath).size,
                },
              });
              continue; // Skip saving for get_info
          }

          // Determine output path
          let output;
          if (outputPath && filesToProcess.length === 1) {
            output = resolveWorkspacePath(workspaceRoot, outputPath);
          } else {
            const ext = format
              ? `.${format}`
              : path.extname(inputPath);
            const baseName = path.basename(inputPath, path.extname(inputPath));
            const dir = path.dirname(inputPath);
            output = path.join(dir, `${baseName}_${operation}${ext}`);
          }

          // Save the image
          await image.toFile(output);

          const outputStat = fs.statSync(output);
          const inputStat = fs.statSync(inputPath);

          results.push({
            file: inputRelative,
            output: path.relative(workspaceRoot, output),
            originalSize: inputStat.size,
            newSize: outputStat.size,
            reduction: operation === "compress"
              ? `${(((inputStat.size - outputStat.size) / inputStat.size) * 100).toFixed(1)}%`
              : undefined,
          });
        }

        notify("tool_end", { operation, processed: results.length });
        return JSON.stringify({ operation, results }, null, 2);
      } catch (error) {
        notify("tool_error", { error: error.message });
        return `Error: ${error.message}`;
      }
    },
    {
      name: "image_operations",
      description: "Comprehensive image operations: resize, crop, convert formats, compress, rotate, flip, blur, sharpen, grayscale, tint, add watermarks, create thumbnails, composite images, and get image info. Supports batch processing.",
      schema: ImageOperationSchema,
    }
  );
}
