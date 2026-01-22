import type {
  BackendProtocol,
  EditResult,
  FileDownloadResponse,
  FileInfo,
  FileUploadResponse,
  GrepMatch,
  WriteResult,
} from "deepagents";

export class NoopBackend implements BackendProtocol {
  async lsInfo(_path: string): Promise<FileInfo[]> {
    return [];
  }

  async read(_filePath: string, _offset?: number, _limit?: number): Promise<string> {
    return "Error: Filesystem access is not available in this runtime.";
  }

  async grepRaw(
    _pattern: string,
    _path?: string | null,
    _glob?: string | null
  ): Promise<GrepMatch[] | string> {
    return "Error: Filesystem access is not available in this runtime.";
  }

  async globInfo(_pattern: string, _path?: string): Promise<FileInfo[]> {
    return [];
  }

  async write(_filePath: string, _content: string): Promise<WriteResult> {
    return { error: "permission_denied", filesUpdate: null };
  }

  async edit(
    _filePath: string,
    _oldString: string,
    _newString: string,
    _replaceAll?: boolean
  ): Promise<EditResult> {
    return { error: "permission_denied", filesUpdate: null, occurrences: 0 };
  }

  async uploadFiles(
    files: Array<[string, Uint8Array]>
  ): Promise<FileUploadResponse[]> {
    return files.map(([path]) => ({ path, error: "permission_denied" }));
  }

  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    return paths.map((path) => ({
      path,
      content: null,
      error: "permission_denied",
    }));
  }
}
