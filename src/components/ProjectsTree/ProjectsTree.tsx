import React, { useState, useEffect, useRef } from "react";
import { useProjectsStore, Project, Folder, SavedRequest } from "../../store/projectsStore";
import { useRequestStore, BoltRequest } from "../../store/requestStore";
import { 
  Folder as FolderIcon, 
  FolderOpen as FolderOpenIcon, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Copy, 
  FolderPlus, 
  FilePlus,
  Briefcase,
  FileDown
} from "lucide-react";
import { ExportPDFModal } from "../ExportPDFModal/ExportPDFModal";

const countRequestsRecursive = (folder: Folder): number => {
  let count = folder.requests.length;
  for (const sub of folder.subfolders) {
    count += countRequestsRecursive(sub);
  }
  return count;
};

export const ProjectsTree: React.FC = () => {
  const {
    projects,
    activeRequestId,
    loadProjects,
    createProject,
    deleteProject,
    saveProject,
    createFolder,
    renameFolder,
    deleteFolder,
    saveRequest,
    deleteRequest,
    setActiveProject,
    setActiveRequest,
  } = useProjectsStore();

  const loadRequest = useRequestStore((state) => state.loadRequest);
  const updateRequestName = useRequestStore((state) => state.updateRequestName);

  // UI state
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "project" | "folder" | "request";
    projectId: string;
    folderId?: string;
    folder?: Folder;
    requestId?: string;
    request?: SavedRequest;
  } | null>(null);

  // Custom naming dialog state
  const [namingDialog, setNamingDialog] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    value: string;
    type: "create-project" | "create-folder" | "create-subfolder" | "rename-project" | "rename-folder" | "rename-request";
    projectId: string;
    folderId?: string; // parent folder when creating subfolder/request, or target folder when renaming
    requestId?: string; // target request when renaming
    request?: SavedRequest;
  } | null>(null);

  const [pdfExportModal, setPdfExportModal] = useState<{
    isOpen: boolean;
    projectId: string;
    folderId: string;
    folderName: string;
    requestsCount: number;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Focus input when dialog opens
  useEffect(() => {
    if (namingDialog?.isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [namingDialog?.isOpen]);

  // Close context menu on global click
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  // Close local modals on Escape key / close-all-modals event
  useEffect(() => {
    const handleClose = () => {
      setNamingDialog(null);
      setPdfExportModal(null);
    };
    window.addEventListener("close-all-modals", handleClose);
    return () => window.removeEventListener("close-all-modals", handleClose);
  }, []);

  // Trigger project naming dialog from global landing page
  useEffect(() => {
    const handleCreateProject = () => {
      triggerNamingDialog("create-project", "");
    };
    window.addEventListener("create-project-dialog", handleCreateProject);
    return () => window.removeEventListener("create-project-dialog", handleCreateProject);
  }, []);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRequestClick = (projectId: string, request: SavedRequest) => {
    setActiveProject(projectId);
    setActiveRequest(request.id);
    
    // Load into workspace request store
    const reqToLoad: BoltRequest = {
      id: request.id,
      name: request.name,
      method: request.method,
      url: request.url,
      headers: request.headers,
      params: request.params,
      body: request.body,
      auth: request.auth,
    };
    loadRequest(reqToLoad);
  };

  // Open right click menu
  const onContextMenu = (
    e: React.MouseEvent,
    type: "project" | "folder" | "request",
    projectId: string,
    details: { folderId?: string; folder?: Folder; requestId?: string; request?: SavedRequest }
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 160;
    const menuHeight = 180;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    setContextMenu({
      x,
      y,
      type,
      projectId,
      folderId: details.folderId,
      folder: details.folder,
      requestId: details.requestId,
      request: details.request,
    });
  };

  // Dialog actions
  const triggerNamingDialog = (
    type: "create-project" | "create-folder" | "create-subfolder" | "rename-project" | "rename-folder" | "rename-request",
    projectId: string,
    details: { folderId?: string; requestId?: string; request?: SavedRequest; initialValue?: string } = {}
  ) => {
    let title = "";
    let placeholder = "";
    let initialValue = details.initialValue || "";

    switch (type) {
      case "create-project":
        title = "Create New Project";
        placeholder = "Project name";
        break;
      case "create-folder":
        title = "Create Folder";
        placeholder = "Folder name";
        break;
      case "create-subfolder":
        title = "Create Subfolder";
        placeholder = "Subfolder name";
        break;
      case "rename-project":
        title = "Rename Project";
        placeholder = "Project name";
        break;
      case "rename-folder":
        title = "Rename Folder";
        placeholder = "Folder name";
        break;
      case "rename-request":
        title = "Rename Request";
        placeholder = "Request name";
        break;
    }

    setNamingDialog({
      isOpen: true,
      title,
      placeholder,
      value: initialValue,
      type,
      projectId,
      folderId: details.folderId,
      requestId: details.requestId,
      request: details.request,
    });
  };

  const handleNamingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namingDialog || !namingDialog.value.trim()) return;

    const name = namingDialog.value.trim();
    const { type, projectId, folderId, request } = namingDialog;

    try {
      if (type === "create-project") {
        await createProject(name);
      } else if (type === "create-folder") {
        await createFolder(projectId, null, name);
        // Expand the project to show the new folder
        setExpandedIds((prev) => ({ ...prev, [projectId]: true }));
      } else if (type === "create-subfolder") {
        if (folderId) {
          await createFolder(projectId, folderId, name);
          // Expand the parent folder
          setExpandedIds((prev) => ({ ...prev, [folderId]: true }));
        }
      } else if (type === "rename-project") {
        const project = projects.find((p) => p.id === projectId);
        if (project) {
          const updated = { ...project, name };
          await saveProject(updated);
        }
      } else if (type === "rename-folder") {
        if (folderId) {
          await renameFolder(projectId, folderId, name);
        }
      } else if (type === "rename-request") {
        if (folderId && request) {
          const updatedReq: SavedRequest = { ...request, name };
          await saveRequest(projectId, folderId, updatedReq);
          updateRequestName(request.id, name);
        }
      }
    } catch (err) {
      console.error("Naming action failed:", err);
    }

    setNamingDialog(null);
  };

  // Duplicate helpers
  const duplicateFolderHelper = (folder: Folder): Folder => {
    const newFolderId = crypto.randomUUID();
    const duplicatedRequests: SavedRequest[] = folder.requests.map((req) => ({
      ...req,
      id: crypto.randomUUID(),
    }));
    const duplicatedSubfolders: Folder[] = folder.subfolders.map((sub) =>
      duplicateFolderHelper(sub)
    );

    return {
      id: newFolderId,
      name: `${folder.name} Copy`,
      requests: duplicatedRequests,
      subfolders: duplicatedSubfolders,
    };
  };

  const insertDuplicatedFolderRecursive = (
    folders: Folder[],
    targetId: string,
    duplicatedFolder: Folder
  ): boolean => {
    const idx = folders.findIndex((f) => f.id === targetId);
    if (idx >= 0) {
      folders.splice(idx + 1, 0, duplicatedFolder);
      return true;
    }
    for (const folder of folders) {
      if (insertDuplicatedFolderRecursive(folder.subfolders, targetId, duplicatedFolder)) {
        return true;
      }
    }
    return false;
  };

  const handleDuplicateFolder = async (projectId: string, folder: Folder) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    const updatedProject: Project = JSON.parse(JSON.stringify(project));
    const duplicatedFolder = duplicateFolderHelper(folder);

    if (insertDuplicatedFolderRecursive(updatedProject.folders, folder.id, duplicatedFolder)) {
      await saveProject(updatedProject);
    }
  };

  const handleDuplicateRequest = async (
    projectId: string,
    folderId: string,
    request: SavedRequest
  ) => {
    const duplicatedReq: SavedRequest = {
      ...request,
      id: crypto.randomUUID(),
      name: `${request.name} Copy`,
      created_at: Date.now(),
    };
    await saveRequest(projectId, folderId, duplicatedReq);
  };

  const handleAddRequestInFolder = async (projectId: string, folderId: string) => {
    const newReq: SavedRequest = {
      id: crypto.randomUUID(),
      name: "New Request",
      method: "GET",
      url: "https://httpbin.org/get",
      headers: [{ key: "User-Agent", value: "BolttClient/0.1.0", enabled: true }],
      params: [],
      body: { type: "None" },
      auth: { type: "None" },
      created_at: Date.now(),
    };
    await saveRequest(projectId, folderId, newReq);
    
    // Auto expand the folder to show it
    setExpandedIds((prev) => ({ ...prev, [folderId]: true }));
    // Auto load the new request
    handleRequestClick(projectId, newReq);
  };

  // Style helper for method badge
  const getMethodBadgeStyle = (method: string) => {
    switch (method) {
      case "GET":
        return "text-[#4ade80]";
      case "POST":
        return "text-[#fb923c]";
      case "PUT":
        return "text-[#60a5fa]";
      case "PATCH":
        return "text-[#c084fc]";
      case "DELETE":
        return "text-[#f87171]";
      default:
        return "text-[#8b919d]";
    }
  };

  // Recursive renderers
  const renderRequest = (request: SavedRequest, folderId: string, projectId: string, depth: number) => {
    const isActive = activeRequestId === request.id;
    return (
      <div
        key={request.id}
        onClick={() => handleRequestClick(projectId, request)}
        onContextMenu={(e) =>
          onContextMenu(e, "request", projectId, { folderId, requestId: request.id, request })
        }
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        className={`group flex items-center justify-between py-1.5 pr-2 text-xs font-mono rounded cursor-pointer transition select-none ${
          isActive
            ? "bg-[#1c2025] text-[#a1c9ff] "
            : "text-[#8b919d] hover:bg-[#1c2025]/40 hover:text-[#e0e2ea]"
        }`}
      >
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <span
            className={`text-[9px] font-extrabold flex-shrink-0 min-w-[32px] text-left ${getMethodBadgeStyle(
              request.method
            )}`}
          >
            {request.method}
          </span>
          <span className="truncate text-[11px]">{request.name}</span>
        </div>
        
        {/* Hover trigger for context menu */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, "request", projectId, { folderId, requestId: request.id, request });
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#272a30] transition text-[#8b919d] hover:text-[#e0e2ea] cursor-pointer"
        >
          <MoreVertical size={11} />
        </button>
      </div>
    );
  };

  const renderFolder = (folder: Folder, projectId: string, depth: number) => {
    const isExpanded = !!expandedIds[folder.id];
    return (
      <div key={folder.id} className="space-y-0.5">
        <div
          onClick={(e) => toggleExpand(folder.id, e)}
          onContextMenu={(e) => onContextMenu(e, "folder", projectId, { folderId: folder.id, folder })}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className="group flex items-center justify-between py-1.5 pr-2 rounded text-xs font-medium text-[#c0c7d3] hover:bg-[#1c2025]/40 hover:text-[#e0e2ea] cursor-pointer select-none"
        >
          <div className="flex items-center space-x-1.5 min-w-0 flex-1">
            <span className="text-[#8b919d]">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="text-[#a1c9ff]/90 flex-shrink-0">
              {isExpanded ? (
                <FolderOpenIcon size={13} className="fill-[#a1c9ff]/10" />
              ) : (
                <FolderIcon size={13} className="fill-[#a1c9ff]/10" />
              )}
            </span>
            <span className="truncate text-[11px] font-semibold">{folder.name}</span>
          </div>

          {/* Hover trigger for context menu */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu(e, "folder", projectId, { folderId: folder.id, folder });
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#272a30] transition text-[#8b919d] hover:text-[#e0e2ea] cursor-pointer"
          >
            <MoreVertical size={11} />
          </button>
        </div>

        {isExpanded && (
          <div className="space-y-0.5">
            {folder.subfolders.map((sub) => renderFolder(sub, projectId, depth + 1))}
            {folder.requests.map((req) => renderRequest(req, folder.id, projectId, depth + 1))}
            {folder.subfolders.length === 0 && folder.requests.length === 0 && (
              <div
                style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}
                className="py-1 text-[10px] text-[#8b919d]/50 italic select-none"
              >
                Empty Folder
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderProject = (project: Project) => {
    const isExpanded = !!expandedIds[project.id];
    return (
      <div key={project.id} className="border border-[#30363D]/40 bg-[#161B22] rounded overflow-hidden">
        {/* Project Header */}
        <div
          onClick={(e) => toggleExpand(project.id, e)}
          onContextMenu={(e) => onContextMenu(e, "project", project.id, {})}
          className={`group flex items-center justify-between px-2.5 py-2 text-xs font-semibold cursor-pointer select-none transition ${
            isExpanded ? "bg-[#1c2025]/60 text-[#e0e2ea]" : "text-[#8b919d] hover:bg-[#1c2025]/30 hover:text-[#e0e2ea]"
          }`}
        >
          <div className="flex items-center space-x-1.5 min-w-0 flex-1">
            <span className="text-[#8b919d]">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <Briefcase size={13} className="text-[#8b919d] flex-shrink-0" />
            <span className="truncate uppercase tracking-wider text-[10px]">{project.name}</span>
          </div>

          <div className="flex items-center space-x-1">
            {/* Quick add folder button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                triggerNamingDialog("create-folder", project.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#272a30] transition text-[#8b919d] hover:text-[#a1c9ff] cursor-pointer"
              title="Add Folder"
            >
              <Plus size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onContextMenu(e, "project", project.id, {});
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#272a30] transition text-[#8b919d] hover:text-[#e0e2ea] cursor-pointer"
            >
              <MoreVertical size={11} />
            </button>
          </div>
        </div>

        {/* Project Body */}
        {isExpanded && (
          <div className="p-1 space-y-0.5 border-t border-[#30363D]/20 bg-[#101419]/10">
            {project.folders.map((folder) => renderFolder(folder, project.id, 0))}
            {project.folders.length === 0 && (
              <div className="py-3 px-4 text-center text-[10px] text-[#8b919d]/60 select-none">
                <span>No folders yet. </span>
                <button
                  onClick={() => triggerNamingDialog("create-folder", project.id)}
                  className="text-[#a1c9ff] hover:underline cursor-pointer"
                >
                  Create folder
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* List Header */}
      <div className="flex items-center justify-between select-none">
        <span className="text-[10px] font-bold text-[#8b919d] uppercase tracking-wider">
          Projects
        </span>
        <button
          onClick={() => triggerNamingDialog("create-project", "")}
          className="text-[10px] bg-[#272a30] text-[#a1c9ff] border border-[#30363D] px-1.5 py-0.5 rounded hover:bg-[#32353b] flex items-center space-x-1 cursor-pointer transition"
        >
          <Plus size={10} />
          <span>New</span>
        </button>
      </div>

      {/* Projects List */}
      <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
        {projects.length > 0 ? (
          projects.map(renderProject)
        ) : (
          <div className="py-8 text-center border border-dashed border-[#30363D]/50 rounded-sm bg-[#161B22]/20">
            <span className="block text-[11px] text-[#8b919d] mb-2">No projects yet</span>
            <button
              onClick={() => triggerNamingDialog("create-project", "")}
              className="text-xs bg-[#272a30] text-[#a1c9ff] border border-[#30363D] px-2.5 py-1 rounded hover:bg-[#32353b] cursor-pointer transition font-semibold"
            >
              + New Project
            </button>
          </div>
        )}
      </div>

      {/* Dynamic Context Menu */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 w-44 bg-[#1c2025] border border-[#30363D] rounded-md shadow-2xl p-1 flex flex-col font-sans select-none"
        >
          {contextMenu.type === "project" && (
            <>
              <button
                onClick={() => triggerNamingDialog("create-folder", contextMenu.projectId)}
                className="flex items-center space-x-2 w-full px-2.5 py-1.5 text-xs text-[#e0e2ea] hover:bg-[#272a30] rounded-sm text-left transition cursor-pointer"
              >
                <FolderPlus size={13} className="text-[#8b919d]" />
                <span>Add Folder</span>
              </button>
              <button
                onClick={() =>
                  triggerNamingDialog("rename-project", contextMenu.projectId, {
                    initialValue: projects.find((p) => p.id === contextMenu.projectId)?.name || "",
                  })
                }
                className="flex items-center space-x-2 w-full px-2.5 py-1.5 text-xs text-[#e0e2ea] hover:bg-[#272a30] rounded-sm text-left transition cursor-pointer"
              >
                <Edit2 size={13} className="text-[#8b919d]" />
                <span>Rename Project</span>
              </button>
              <button
                onClick={() => {
                  const proj = projects.find((p) => p.id === contextMenu.projectId);
                  if (proj) {
                    setPdfExportModal({
                      isOpen: true,
                      projectId: contextMenu.projectId,
                      folderId: "",
                      folderName: proj.name,
                      requestsCount: proj.folders.reduce((sum, f) => sum + countRequestsRecursive(f), 0),
                    });
                  }
                  setContextMenu(null);
                }}
                className="flex items-center space-x-2 w-full px-2.5 py-1.5 text-xs text-[#e0e2ea] hover:bg-[#272a30] rounded-sm text-left transition cursor-pointer"
              >
                <FileDown size={13} className="text-[#8b919d]" />
                <span>Export as PDF</span>
              </button>
              <div className="my-1 border-t border-[#30363D]"></div>
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to delete this project? All folders and requests inside will be lost.")) {
                    deleteProject(contextMenu.projectId);
                  }
                }}
                className="flex items-center space-x-2 w-full px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-sm text-left transition cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Delete Project</span>
              </button>
            </>
          )}

          {contextMenu.type === "folder" && contextMenu.folder && (
            <>
              <button
                onClick={() => handleAddRequestInFolder(contextMenu.projectId, contextMenu.folderId!)}
                className="flex items-center space-x-2 w-full px-2.5 py-1.5 text-xs text-[#e0e2ea] hover:bg-[#272a30] rounded-sm text-left transition cursor-pointer"
              >
                <FilePlus size={13} className="text-[#8b919d]" />
                <span>Add Request</span>
              </button>
              <button
                onClick={() => triggerNamingDialog("create-subfolder", contextMenu.projectId, { folderId: contextMenu.folderId })}
                className="flex items-center space-x-2 w-full px-2.5 py-1.5 text-xs text-[#e0e2ea] hover:bg-[#272a30] rounded-sm text-left transition cursor-pointer"
              >
                <FolderPlus size={13} className="text-[#8b919d]" />
                <span>Add Subfolder</span>
              </button>
              <button
                onClick={() =>
                  triggerNamingDialog("rename-folder", contextMenu.projectId, {
                    folderId: contextMenu.folderId,
                    initialValue: contextMenu.folder?.name || "",
                  })
                }
                className="flex items-center space-x-2 w-full px-2.5 py-1.5 text-xs text-[#e0e2ea] hover:bg-[#272a30] rounded-sm text-left transition cursor-pointer"
              >
                <Edit2 size={13} className="text-[#8b919d]" />
                <span>Rename Folder</span>
              </button>
              <button
                onClick={() => handleDuplicateFolder(contextMenu.projectId, contextMenu.folder!)}
                className="flex items-center space-x-2 w-full px-2.5 py-1.5 text-xs text-[#e0e2ea] hover:bg-[#272a30] rounded-sm text-left transition cursor-pointer"
              >
                <Copy size={13} className="text-[#8b919d]" />
                <span>Duplicate Folder</span>
              </button>
              <div className="my-1 border-t border-[#30363D]"></div>
              <button
                onClick={() => {
                  if (contextMenu.folder) {
                    setPdfExportModal({
                      isOpen: true,
                      projectId: contextMenu.projectId,
                      folderId: contextMenu.folderId!,
                      folderName: contextMenu.folder.name,
                      requestsCount: countRequestsRecursive(contextMenu.folder),
                    });
                    setContextMenu(null);
                  }
                }}
                className="flex items-center space-x-2 w-full px-2.5 py-1.5 text-xs text-[#e0e2ea] hover:bg-[#272a30] rounded-sm text-left transition cursor-pointer"
              >
                <FileDown size={13} className="text-[#8b919d]" />
                <span>Export as PDF</span>
              </button>
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to delete this folder and all of its contents?")) {
                    deleteFolder(contextMenu.projectId, contextMenu.folderId!);
                  }
                }}
                className="flex items-center space-x-2 w-full px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-sm text-left transition cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Delete Folder</span>
              </button>
            </>
          )}

          {contextMenu.type === "request" && contextMenu.request && (
            <>
              <button
                onClick={() =>
                  triggerNamingDialog("rename-request", contextMenu.projectId, {
                    folderId: contextMenu.folderId,
                    requestId: contextMenu.requestId,
                    request: contextMenu.request,
                    initialValue: contextMenu.request?.name || "",
                  })
                }
                className="flex items-center space-x-2 w-full px-2.5 py-1.5 text-xs text-[#e0e2ea] hover:bg-[#272a30] rounded-sm text-left transition cursor-pointer"
              >
                <Edit2 size={13} className="text-[#8b919d]" />
                <span>Rename Request</span>
              </button>
              <button
                onClick={() => handleDuplicateRequest(contextMenu.projectId, contextMenu.folderId!, contextMenu.request!)}
                className="flex items-center space-x-2 w-full px-2.5 py-1.5 text-xs text-[#e0e2ea] hover:bg-[#272a30] rounded-sm text-left transition cursor-pointer"
              >
                <Copy size={13} className="text-[#8b919d]" />
                <span>Duplicate Request</span>
              </button>
              <div className="my-1 border-t border-[#30363D]"></div>
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to delete this request?")) {
                    deleteRequest(contextMenu.projectId, contextMenu.requestId!);
                  }
                }}
                className="flex items-center space-x-2 w-full px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-sm text-left transition cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Delete Request</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Glassmorphic custom naming modal overlay */}
      {namingDialog?.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4 font-sans">
          <div className="w-[360px] bg-[#161B22] border border-[#30363D] rounded-lg shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="h-11 border-b border-[#30363D] bg-[#1c2025] flex items-center justify-between px-4">
              <span className="font-semibold text-xs text-[#e0e2ea] uppercase tracking-wider">
                {namingDialog.title}
              </span>
            </div>
            
            {/* Modal Form */}
            <form onSubmit={handleNamingSubmit} className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#8b919d] uppercase tracking-wider">
                  Name
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  required
                  placeholder={namingDialog.placeholder}
                  value={namingDialog.value}
                  onChange={(e) =>
                    setNamingDialog((prev) => (prev ? { ...prev, value: e.target.value } : null))
                  }
                  className="w-full bg-[#101419] text-[#e0e2ea] border border-[#30363D] px-3 py-2 rounded text-xs focus:outline-none focus:border-[#a1c9ff] placeholder-[#8b919d]/40 font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#30363D]/30">
                <button
                  type="button"
                  onClick={() => setNamingDialog(null)}
                  className="px-3 py-1.5 border border-[#30363D] rounded text-xs text-[#c0c7d3] hover:bg-[#272a30] transition cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#a1c9ff] hover:bg-blue-300 text-[#00325a] rounded text-xs transition cursor-pointer font-bold"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export PDF Modal */}
      {pdfExportModal?.isOpen && (
        <ExportPDFModal
          isOpen={pdfExportModal.isOpen}
          onClose={() => setPdfExportModal(null)}
          projectId={pdfExportModal.projectId}
          folderId={pdfExportModal.folderId}
          folderName={pdfExportModal.folderName}
          requestsCount={pdfExportModal.requestsCount}
        />
      )}
    </div>
  );
};
