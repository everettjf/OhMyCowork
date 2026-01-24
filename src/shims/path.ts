const splitPath = (input: string) => input.split(/[/\\\\]+/).filter(Boolean);

export const basename = (input: string) => {
  const parts = splitPath(input);
  return parts.length ? parts[parts.length - 1] : "";
};

export const dirname = (input: string) => {
  const parts = splitPath(input);
  if (parts.length <= 1) return "/";
  return `/${parts.slice(0, -1).join("/")}`;
};

export const join = (...segments: string[]) =>
  segments
    .flatMap((segment) => splitPath(segment))
    .join("/")
    .replace(/^/, "/");

export const isAbsolute = (input: string) => input.startsWith("/");

export const sep = "/";
export const delimiter = ":";

export const posix = {
  basename,
  dirname,
  join,
  isAbsolute,
  sep,
  delimiter,
};

export default {
  basename,
  dirname,
  join,
  isAbsolute,
  sep,
  delimiter,
  posix,
};

export const win32 = posix;
