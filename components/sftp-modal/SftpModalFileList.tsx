import React from "react";
import { Download, Edit2, Folder, FolderOpen, FolderUp, Link, Loader2, MoreHorizontal, Plus, RefreshCw, Shield, Trash2, Upload } from "lucide-react";
import { cn } from "../../lib/utils";
import type { RemoteFile } from "../../types";
import { isKnownBinaryFile } from "../../lib/sftpFileUtils";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "../ui/context-menu";
import { Button } from "../ui/button";
import { getFileIcon } from "./fileIcons";

interface VisibleRow {
  file: RemoteFile;
  index: number;
  top: number;
}

interface SftpModalFileListProps {
  t: (key: string, params?: Record<string, unknown>) => string;
  currentPath: string;
  isLocalSession: boolean;
  hasFiles: boolean;
  hasDisplayFiles: boolean;
  selectedFiles: Set<string>;
  dragActive: boolean;
  loading: boolean;
  loadingTextContent: boolean;
  reconnecting: boolean;
  columnWidths: { name: number; size: number; modified: number; actions: number };
  sortField: "name" | "size" | "modified";
  sortOrder: "asc" | "desc";
  shouldVirtualize: boolean;
  totalHeight: number;
  visibleRows: VisibleRow[];
  fileListRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement>;
  folderInputRef: React.RefObject<HTMLInputElement>;
  handleSort: (field: "name" | "size" | "modified") => void;
  handleResizeStart: (field: string, e: React.MouseEvent) => void;
  handleFileListScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileClick: (file: RemoteFile, index: number, e: React.MouseEvent) => void;
  handleFileDoubleClick: (file: RemoteFile) => void;
  handleDownload: (file: RemoteFile) => void;
  handleDelete: (file: RemoteFile) => void;
  handleOpenFile: (file: RemoteFile) => void;
  openFileOpenerDialog: (file: RemoteFile) => void;
  handleEditFile: (file: RemoteFile) => void;
  openRenameDialog: (file: RemoteFile) => void;
  openPermissionsDialog: (file: RemoteFile) => void;
  handleNavigate: (path: string) => void;
  handleCreateFolder: () => void;
  handleCreateFile: () => void;
  handleDownloadSelected: () => void;
  handleDeleteSelected: () => void;
  loadFiles: (path: string, options?: { force?: boolean }) => void;
  formatBytes: (bytes: number | string) => string;
  formatDate: (dateStr: string | number | undefined) => string;
}

export const SftpModalFileList: React.FC<SftpModalFileListProps> = ({
  t,
  currentPath,
  isLocalSession,
  hasFiles,
  hasDisplayFiles,
  selectedFiles,
  dragActive,
  loading,
  loadingTextContent,
  reconnecting,
  columnWidths,
  sortField,
  sortOrder,
  shouldVirtualize,
  totalHeight,
  visibleRows,
  fileListRef,
  inputRef,
  folderInputRef,
  handleSort,
  handleResizeStart,
  handleFileListScroll,
  handleDrag,
  handleDrop,
  handleFileClick,
  handleFileDoubleClick,
  handleDownload,
  handleDelete,
  handleOpenFile,
  openFileOpenerDialog,
  handleEditFile,
  openRenameDialog,
  openPermissionsDialog,
  handleNavigate,
  handleCreateFolder,
  handleCreateFile,
  handleDownloadSelected,
  handleDeleteSelected,
  loadFiles,
  formatBytes,
  formatDate,
}) => (
  <>
    <div
      className="shrink-0 bg-muted/80 backdrop-blur-sm border-b border-border/60 px-4 py-2 flex items-center text-xs font-medium text-muted-foreground select-none"
      style={{
        display: "grid",
        gridTemplateColumns: `${columnWidths.name}% ${columnWidths.size}% ${columnWidths.modified}% ${columnWidths.actions}%`,
      }}
    >
      <div
        className="flex items-center gap-1 cursor-pointer hover:text-foreground relative pr-2"
        onClick={() => handleSort("name")}
      >
        <span>{t("sftp.columns.name")}</span>
        {sortField === "name" && (
          <span className="text-primary">{sortOrder === "asc" ? "^" : "v"}</span>
        )}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors"
          onMouseDown={(e) => handleResizeStart("name", e)}
        />
      </div>
      <div
        className="flex items-center gap-1 cursor-pointer hover:text-foreground relative pr-2"
        onClick={() => handleSort("size")}
      >
        <span>{t("sftp.columns.size")}</span>
        {sortField === "size" && (
          <span className="text-primary">{sortOrder === "asc" ? "^" : "v"}</span>
        )}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors"
          onMouseDown={(e) => handleResizeStart("size", e)}
        />
      </div>
      <div
        className="flex items-center gap-1 cursor-pointer hover:text-foreground relative pr-2"
        onClick={() => handleSort("modified")}
      >
        <span>{t("sftp.columns.modified")}</span>
        {sortField === "modified" && (
          <span className="text-primary">{sortOrder === "asc" ? "^" : "v"}</span>
        )}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors"
          onMouseDown={(e) => handleResizeStart("modified", e)}
        />
      </div>
      <div className="text-right">{t("sftp.columns.actions")}</div>
    </div>

    <div
      ref={fileListRef}
      className={cn(
        "flex-1 min-h-0 overflow-y-auto relative",
        dragActive && "bg-primary/5 ring-2 ring-inset ring-primary",
      )}
      onScroll={handleFileListScroll}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {dragActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-background/95 p-6 rounded-xl shadow-lg border-2 border-dashed border-primary text-primary font-medium flex flex-col items-center gap-2">
            <Upload size={32} />
            <span>{t("sftp.dropFilesHere")}</span>
          </div>
        </div>
      )}

      {loading && !hasFiles && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {loadingTextContent && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t("sftp.status.loading")}
            </span>
          </div>
        </div>
      )}

      {reconnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-20">
          <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-secondary/90 border border-border/60 shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <div className="text-sm font-medium">{t("sftp.reconnecting.title")}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {t("sftp.reconnecting.desc")}
              </div>
            </div>
          </div>
        </div>
      )}

      {!hasDisplayFiles && !loading && (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <Folder size={48} className="mb-3 opacity-50" />
          <div className="text-sm font-medium">{t("sftp.emptyDirectory")}</div>
          <div className="text-xs mt-1">{t("sftp.dragDropToUpload")}</div>
        </div>
      )}

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={shouldVirtualize ? "relative" : "divide-y divide-border/30"}
            style={shouldVirtualize ? { height: totalHeight } : undefined}
          >
            {visibleRows.map(({ file, index: idx, top }) => {
              const isNavigableDirectory =
                file.type === "directory" ||
                (file.type === "symlink" && file.linkTarget === "directory");
              const isDownloadableFile =
                file.type === "file" ||
                (file.type === "symlink" && file.linkTarget === "file");
              const isParentEntry = file.name === "..";

              return (
                <ContextMenu key={file.name}>
                  <ContextMenuTrigger>
                    <div
                      data-sftp-modal-row="true"
                      className={cn(
                        "px-4 py-2.5 items-center hover:bg-muted/50 cursor-pointer transition-colors text-sm",
                        selectedFiles.has(file.name) && !isParentEntry && "bg-primary/10",
                        shouldVirtualize ? "absolute left-0 right-0 border-b border-border/30" : "",
                      )}
                      style={
                        shouldVirtualize
                          ? {
                            top,
                            display: "grid",
                            gridTemplateColumns: `${columnWidths.name}% ${columnWidths.size}% ${columnWidths.modified}% ${columnWidths.actions}%`,
                          }
                          : {
                            display: "grid",
                            gridTemplateColumns: `${columnWidths.name}% ${columnWidths.size}% ${columnWidths.modified}% ${columnWidths.actions}%`,
                          }
                      }
                      onClick={(e) => handleFileClick(file, idx, e)}
                      onDoubleClick={() => handleFileDoubleClick(file)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0 h-7 w-7 flex items-center justify-center">
                          {getFileIcon(
                            file.name,
                            isNavigableDirectory,
                            file.type === "symlink" && !isNavigableDirectory,
                          )}
                          {file.type === "symlink" && (
                            <Link
                              size={10}
                              className="absolute -bottom-0.5 -right-0.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <span
                          className={cn(
                            "truncate font-medium",
                            file.type === "symlink" && "italic pr-1",
                          )}
                        >
                          {file.name}
                          {file.type === "symlink" && (
                            <span className="sr-only"> (symbolic link)</span>
                          )}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isNavigableDirectory ? "--" : formatBytes(file.size)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {formatDate(file.lastModified)}
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        {isDownloadableFile && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file);
                            }}
                            title={t("sftp.context.download")}
                          >
                            <Download size={14} />
                          </Button>
                        )}
                        {!isParentEntry && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(file);
                            }}
                            title={t("sftp.context.delete")}
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {isParentEntry ? (
                      <ContextMenuItem
                        onClick={() => {
                          const segments = currentPath.split("/").filter(Boolean);
                          segments.pop();
                          const parentPath =
                            segments.length === 0 ? "/" : `/${segments.join("/")}`;
                          handleNavigate(parentPath);
                        }}
                      >
                        {t("sftp.context.open")}
                      </ContextMenuItem>
                    ) : (
                      <>
                        {isNavigableDirectory && (
                          <>
                            <ContextMenuItem
                              onClick={() =>
                                handleNavigate(
                                  currentPath === "/"
                                    ? `/${file.name}`
                                    : `${currentPath}/${file.name}`,
                                )
                              }
                            >
                              <FolderOpen size={14} className="mr-2" />
                              {t("sftp.context.open")}
                            </ContextMenuItem>
                            {!isLocalSession && (
                              <ContextMenuItem onClick={() => handleDownload(file)}>
                                <Download size={14} className="mr-2" />
                                {t("sftp.context.download")}
                              </ContextMenuItem>
                            )}
                          </>
                        )}
                        {isDownloadableFile && (
                          <>
                            <ContextMenuItem onClick={() => handleOpenFile(file)}>
                              <FolderOpen size={14} className="mr-2" />
                              {t("sftp.context.open")}
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => openFileOpenerDialog(file)}>
                              <MoreHorizontal size={14} className="mr-2" />
                              {t("sftp.context.openWith")}
                            </ContextMenuItem>
                            {!isKnownBinaryFile(file.name) && (
                              <ContextMenuItem onClick={() => handleEditFile(file)}>
                                <Edit2 size={14} className="mr-2" />
                                {t("sftp.context.edit")}
                              </ContextMenuItem>
                            )}
                            <ContextMenuSeparator />
                            <ContextMenuItem onClick={() => handleDownload(file)}>
                              <Download size={14} className="mr-2" />
                              {t("sftp.context.download")}
                            </ContextMenuItem>
                          </>
                        )}
                        <ContextMenuItem onClick={() => openRenameDialog(file)}>
                          <Edit2 size={14} className="mr-2" />
                          {t("sftp.context.rename")}
                        </ContextMenuItem>
                        {!isLocalSession && (
                          <ContextMenuItem onClick={() => openPermissionsDialog(file)}>
                            <Shield size={14} className="mr-2" />
                            {t("sftp.context.permissions")}
                          </ContextMenuItem>
                        )}
                        <ContextMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(file)}
                        >
                          <Trash2 size={14} className="mr-2" />
                          {t("sftp.context.delete")}
                        </ContextMenuItem>
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleCreateFolder}>
            <Plus className="h-4 w-4 mr-2" /> {t("sftp.newFolder")}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCreateFile}>
            <Plus className="h-4 w-4 mr-2" /> {t("sftp.newFile")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> {t("sftp.uploadFiles")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => folderInputRef.current?.click()}>
            <FolderUp className="h-4 w-4 mr-2" /> {t("sftp.uploadFolder")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => loadFiles(currentPath, { force: true })}>
            <RefreshCw className="h-4 w-4 mr-2" /> {t("sftp.context.refresh")}
          </ContextMenuItem>
          {selectedFiles.size > 0 && (
            <>
              <ContextMenuItem onClick={handleDownloadSelected}>
                <Download className="h-4 w-4 mr-2" />
                {t("sftp.context.downloadSelected", { count: selectedFiles.size })}
              </ContextMenuItem>
              <ContextMenuItem
                className="text-destructive"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("sftp.context.deleteSelected", { count: selectedFiles.size })}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  </>
);
