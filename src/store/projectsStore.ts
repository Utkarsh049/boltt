import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { HttpMethod, RequestBody, AuthConfig, KeyValue } from "./requestStore";

export interface SavedRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: RequestBody;
  auth: AuthConfig;
  created_at?: number;
}

export interface Folder {
  id: string;
  name: string;
  requests: SavedRequest[];
  subfolders: Folder[];
}

export interface Project {
  id: string;
  name: string;
  folders: Folder[];
  path?: string;
}

interface ProjectsStore {
  projects: Project[];
  activeProjectId: string | null;
  activeRequestId: string | null;
  isSaveModalOpen: boolean;
  
  loadProjects: () => Promise<void>;
  createProject: (defaultName: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  saveProject: (project: Project) => Promise<void>;
  
  importProjects: () => Promise<void>;
  unmountProject: (projectId: string, path: string) => Promise<void>;
  deleteProjectFile: (projectId: string, path: string) => Promise<void>;
  openInFileExplorer: (path: string) => Promise<void>;
  
  createFolder: (projectId: string, parentFolderId: string | null, name: string) => Promise<void>;
  renameFolder: (projectId: string, folderId: string, newName: string) => Promise<void>;
  deleteFolder: (projectId: string, folderId: string) => Promise<void>;
  
  saveRequest: (projectId: string, folderId: string, request: SavedRequest) => Promise<void>;
  deleteRequest: (projectId: string, requestId: string) => Promise<void>;
  
  findRequestLocation: (requestId: string) => { projectId: string; folderId: string } | null;
  saveRequestDirectly: (activeRequest: any) => Promise<boolean>;
  
  setActiveProject: (id: string | null) => void;
  setActiveRequest: (id: string | null) => void;
  setSaveModalOpen: (isOpen: boolean) => void;
}

const addFolderRecursive = (folders: Folder[], parentFolderId: string | null, newFolder: Folder): boolean => {
  if (parentFolderId === null) {
    folders.push(newFolder);
    return true;
  }
  for (const folder of folders) {
    if (folder.id === parentFolderId) {
      folder.subfolders.push(newFolder);
      return true;
    }
    if (addFolderRecursive(folder.subfolders, parentFolderId, newFolder)) {
      return true;
    }
  }
  return false;
};

const renameFolderRecursive = (folders: Folder[], folderId: string, newName: string): boolean => {
  for (const folder of folders) {
    if (folder.id === folderId) {
      folder.name = newName;
      return true;
    }
    if (renameFolderRecursive(folder.subfolders, folderId, newName)) {
      return true;
    }
  }
  return false;
};

const deleteFolderRecursive = (folders: Folder[], folderId: string): boolean => {
  const idx = folders.findIndex((f) => f.id === folderId);
  if (idx >= 0) {
    folders.splice(idx, 1);
    return true;
  }
  for (const folder of folders) {
    if (deleteFolderRecursive(folder.subfolders, folderId)) {
      return true;
    }
  }
  return false;
};

const saveRequestRecursive = (folders: Folder[], folderId: string, request: SavedRequest): boolean => {
  for (const folder of folders) {
    if (folder.id === folderId) {
      const idx = folder.requests.findIndex((r) => r.id === request.id);
      if (idx >= 0) {
        folder.requests[idx] = request;
      } else {
        folder.requests.push(request);
      }
      return true;
    }
    if (saveRequestRecursive(folder.subfolders, folderId, request)) {
      return true;
    }
  }
  return false;
};

const deleteRequestRecursive = (folders: Folder[], requestId: string): boolean => {
  for (const folder of folders) {
    const idx = folder.requests.findIndex((r) => r.id === requestId);
    if (idx >= 0) {
      folder.requests.splice(idx, 1);
      return true;
    }
    if (deleteRequestRecursive(folder.subfolders, requestId)) {
      return true;
    }
  }
  return false;
};

export const useProjectsStore = create<ProjectsStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  activeRequestId: null,
  isSaveModalOpen: false,

  loadProjects: async () => {
    try {
      const projects = await invoke<Project[]>("list_projects");
      set({ projects });
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  },

  createProject: async (defaultName: string) => {
    try {
      const newProject = await invoke<Project | null>("create_project_dialog", { defaultName });
      if (newProject) {
        await get().loadProjects();
        set({ activeProjectId: newProject.id });
      }
    } catch (err) {
      console.error("Failed to create project:", err);
    }
  },

  deleteProject: async (id: string) => {
    const { projects } = get();
    const project = projects.find((p) => p.id === id);
    if (project && project.path) {
      await get().unmountProject(id, project.path);
    }
  },

  saveProject: async (project: Project) => {
    try {
      await invoke("save_project", { project });
      set((state) => ({
        projects: state.projects.map((p) => (p.id === project.id ? project : p)),
      }));
    } catch (err) {
      console.error("Failed to save project:", err);
    }
  },

  importProjects: async () => {
    try {
      const imported = await invoke<Project[]>("import_project_dialog");
      if (imported.length > 0) {
        await get().loadProjects();
        set({ activeProjectId: imported[0].id });
      }
    } catch (err) {
      console.error("Failed to import projects:", err);
    }
  },

  unmountProject: async (projectId: string, path: string) => {
    try {
      await invoke("unmount_project", { path });
      const { activeProjectId } = get();
      await get().loadProjects();
      if (activeProjectId === projectId) {
        set({ activeProjectId: null, activeRequestId: null });
      }
    } catch (err) {
      console.error("Failed to unmount project:", err);
    }
  },

  deleteProjectFile: async (projectId: string, path: string) => {
    try {
      await invoke("delete_project_file", { path });
      const { activeProjectId } = get();
      await get().loadProjects();
      if (activeProjectId === projectId) {
        set({ activeProjectId: null, activeRequestId: null });
      }
    } catch (err) {
      console.error("Failed to delete project file:", err);
    }
  },

  openInFileExplorer: async (path: string) => {
    try {
      await invoke("open_in_file_explorer", { path });
    } catch (err) {
      console.error("Failed to open file in explorer:", err);
    }
  },

  createFolder: async (projectId: string, parentFolderId: string | null, name: string) => {
    const { projects } = get();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    // Deep copy project
    const updatedProject: Project = JSON.parse(JSON.stringify(project));
    const newFolder: Folder = {
      id: crypto.randomUUID(),
      name,
      requests: [],
      subfolders: [],
    };

    if (addFolderRecursive(updatedProject.folders, parentFolderId, newFolder)) {
      await get().saveProject(updatedProject);
    }
  },

  renameFolder: async (projectId: string, folderId: string, newName: string) => {
    const { projects } = get();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    const updatedProject: Project = JSON.parse(JSON.stringify(project));
    if (renameFolderRecursive(updatedProject.folders, folderId, newName)) {
      await get().saveProject(updatedProject);
    }
  },

  deleteFolder: async (projectId: string, folderId: string) => {
    const { projects } = get();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    const updatedProject: Project = JSON.parse(JSON.stringify(project));
    if (deleteFolderRecursive(updatedProject.folders, folderId)) {
      await get().saveProject(updatedProject);
    }
  },

  saveRequest: async (projectId: string, folderId: string, request: SavedRequest) => {
    const { projects } = get();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    const updatedProject: Project = JSON.parse(JSON.stringify(project));
    if (saveRequestRecursive(updatedProject.folders, folderId, request)) {
      await get().saveProject(updatedProject);
      set({ activeRequestId: request.id });
    }
  },

  deleteRequest: async (projectId: string, requestId: string) => {
    const { projects, activeRequestId } = get();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    const updatedProject: Project = JSON.parse(JSON.stringify(project));
    if (deleteRequestRecursive(updatedProject.folders, requestId)) {
      await get().saveProject(updatedProject);
      if (activeRequestId === requestId) {
        set({ activeRequestId: null });
      }
    }
  },

  findRequestLocation: (requestId: string) => {
    const { projects } = get();
    for (const project of projects) {
      const findInFolders = (folders: Folder[]): string | null => {
        for (const folder of folders) {
          if (folder.requests.some((r) => r.id === requestId)) {
            return folder.id;
          }
          const sub = findInFolders(folder.subfolders);
          if (sub) return sub;
        }
        return null;
      };
      const fid = findInFolders(project.folders);
      if (fid) {
        return { projectId: project.id, folderId: fid };
      }
    }
    return null;
  },

  saveRequestDirectly: async (activeRequest: any) => {
    if (!activeRequest.id) return false;
    const location = get().findRequestLocation(activeRequest.id);
    if (!location) return false;

    const savedReq: SavedRequest = {
      id: activeRequest.id,
      name: activeRequest.name || "Untitled Request",
      method: activeRequest.method,
      url: activeRequest.url,
      headers: activeRequest.headers,
      params: activeRequest.params,
      body: activeRequest.body,
      auth: activeRequest.auth,
      created_at: Date.now(),
    };

    await get().saveRequest(location.projectId, location.folderId, savedReq);
    return true;
  },

  setActiveProject: (id) => set({ activeProjectId: id }),
  setActiveRequest: (id) => set({ activeRequestId: id }),
  setSaveModalOpen: (isOpen) => set({ isSaveModalOpen: isOpen }),
}));
