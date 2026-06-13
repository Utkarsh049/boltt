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
}

interface ProjectsStore {
  projects: Project[];
  activeProjectId: string | null;
  activeRequestId: string | null;
  isSaveModalOpen: boolean;
  
  loadProjects: () => Promise<void>;
  createProject: (name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  saveProject: (project: Project) => Promise<void>;
  
  createFolder: (projectId: string, parentFolderId: string | null, name: string) => Promise<void>;
  renameFolder: (projectId: string, folderId: string, newName: string) => Promise<void>;
  deleteFolder: (projectId: string, folderId: string) => Promise<void>;
  
  saveRequest: (projectId: string, folderId: string, request: SavedRequest) => Promise<void>;
  deleteRequest: (projectId: string, requestId: string) => Promise<void>;
  
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

  createProject: async (name: string) => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      folders: [],
    };
    try {
      await invoke("save_project", { project: newProject });
      await get().loadProjects();
      set({ activeProjectId: newProject.id });
    } catch (err) {
      console.error("Failed to create project:", err);
    }
  },

  deleteProject: async (id: string) => {
    try {
      await invoke("delete_project", { id });
      const { activeProjectId } = get();
      await get().loadProjects();
      if (activeProjectId === id) {
        set({ activeProjectId: null, activeRequestId: null });
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
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

  setActiveProject: (id) => set({ activeProjectId: id }),
  setActiveRequest: (id) => set({ activeRequestId: id }),
  setSaveModalOpen: (isOpen) => set({ isSaveModalOpen: isOpen }),
}));
