import { tool } from "@langchain/core/tools";
import { z } from "zod";
import ffmpeg from "fluent-ffmpeg";
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

const VideoOperationSchema = z.object({
  operation: z.enum([
    "trim",
    "merge",
    "extract_frames",
    "add_subtitle",
    "compress",
    "convert",
    "add_watermark",
    "get_info",
    "extract_audio",
    "resize",
    "gif",
  ]).describe("The operation to perform"),
  filePath: z.string().describe("Path to the video file (relative to workspace)"),
  outputPath: z.string().optional().describe("Output file path"),
  // Trim options
  startTime: z.string().optional().describe("Start time (HH:MM:SS or seconds)"),
  endTime: z.string().optional().describe("End time (HH:MM:SS or seconds)"),
  duration: z.number().optional().describe("Duration in seconds"),
  // Merge options
  mergeFiles: z.array(z.string()).optional().describe("Video files to merge"),
  // Frame extraction options
  frameCount: z.number().optional().describe("Number of frames to extract"),
  frameRate: z.number().optional().describe("Frames per second to extract"),
  frameOutput: z.string().optional().describe("Output pattern (e.g., 'frame_%04d.png')"),
  // Subtitle options
  subtitlePath: z.string().optional(),
  subtitleStyle: z.string().optional(),
  // Compress/convert options
  videoCodec: z.enum(["libx264", "libx265", "libvpx-vp9", "copy"]).optional(),
  audioCodec: z.enum(["aac", "mp3", "opus", "copy"]).optional(),
  videoBitrate: z.string().optional(),
  audioBitrate: z.string().optional(),
  crf: z.number().optional().describe("Constant Rate Factor (0-51, lower = better quality)"),
  preset: z.enum(["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"]).optional(),
  format: z.enum(["mp4", "webm", "mkv", "avi", "mov", "gif"]).optional(),
  // Watermark options
  watermarkPath: z.string().optional(),
  watermarkPosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"]).optional(),
  watermarkScale: z.number().optional(),
  // Resize options
  width: z.number().optional(),
  height: z.number().optional(),
  // GIF options
  gifFps: z.number().optional(),
  gifWidth: z.number().optional(),
});

export function createVideoOperationsTool({ workspaceRoot, requestId, emitStatus }) {
  const notify = (stage, detail) => {
    if (typeof emitStatus === "function") {
      emitStatus({ stage, tool: "video_operations", detail, requestId });
    }
  };

  const runFfmpeg = (command) => {
    return new Promise((resolve, reject) => {
      command
        .on("end", () => resolve(true))
        .on("error", (err) => reject(err))
        .run();
    });
  };

  return tool(
    async (params) => {
      const {
        operation,
        filePath,
        outputPath,
        startTime,
        endTime,
        duration,
        mergeFiles,
        frameCount,
        frameRate,
        frameOutput,
        subtitlePath,
        subtitleStyle,
        videoCodec,
        audioCodec,
        videoBitrate,
        audioBitrate,
        crf,
        preset,
        format,
        watermarkPath,
        watermarkPosition,
        watermarkScale,
        width,
        height,
        gifFps,
        gifWidth,
      } = params;

      notify("tool_start", { operation, filePath });

      try {
        const fullPath = resolveWorkspacePath(workspaceRoot, filePath);

        if (!fs.existsSync(fullPath) && operation !== "merge") {
          throw new Error(`File not found: ${filePath}`);
        }

        // Default output path
        const getOutputPath = (defaultExt) => {
          if (outputPath) {
            return resolveWorkspacePath(workspaceRoot, outputPath);
          }
          const ext = format ? `.${format}` : defaultExt;
          const baseName = path.basename(fullPath, path.extname(fullPath));
          const dir = path.dirname(fullPath);
          return path.join(dir, `${baseName}_${operation}${ext}`);
        };

        switch (operation) {
          case "trim": {
            const output = getOutputPath(path.extname(fullPath));
            const command = ffmpeg(fullPath);

            if (startTime) command.setStartTime(startTime);
            if (endTime) command.setDuration(endTime);
            if (duration) command.setDuration(duration);

            command.output(output).videoCodec("copy").audioCodec("copy");

            await runFfmpeg(command);

            notify("tool_end", { operation });
            return JSON.stringify({
              operation,
              input: filePath,
              output: path.relative(workspaceRoot, output),
              startTime,
              endTime,
              duration,
            }, null, 2);
          }

          case "merge": {
            if (!mergeFiles || mergeFiles.length === 0) {
              throw new Error("mergeFiles array is required");
            }

            const output = getOutputPath(".mp4");

            // Create a temporary file list for concat
            const listPath = path.join(workspaceRoot, ".temp_merge_list.txt");
            const listContent = mergeFiles
              .map((f) => `file '${resolveWorkspacePath(workspaceRoot, f)}'`)
              .join("\n");
            fs.writeFileSync(listPath, listContent);

            try {
              const command = ffmpeg()
                .input(listPath)
                .inputOptions(["-f", "concat", "-safe", "0"])
                .output(output)
                .videoCodec("copy")
                .audioCodec("copy");

              await runFfmpeg(command);
            } finally {
              fs.unlinkSync(listPath);
            }

            notify("tool_end", { operation });
            return JSON.stringify({
              operation,
              mergedFiles: mergeFiles.length,
              output: path.relative(workspaceRoot, output),
            }, null, 2);
          }

          case "extract_frames": {
            const outputPattern = frameOutput
              ? resolveWorkspacePath(workspaceRoot, frameOutput)
              : path.join(path.dirname(fullPath), "frame_%04d.png");

            const command = ffmpeg(fullPath);

            if (frameRate) {
              command.fps(frameRate);
            } else if (frameCount) {
              // Get video duration to calculate fps
              const fps = frameCount / 10; // Default 10 seconds
              command.fps(fps);
            }

            command.output(outputPattern);

            await runFfmpeg(command);

            notify("tool_end", { operation });
            return JSON.stringify({
              operation,
              input: filePath,
              outputPattern: path.relative(workspaceRoot, outputPattern),
            }, null, 2);
          }

          case "add_subtitle": {
            if (!subtitlePath) {
              throw new Error("subtitlePath is required");
            }

            const subFullPath = resolveWorkspacePath(workspaceRoot, subtitlePath);
            if (!fs.existsSync(subFullPath)) {
              throw new Error(`Subtitle file not found: ${subtitlePath}`);
            }

            const output = getOutputPath(path.extname(fullPath));
            const command = ffmpeg(fullPath)
              .outputOptions([
                `-vf subtitles='${subFullPath}'${subtitleStyle ? `:force_style='${subtitleStyle}'` : ""}`,
              ])
              .output(output);

            if (videoCodec) command.videoCodec(videoCodec);
            if (audioCodec) command.audioCodec(audioCodec);

            await runFfmpeg(command);

            notify("tool_end", { operation });
            return JSON.stringify({
              operation,
              input: filePath,
              subtitle: subtitlePath,
              output: path.relative(workspaceRoot, output),
            }, null, 2);
          }

          case "compress": {
            const output = getOutputPath(".mp4");
            const command = ffmpeg(fullPath)
              .videoCodec(videoCodec || "libx264")
              .audioCodec(audioCodec || "aac");

            if (crf) command.outputOptions([`-crf ${crf}`]);
            if (preset) command.outputOptions([`-preset ${preset}`]);
            if (videoBitrate) command.videoBitrate(videoBitrate);
            if (audioBitrate) command.audioBitrate(audioBitrate);

            command.output(output);

            const inputStat = fs.statSync(fullPath);
            await runFfmpeg(command);
            const outputStat = fs.statSync(output);

            notify("tool_end", { operation });
            return JSON.stringify({
              operation,
              input: filePath,
              output: path.relative(workspaceRoot, output),
              originalSize: inputStat.size,
              compressedSize: outputStat.size,
              reduction: `${(((inputStat.size - outputStat.size) / inputStat.size) * 100).toFixed(1)}%`,
            }, null, 2);
          }

          case "convert": {
            if (!format) {
              throw new Error("format is required for convert");
            }

            const output = getOutputPath(`.${format}`);
            const command = ffmpeg(fullPath);

            if (videoCodec) command.videoCodec(videoCodec);
            if (audioCodec) command.audioCodec(audioCodec);
            if (videoBitrate) command.videoBitrate(videoBitrate);
            if (audioBitrate) command.audioBitrate(audioBitrate);

            command.output(output);

            await runFfmpeg(command);

            notify("tool_end", { operation });
            return JSON.stringify({
              operation,
              input: filePath,
              output: path.relative(workspaceRoot, output),
              format,
            }, null, 2);
          }

          case "add_watermark": {
            if (!watermarkPath) {
              throw new Error("watermarkPath is required");
            }

            const wmFullPath = resolveWorkspacePath(workspaceRoot, watermarkPath);
            if (!fs.existsSync(wmFullPath)) {
              throw new Error(`Watermark file not found: ${watermarkPath}`);
            }

            const output = getOutputPath(path.extname(fullPath));

            // Position mapping
            const positions = {
              "top-left": "10:10",
              "top-right": "main_w-overlay_w-10:10",
              "bottom-left": "10:main_h-overlay_h-10",
              "bottom-right": "main_w-overlay_w-10:main_h-overlay_h-10",
              center: "(main_w-overlay_w)/2:(main_h-overlay_h)/2",
            };
            const pos = positions[watermarkPosition || "bottom-right"];
            const scale = watermarkScale || 0.2;

            const command = ffmpeg(fullPath)
              .input(wmFullPath)
              .complexFilter([
                `[1:v]scale=iw*${scale}:-1[wm]`,
                `[0:v][wm]overlay=${pos}`,
              ])
              .output(output);

            if (audioCodec) command.audioCodec(audioCodec);

            await runFfmpeg(command);

            notify("tool_end", { operation });
            return JSON.stringify({
              operation,
              input: filePath,
              watermark: watermarkPath,
              output: path.relative(workspaceRoot, output),
            }, null, 2);
          }

          case "get_info": {
            return new Promise((resolve) => {
              ffmpeg.ffprobe(fullPath, (err, metadata) => {
                if (err) {
                  notify("tool_error", { error: err.message });
                  resolve(`Error: ${err.message}`);
                  return;
                }

                const videoStream = metadata.streams.find((s) => s.codec_type === "video");
                const audioStream = metadata.streams.find((s) => s.codec_type === "audio");

                const info = {
                  filePath,
                  format: metadata.format.format_name,
                  duration: metadata.format.duration,
                  size: metadata.format.size,
                  bitrate: metadata.format.bit_rate,
                  video: videoStream ? {
                    codec: videoStream.codec_name,
                    width: videoStream.width,
                    height: videoStream.height,
                    fps: eval(videoStream.r_frame_rate),
                    bitrate: videoStream.bit_rate,
                  } : null,
                  audio: audioStream ? {
                    codec: audioStream.codec_name,
                    channels: audioStream.channels,
                    sampleRate: audioStream.sample_rate,
                    bitrate: audioStream.bit_rate,
                  } : null,
                };

                notify("tool_end", { operation });
                resolve(JSON.stringify(info, null, 2));
              });
            });
          }

          case "extract_audio": {
            const output = outputPath
              ? resolveWorkspacePath(workspaceRoot, outputPath)
              : fullPath.replace(path.extname(fullPath), ".mp3");

            const command = ffmpeg(fullPath)
              .noVideo()
              .audioCodec(audioCodec || "libmp3lame")
              .output(output);

            if (audioBitrate) command.audioBitrate(audioBitrate);

            await runFfmpeg(command);

            notify("tool_end", { operation });
            return JSON.stringify({
              operation,
              input: filePath,
              output: path.relative(workspaceRoot, output),
            }, null, 2);
          }

          case "resize": {
            if (!width && !height) {
              throw new Error("width or height is required");
            }

            const output = getOutputPath(path.extname(fullPath));
            const scaleFilter = width && height
              ? `scale=${width}:${height}`
              : width
                ? `scale=${width}:-2`
                : `scale=-2:${height}`;

            const command = ffmpeg(fullPath)
              .videoFilters(scaleFilter)
              .output(output);

            if (videoCodec) command.videoCodec(videoCodec);
            if (audioCodec) command.audioCodec(audioCodec);

            await runFfmpeg(command);

            notify("tool_end", { operation });
            return JSON.stringify({
              operation,
              input: filePath,
              output: path.relative(workspaceRoot, output),
              width,
              height,
            }, null, 2);
          }

          case "gif": {
            const output = outputPath
              ? resolveWorkspacePath(workspaceRoot, outputPath)
              : fullPath.replace(path.extname(fullPath), ".gif");

            const fps = gifFps || 10;
            const gifW = gifWidth || 480;

            const command = ffmpeg(fullPath);

            if (startTime) command.setStartTime(startTime);
            if (duration) command.setDuration(duration);

            command
              .complexFilter([
                `fps=${fps},scale=${gifW}:-1:flags=lanczos,split[s0][s1]`,
                "[s0]palettegen[p]",
                "[s1][p]paletteuse",
              ])
              .output(output);

            await runFfmpeg(command);

            notify("tool_end", { operation });
            return JSON.stringify({
              operation,
              input: filePath,
              output: path.relative(workspaceRoot, output),
              fps,
              width: gifW,
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
      name: "video_operations",
      description: "Comprehensive video operations using FFmpeg: trim, merge, extract frames, add subtitles, compress, convert formats, add watermark, get video info, extract audio, resize, and create GIFs.",
      schema: VideoOperationSchema,
    }
  );
}
