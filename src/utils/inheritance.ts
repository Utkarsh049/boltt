import { Project, Folder } from "../store/projectsStore";
import { BoltRequest, AuthConfig, KeyValue } from "../store/requestStore";

export interface FolderAncestry {
  project: Project;
  folderChain: Folder[];
}

export interface EffectiveAuthResult {
  effectiveAuth: AuthConfig;
  inheritedFromFolderName?: string;
}

export interface EffectiveHeadersResult {
  effectiveHeaders: KeyValue[];
  inheritedHeaders: KeyValue[];
}

export interface RequestInheritanceResult {
  effectiveAuth: AuthConfig;
  effectiveHeaders: KeyValue[];
  inheritedFromFolderName?: string;
  inheritedHeaders: KeyValue[];
}

/**
 * Searches all projects and folder hierarchies to find the ancestry chain
 * (root folder down to immediate parent folder) for a given saved request ID.
 */
export const findFolderAncestry = (
  projects: Project[],
  requestId: string
): FolderAncestry | null => {
  if (!requestId || !projects || projects.length === 0) return null;

  for (const project of projects) {
    const searchInFolders = (folders: Folder[], currentChain: Folder[]): FolderAncestry | null => {
      for (const folder of folders) {
        const nextChain = [...currentChain, folder];

        // Check if request is directly inside this folder
        if (folder.requests && folder.requests.some((r) => r.id === requestId)) {
          return { project, folderChain: nextChain };
        }

        // Search subfolders recursively
        if (folder.subfolders && folder.subfolders.length > 0) {
          const found = searchInFolders(folder.subfolders, nextChain);
          if (found) return found;
        }
      }
      return null;
    };

    const result = searchInFolders(project.folders, []);
    if (result) return result;
  }

  return null;
};

/**
 * Traverses upward through ancestor folders (nearest parent up to root)
 * to resolve effective authentication when request auth is set to "Inherit".
 */
export const resolveEffectiveAuth = (
  requestAuth: AuthConfig,
  folderChain: Folder[]
): EffectiveAuthResult => {
  // If explicitly set to Bearer or Basic, or explicitly disabled (None)
  if (requestAuth.type !== "Inherit") {
    return { effectiveAuth: requestAuth };
  }

  // Traverse upward from the nearest parent folder to the root
  for (let i = folderChain.length - 1; i >= 0; i--) {
    const folder = folderChain[i];
    if (folder.auth && folder.auth.type !== "None" && folder.auth.type !== "Inherit") {
      return {
        effectiveAuth: folder.auth,
        inheritedFromFolderName: folder.name,
      };
    }
  }

  // Fallback to None if no ancestor provides auth
  return { effectiveAuth: { type: "None" } };
};

/**
 * Cascades headers downward from root folder to immediate folder,
 * and merges them with request-level headers.
 * Lower levels and request-level headers override higher-level headers with matching keys.
 */
export const resolveEffectiveHeaders = (
  requestHeaders: KeyValue[],
  folderChain: Folder[]
): EffectiveHeadersResult => {
  // Case-insensitive map for inherited headers
  const inheritedMap = new Map<string, KeyValue>();

  // Cascade from root folder downwards to nearest folder
  for (const folder of folderChain) {
    if (folder.headers && Array.isArray(folder.headers)) {
      for (const header of folder.headers) {
        const cleanKey = header.key.trim().toLowerCase();
        if (cleanKey) {
          inheritedMap.set(cleanKey, { ...header });
        }
      }
    }
  }

  const inheritedHeaders = Array.from(inheritedMap.values());

  // Merge request headers (request headers override matching inherited headers)
  const effectiveMap = new Map<string, KeyValue>();
  for (const [key, val] of inheritedMap.entries()) {
    effectiveMap.set(key, { ...val });
  }

  for (const header of requestHeaders) {
    const cleanKey = header.key.trim().toLowerCase();
    if (cleanKey) {
      effectiveMap.set(cleanKey, { ...header });
    }
  }

  return {
    effectiveHeaders: Array.from(effectiveMap.values()),
    inheritedHeaders,
  };
};

/**
 * High-level helper to resolve effective Auth and cascaded Headers
 * for any request, whether standalone or part of a folder tree.
 */
export const resolveRequestInheritance = (
  projects: Project[],
  requestId: string | null,
  activeRequest: BoltRequest
): RequestInheritanceResult => {
  if (!requestId) {
    return {
      effectiveAuth: activeRequest.auth,
      effectiveHeaders: activeRequest.headers,
      inheritedHeaders: [],
    };
  }

  const ancestry = findFolderAncestry(projects, requestId);
  if (!ancestry || ancestry.folderChain.length === 0) {
    return {
      effectiveAuth: activeRequest.auth,
      effectiveHeaders: activeRequest.headers,
      inheritedHeaders: [],
    };
  }

  const authResult = resolveEffectiveAuth(activeRequest.auth, ancestry.folderChain);
  const headersResult = resolveEffectiveHeaders(activeRequest.headers, ancestry.folderChain);

  return {
    effectiveAuth: authResult.effectiveAuth,
    effectiveHeaders: headersResult.effectiveHeaders,
    inheritedFromFolderName: authResult.inheritedFromFolderName,
    inheritedHeaders: headersResult.inheritedHeaders,
  };
};

