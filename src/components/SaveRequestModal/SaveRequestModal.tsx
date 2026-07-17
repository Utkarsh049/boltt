import React, { useState, useEffect, useRef } from "react";
import { useProjectsStore, Project, Folder, SavedRequest } from "../../store/projectsStore";
import { useRequestStore } from "../../store/requestStore";
import { useToastStore } from "../../store/toastStore";
import { X, Save, Plus, ChevronDown, Check, Briefcase, Folder as FolderIcon } from "lucide-react";

export const SaveRequestModal: React.FC = () => {
  const {
    projects,
    isSaveModalOpen,
    setSaveModalOpen,
    saveRequest,
    createFolder,
    setActiveProject,
    setActiveRequest,
  } = useProjectsStore();

  const { activeRequest, loadRequest, markTabClean } = useRequestStore();

  // Dialog fields
  const [requestName, setRequestName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");

  // Custom select dropdowns visibility
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);
  const [isParentFolderDropdownOpen, setIsParentFolderDropdownOpen] = useState(false);

  // Inline folder creation state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string>("root"); // "root" or a folder ID

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const folderDropdownRef = useRef<HTMLDivElement>(null);
  const parentFolderDropdownRef = useRef<HTMLDivElement>(null);

  // Close custom dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        projectDropdownRef.current &&
        !projectDropdownRef.current.contains(event.target as Node)
      ) {
        setIsProjectDropdownOpen(false);
      }
      if (
        folderDropdownRef.current &&
        !folderDropdownRef.current.contains(event.target as Node)
      ) {
        setIsFolderDropdownOpen(false);
      }
      if (
        parentFolderDropdownRef.current &&
        !parentFolderDropdownRef.current.contains(event.target as Node)
      ) {
        setIsParentFolderDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Initialize fields when modal opens
  useEffect(() => {
    if (isSaveModalOpen) {
      setRequestName(activeRequest.name && activeRequest.name !== "New Request" ? activeRequest.name : "");
      setIsCreatingFolder(false);
      setNewFolderName("");
      setNewFolderParentId("root");
      setIsProjectDropdownOpen(false);
      setIsFolderDropdownOpen(false);
      setIsParentFolderDropdownOpen(false);

      // Set default selected project
      if (projects.length > 0) {
        // Find if request is already in a project to pre-select it
        const location = findRequestLocation(projects, activeRequest.id || "");
        if (location) {
          setSelectedProjectId(location.projectId);
          setSelectedFolderId(location.folderId);
        } else {
          setSelectedProjectId(projects[0].id);
          // Pre-select first folder if available
          if (projects[0].folders.length > 0) {
            setSelectedFolderId(projects[0].folders[0].id);
          } else {
            setSelectedFolderId("");
          }
        }
      } else {
        setSelectedProjectId("");
        setSelectedFolderId("");
      }

      // Auto focus request name input
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isSaveModalOpen, projects, activeRequest]);

  // Handle project change
  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    const proj = projects.find((p) => p.id === projectId);
    if (proj && proj.folders.length > 0) {
      setSelectedFolderId(proj.folders[0].id);
    } else {
      setSelectedFolderId("");
    }
  };

  // Helper to find request location
  const findRequestLocation = (
    projectsList: Project[],
    requestId: string
  ): { projectId: string; folderId: string } | null => {
    if (!requestId) return null;
    for (const project of projectsList) {
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
  };

  // Flat Folder Interface
  interface FlatFolder {
    id: string;
    name: string;
    depth: number;
  }

  // Recursive folder flattener for dropdown with depth representation
  const getFlatFolders = (folders: Folder[], depth = 0): FlatFolder[] => {
    const flat: FlatFolder[] = [];
    for (const f of folders) {
      flat.push({
        id: f.id,
        name: f.name,
        depth,
      });
      flat.push(...getFlatFolders(f.subfolders, depth + 1));
    }
    return flat;
  };

  const handleCreateFolderInline = async () => {
    if (!newFolderName.trim() || !selectedProjectId) return;
    const parentId = newFolderParentId === "root" ? null : newFolderParentId;

    try {
      const project = projects.find((p) => p.id === selectedProjectId);
      if (!project) return;

      const getFolderIds = (folders: Folder[]): string[] => {
        const ids: string[] = [];
        for (const f of folders) {
          ids.push(f.id);
          ids.push(...getFolderIds(f.subfolders));
        }
        return ids;
      };
      const oldIds = getFolderIds(project.folders);

      await createFolder(selectedProjectId, parentId, newFolderName.trim());

      // Poll projects list briefly for the new folder to auto-select it
      const updatedProject = useProjectsStore.getState().projects.find((p) => p.id === selectedProjectId);
      if (updatedProject) {
        const newIds = getFolderIds(updatedProject.folders);
        const addedId = newIds.find((id) => !oldIds.includes(id));
        if (addedId) {
          setSelectedFolderId(addedId);
        }
      }

      setNewFolderName("");
      setIsCreatingFolder(false);
    } catch (err) {
      console.error("Failed to create folder inline:", err);
    }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert("Please select or create a project first.");
      return;
    }
    if (!selectedFolderId) {
      alert("Please select or create a folder first.");
      return;
    }

    const name = requestName.trim() || "Untitled Request";
    const requestId = activeRequest.id || crypto.randomUUID();

    const savedReq: SavedRequest = {
      id: requestId,
      name,
      method: activeRequest.method,
      url: activeRequest.url,
      headers: activeRequest.headers,
      params: activeRequest.params,
      body: activeRequest.body,
      auth: activeRequest.auth,
      created_at: Date.now(),
    };

    try {
      await saveRequest(selectedProjectId, selectedFolderId, savedReq);
      
      loadRequest({
        ...activeRequest,
        id: savedReq.id,
        name: savedReq.name,
      });

      markTabClean(savedReq.id);
      useToastStore.getState().showToast("Request saved", "success");

      setActiveProject(selectedProjectId);
      setActiveRequest(savedReq.id);
      setSaveModalOpen(false);
    } catch (err) {
      console.error("Save request failed:", err);
    }
  };

  if (!isSaveModalOpen) return null;

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const flatFolders = currentProject ? getFlatFolders(currentProject.folders) : [];
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const selectedFolder = flatFolders.find((f) => f.id === selectedFolderId);
  const parentFolder = flatFolders.find((f) => f.id === newFolderParentId);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4 font-sans select-none">
      <div
        ref={modalRef}
        className="w-[440px] bg-bg-secondary border border-border-primary rounded-lg shadow-2xl flex flex-col animate-slide-up"
      >
        {/* Header */}
        <div className="h-12 border-b border-border-primary bg-bg-tertiary flex items-center justify-between px-4 flex-shrink-0 rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Save size={15} className="text-text-accent" />
            <span className="font-semibold text-xs uppercase tracking-wider text-text-primary">
              Save Request
            </span>
          </div>
          <button
            onClick={() => setSaveModalOpen(false)}
            className="text-text-secondary hover:text-text-primary transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSaveSubmit} className="p-5 space-y-4">
          {/* Request Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
              Request Name
            </label>
            <input
              ref={inputRef}
              type="text"
              required
              placeholder="e.g. Get Users List"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              className="w-full bg-bg-primary text-text-primary border border-border-primary px-3 py-2 rounded text-xs focus:outline-none focus:border-text-accent placeholder-text-secondary/40 font-medium"
            />
          </div>

          {/* Project Selector */}
          <div className="space-y-1.5 relative" ref={projectDropdownRef}>
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
              Project
            </label>
            {projects.length > 0 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                  className="w-full flex items-center justify-between bg-bg-primary text-text-primary border border-border-primary px-3 py-2 rounded text-xs focus:outline-none focus:border-text-accent cursor-pointer font-medium text-left"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <Briefcase size={13} className="text-text-secondary" />
                    <span className="truncate">
                      {selectedProject ? selectedProject.name : "Select Project"}
                    </span>
                  </div>
                  <ChevronDown size={14} className="text-text-secondary flex-shrink-0" />
                </button>

                {isProjectDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-full bg-bg-secondary border border-border-primary rounded shadow-2xl z-50 py-1 max-h-60 overflow-y-auto">
                    {projects.map((p) => {
                      const isSelected = p.id === selectedProjectId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            handleProjectChange(p.id);
                            setIsProjectDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition cursor-pointer hover:bg-bg-tertiary/60 ${
                            isSelected ? "text-text-accent font-semibold bg-bg-tertiary" : "text-text-primary"
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <Briefcase
                              size={13}
                              className={isSelected ? "text-text-accent" : "text-text-secondary"}
                            />
                            <span className="truncate">{p.name}</span>
                          </div>
                          {isSelected && <Check size={12} className="text-text-accent" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-[#8b919d] italic py-1">
                No projects found. Please create one in the sidebar first.
              </div>
            )}
          </div>

          {/* Folder Selector */}
          {selectedProjectId && (
            <div className="space-y-1.5 relative" ref={folderDropdownRef}>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                  Folder
                </label>
                {!isCreatingFolder && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingFolder(true)}
                    className="text-[10px] text-text-accent hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus size={10} />
                    <span>New Folder</span>
                  </button>
                )}
              </div>

              {isCreatingFolder ? (
                <div className="bg-bg-tertiary/50 border border-border-primary rounded p-3 space-y-2.5">
                  <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    Create New Folder
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Folder name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full bg-bg-primary text-text-primary border border-border-primary px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-text-accent placeholder-text-secondary/40 font-medium"
                  />
                  <div className="space-y-1">
                    <label className="text-[9px] font-semibold text-text-secondary">Parent Folder</label>
                    <div className="relative w-full" ref={parentFolderDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsParentFolderDropdownOpen(!isParentFolderDropdownOpen)}
                        className="w-full flex items-center justify-between bg-bg-primary text-text-primary border border-border-primary px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-text-accent cursor-pointer font-medium text-left"
                      >
                        <div className="flex items-center space-x-1.5 truncate">
                          <FolderIcon size={12} className="text-text-secondary" />
                          <span className="truncate">
                            {newFolderParentId === "root"
                              ? "[Project Root]"
                              : parentFolder
                              ? parentFolder.name
                              : "[Project Root]"}
                          </span>
                        </div>
                        <ChevronDown size={12} className="text-text-secondary flex-shrink-0" />
                      </button>

                      {isParentFolderDropdownOpen && (
                        <div className="absolute left-0 mt-1 w-full bg-bg-secondary border border-border-primary rounded shadow-2xl z-50 py-1 max-h-40 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setNewFolderParentId("root");
                              setIsParentFolderDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition cursor-pointer hover:bg-bg-tertiary/60 ${
                              newFolderParentId === "root"
                                ? "text-text-accent font-semibold bg-bg-tertiary"
                               : "text-text-primary"
                            }`}
                          >
                            <div className="flex items-center space-x-1.5 truncate">
                              <FolderIcon size={12} className="text-text-secondary" />
                              <span className="truncate">[Project Root]</span>
                            </div>
                            {newFolderParentId === "root" && <Check size={12} className="text-text-accent" />}
                          </button>

                          {flatFolders.map((f) => {
                            const isSelected = f.id === newFolderParentId;
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => {
                                  setNewFolderParentId(f.id);
                                  setIsParentFolderDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition cursor-pointer hover:bg-bg-tertiary/60 ${
                                  isSelected ? "text-text-accent font-semibold bg-bg-tertiary" : "text-text-primary"
                                }`}
                                style={{ paddingLeft: `${f.depth * 12 + 12}px` }}
                              >
                                <div className="flex items-center space-x-1.5 truncate">
                                  <FolderIcon
                                    size={12}
                                    className={isSelected ? "text-text-accent" : "text-text-secondary"}
                                  />
                                  <span className="truncate">{f.name}</span>
                                </div>
                                {isSelected && <Check size={12} className="text-text-accent" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreatingFolder(false)}
                      className="px-2.5 py-1 border border-border-primary rounded text-[11px] text-[#c0c7d3] hover:bg-bg-hover transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!newFolderName.trim()}
                      onClick={handleCreateFolderInline}
                      className="px-3 py-1 bg-text-accent disabled:opacity-50 hover:bg-blue-300 text-[#00325a] rounded text-[11px] font-bold transition cursor-pointer"
                    >
                      Create
                    </button>
                  </div>
                </div>
              ) : flatFolders.length > 0 ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsFolderDropdownOpen(!isFolderDropdownOpen)}
                    className="w-full flex items-center justify-between bg-bg-primary text-text-primary border border-border-primary px-3 py-2 rounded text-xs focus:outline-none focus:border-text-accent cursor-pointer font-medium text-left"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <FolderIcon size={13} className="text-text-accent" />
                      <span className="truncate">
                        {selectedFolder ? selectedFolder.name : "Select Folder"}
                      </span>
                    </div>
                    <ChevronDown size={14} className="text-text-secondary flex-shrink-0" />
                  </button>

                  {isFolderDropdownOpen && (
                    <div className="absolute left-0 mt-1 w-full bg-bg-secondary border border-border-primary rounded shadow-2xl z-50 py-1 max-h-60 overflow-y-auto">
                      {flatFolders.map((f) => {
                        const isSelected = f.id === selectedFolderId;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              setSelectedFolderId(f.id);
                              setIsFolderDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition cursor-pointer hover:bg-bg-tertiary/60 ${
                              isSelected ? "text-text-accent font-semibold bg-bg-tertiary" : "text-text-primary"
                            }`}
                            style={{ paddingLeft: `${f.depth * 12 + 12}px` }}
                          >
                            <div className="flex items-center space-x-1.5 truncate">
                              <FolderIcon
                                size={13}
                                className={isSelected ? "text-text-accent" : "text-text-secondary"}
                              />
                              <span className="truncate">{f.name}</span>
                            </div>
                            {isSelected && <Check size={12} className="text-text-accent" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-text-secondary/75 italic py-1 flex items-center justify-between">
                  <span>No folders in this project.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingFolder(true);
                      setNewFolderParentId("root");
                    }}
                    className="text-text-accent hover:underline cursor-pointer font-medium"
                  >
                    Create one now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border-primary/30">
            <button
              type="button"
              onClick={() => setSaveModalOpen(false)}
              className="px-3.5 py-2 border border-border-primary rounded text-xs text-[#c0c7d3] hover:bg-bg-hover transition cursor-pointer font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedProjectId || !selectedFolderId}
              className="px-5 py-2 bg-text-accent hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed text-[#00325a] rounded text-xs transition cursor-pointer font-bold flex items-center space-x-1.5"
            >
              <Save size={12} />
              <span>Save Request</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
