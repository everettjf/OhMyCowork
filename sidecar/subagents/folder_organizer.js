import { createOrganizeFolderTool } from "../tools/index.js";

export function createFolderOrganizerSubagent({ model, workspaceRoot, requestId, emitStatus }) {
  return {
    name: "folder-organizer",
    description:
      "Organize a folder into clean category-based subfolders using consistent naming and safe moves.",
    model,
    tools: [
      createOrganizeFolderTool({
        workspaceRoot,
        requestId,
        emitStatus,
      }),
    ],
    systemPrompt: `You are a folder organization specialist.

Rules:
- Use the "organize_folder" tool to reorganize the requested folder.
- Organize by file type into category folders: Documents, Images, Video, Audio, Archives, Code, Data, Design, Fonts, Config, Other.
- Do not ask follow-up questions; pick safe defaults.
- Keep existing folders unless the tool moves files into new categories.
- Report a concise summary of moved files and any errors.`,
  };
}
