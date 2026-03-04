import React, { useCallback, useState, useRef, useMemo } from "react";
import type { RemoteFile } from "../../../types";
import { toast } from "../../ui/toast";
import {
  UploadController,
  uploadFromDataTransfer,
  uploadFromFileList,
  uploadEntriesDirect,
  UploadBridge,
  UploadCallbacks,
  UploadTaskInfo,
  UploadProgress,
} from "../../../lib/uploadService";
import { DropEntry } from "../../../lib/sftpFileUtils";

interface TransferTask {
  id: string;
  fileName: string;
  status: "pending" | "uploading" | "downloading" | "completed" | "failed" | "cancelled";
  progress: number;
  totalBytes: number;
  transferredBytes: number;
  speed: number;
  startTime: number;
  error?: string;
  isDirectory?: boolean;
  fileCount?: number;
  completedCount?: number;
  direction: "upload" | "download";
}

// Keep UploadTask as alias for backwards compatibility
type UploadTask = TransferTask;

interface UseSftpModalTransfersParams {
  currentPath: string;
  isLocalSession: boolean;
  joinPath: (base: string, name: string) => string;
  ensureSftp: () => Promise<string>;
  loadFiles: (path: string, options?: { force?: boolean }) => Promise<void>;
  readLocalFile: (path: string) => Promise<ArrayBuffer>;
  readSftp: (sftpId: string, path: string) => Promise<string>;
  listSftp?: (sftpId: string, path: string) => Promise<RemoteFile[]>;
  deleteLocalFile?: (path: string) => Promise<void>;
  writeLocalFile: (path: string, data: ArrayBuffer) => Promise<void>;
  writeSftpBinaryWithProgress: (
    sftpId: string,
    path: string,
    data: ArrayBuffer,
    taskId: string,
    onProgress: (transferred: number, total: number, speed: number) => void,
    onComplete: () => void,
    onError: (error: string) => void,
  ) => Promise<{ success: boolean; transferId: string; cancelled?: boolean }>;
  writeSftpBinary: (sftpId: string, path: string, data: ArrayBuffer) => Promise<void>;
  writeSftp: (sftpId: string, path: string, data: string) => Promise<void>;
  mkdirLocal: (path: string) => Promise<void>;
  mkdirSftp: (sftpId: string, path: string) => Promise<void>;
  cancelSftpUpload?: (taskId: string) => Promise<unknown>;
  startStreamTransfer?: (
    options: {
      transferId: string;
      sourcePath: string;
      targetPath: string;
      sourceType: 'local' | 'sftp';
      targetType: 'local' | 'sftp';
      sourceSftpId?: string;
      targetSftpId?: string;
      totalBytes?: number;
    },
    onProgress?: (transferred: number, total: number, speed: number) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ) => Promise<{ transferId: string; totalBytes?: number; error?: string }>;
  cancelTransfer?: (transferId: string) => Promise<void>;
  showSaveDialog?: (defaultPath: string, filters?: Array<{ name: string; extensions: string[] }>) => Promise<string | null>;
  setLoading: (loading: boolean) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
  useCompressedUpload?: boolean; // Enable compressed folder uploads
}

interface UseSftpModalTransfersResult {
  uploading: boolean;
  uploadTasks: UploadTask[];
  dragActive: boolean;
  handleDownload: (file: RemoteFile) => Promise<void>;
  handleUploadMultiple: (fileList: FileList) => Promise<void>;
  handleUploadFromDrop: (dataTransfer: DataTransfer) => Promise<void>;
  handleUploadEntries: (entries: DropEntry[]) => Promise<void>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFolderSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  cancelUpload: () => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;
  dismissTask: (taskId: string) => void;
}

export const useSftpModalTransfers = ({
  currentPath,
  isLocalSession,
  joinPath,
  ensureSftp,
  loadFiles,
  readLocalFile,
  writeLocalFile,
  writeSftpBinaryWithProgress,
  writeSftpBinary,
  mkdirLocal,
  mkdirSftp,
  cancelSftpUpload,
  startStreamTransfer,
  cancelTransfer,
  showSaveDialog,
  setLoading,
  t,
  useCompressedUpload = false,
  listSftp,
  deleteLocalFile,
}: UseSftpModalTransfersParams): UseSftpModalTransfersResult => {
  const [uploading, setUploading] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Upload controller for cancellation support
  const uploadControllerRef = useRef<UploadController | null>(null);

  // Cached SFTP ID to avoid multiple calls to ensureSftp
  const cachedSftpIdRef = useRef<string | null>(null);

  // Track cancelled transfer IDs to detect cancellation in bridge wrapper
  const cancelledTransferIdsRef = useRef<Set<string>>(new Set());

  // Track active child transfer IDs for directory downloads (parentId -> childId)
  const activeChildTransferIdsRef = useRef<Map<string, string>>(new Map());

  // Create upload bridge that adapts the modal's functions to the service interface
  const createUploadBridge = useMemo((): UploadBridge => {
    return {
      writeLocalFile,
      mkdirLocal,
      mkdirSftp: async (sftpId: string, path: string) => {
        await mkdirSftp(sftpId, path);
      },
      writeSftpBinary: async (sftpId: string, path: string, data: ArrayBuffer) => {
        await writeSftpBinary(sftpId, path, data);
      },
      writeSftpBinaryWithProgress: async (
        sftpId: string,
        path: string,
        data: ArrayBuffer,
        taskId: string,
        onProgress: (transferred: number, total: number, speed: number) => void,
        onComplete?: () => void,
        onError?: (error: string) => void
      ) => {
        try {
          const result = await writeSftpBinaryWithProgress(
            sftpId,
            path,
            data,
            taskId,
            onProgress,
            onComplete || (() => { }),
            onError || (() => { })
          );

          // Check if this transfer was cancelled
          const wasCancelled = cancelledTransferIdsRef.current.has(taskId);
          if (wasCancelled) {
            cancelledTransferIdsRef.current.delete(taskId);
          }
          return { success: result.success, transferId: result.transferId, cancelled: wasCancelled || result.cancelled };
        } catch (error) {
          // Check if this was a user-initiated cancellation
          const wasCancelled = cancelledTransferIdsRef.current.has(taskId);
          if (wasCancelled) {
            cancelledTransferIdsRef.current.delete(taskId);
            return { success: false, transferId: taskId, cancelled: true };
          }
          // Real error - propagate it by re-throwing
          throw error;
        }
      },
      cancelSftpUpload,
      startStreamTransfer: startStreamTransfer ? async (
        options,
        onProgress,
        onComplete,
        onError
      ) => {
        try {
          const result = await startStreamTransfer(options, onProgress, onComplete, onError);
          const wasCancelled = cancelledTransferIdsRef.current.has(options.transferId);
          if (wasCancelled) {
            cancelledTransferIdsRef.current.delete(options.transferId);
          }
          // Handle case where result might be undefined (bridge not available)
          if (!result) {
            return { transferId: options.transferId, error: 'Stream transfer not available' };
          }
          return { ...result, cancelled: wasCancelled };
        } catch (error) {
          const wasCancelled = cancelledTransferIdsRef.current.has(options.transferId);
          if (wasCancelled) {
            cancelledTransferIdsRef.current.delete(options.transferId);
            return { transferId: options.transferId, cancelled: true };
          }
          return { transferId: options.transferId, error: error instanceof Error ? error.message : String(error) };
        }
      } : undefined,
      cancelTransfer,
    };
  }, [writeLocalFile, mkdirLocal, mkdirSftp, writeSftpBinary, writeSftpBinaryWithProgress, cancelSftpUpload, startStreamTransfer, cancelTransfer]);

  // Create upload callbacks
  const createUploadCallbacks = useCallback((): UploadCallbacks => {
    return {
      onScanningStart: (taskId: string) => {
        const scanningTask: UploadTask = {
          id: taskId,
          fileName: t("sftp.upload.scanning"),
          status: "pending",
          progress: 0,
          totalBytes: 0,
          transferredBytes: 0,
          speed: 0,
          startTime: Date.now(),
          isDirectory: true,
          direction: "upload",
        };
        setUploadTasks(prev => [...prev, scanningTask]);
      },
      onScanningEnd: (taskId: string) => {
        setUploadTasks(prev => prev.filter(t => t.id !== taskId));
      },
      onTaskCreated: (task: UploadTaskInfo) => {
        const uploadTask: UploadTask = {
          id: task.id,
          fileName: task.displayName,
          status: "pending",
          progress: 0,
          totalBytes: task.totalBytes,
          transferredBytes: 0,
          speed: 0,
          startTime: Date.now(),
          isDirectory: task.isDirectory,
          direction: "upload",
        };
        setUploadTasks(prev => [...prev, uploadTask]);
      },
      onTaskProgress: (taskId: string, progress: UploadProgress) => {
        setUploadTasks(prev =>
          prev.map(task => {
            if (task.id !== taskId) return task;

            // Don't update progress if task is already completed, failed, or cancelled
            if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
              return task;
            }

            const totalBytes = progress.total > 0 ? progress.total : task.totalBytes;
            const clampedTransferred = Math.max(
              task.transferredBytes,
              Math.min(progress.transferred, totalBytes > 0 ? totalBytes : progress.transferred)
            );
            const rawPercent = totalBytes > 0 ? (clampedTransferred / totalBytes) * 100 : task.progress;
            const clampedPercent = Math.max(task.progress, Math.min(rawPercent, 100));

            return {
              ...task,
              status: "uploading" as const,
              totalBytes,
              progress: clampedPercent,
              transferredBytes: clampedTransferred,
              speed: Number.isFinite(progress.speed) && progress.speed > 0 ? progress.speed : 0,
            };
          })
        );
      },
      onTaskCompleted: (taskId: string, totalBytes: number) => {
        setUploadTasks(prev =>
          prev.map(task =>
            task.id === taskId
              ? {
                ...task,
                status: "completed" as const,
                progress: 100,
                transferredBytes: totalBytes,
                speed: 0,
              }
              : task
          )
        );
      },
      onTaskFailed: (taskId: string, error: string) => {
        setUploadTasks(prev =>
          prev.map(task =>
            task.id === taskId
              ? {
                ...task,
                status: "failed" as const,
                speed: 0,
                error,
              }
              : task
          )
        );
      },
      onTaskCancelled: (taskId: string) => {
        setUploadTasks(prev =>
          prev.map(task =>
            task.id === taskId
              ? {
                ...task,
                status: "cancelled" as const,
                speed: 0,
              }
              : task
          )
        );
      },
      onTaskNameUpdate: (taskId: string, newName: string) => {
        // Parse the phase format: "folderName|phase"
        let displayName = newName;
        if (newName.includes('|')) {
          const [folderName, phase] = newName.split('|');
          const phaseLabel = phase === 'compressing' ? t('sftp.upload.phase.compressing')
            : phase === 'extracting' ? t('sftp.upload.phase.extracting')
              : phase === 'uploading' ? t('sftp.upload.phase.uploading')
                : t('sftp.upload.phase.compressed');
          displayName = `${folderName} (${phaseLabel})`;
        }
        setUploadTasks(prev =>
          prev.map(task =>
            task.id === taskId
              ? {
                ...task,
                fileName: displayName,
              }
              : task
          )
        );
      },
    };
  }, [t]);

  // Helper function to perform upload with compression setting from user preference
  const performUpload = useCallback(async (
    files: FileList | File[],
    useCompressed: boolean
  ): Promise<void> => {
    if (files.length === 0) return;

    setUploading(true);

    // Get SFTP ID for remote sessions
    let sftpId: string | null = null;
    if (!isLocalSession) {
      sftpId = await ensureSftp();
      cachedSftpIdRef.current = sftpId;
    }

    // Create controller for cancellation
    const controller = new UploadController();
    uploadControllerRef.current = controller;

    const callbacks = createUploadCallbacks();

    try {
      await uploadFromFileList(
        files,
        {
          targetPath: currentPath,
          sftpId,
          isLocal: isLocalSession,
          bridge: createUploadBridge,
          joinPath,
          callbacks,
          useCompressedUpload: useCompressed,
        },
        controller
      );

      await loadFiles(currentPath, { force: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("sftp.error.uploadFailed"),
        "SFTP"
      );
    } finally {
      // Upload process is complete - clear uploading state and controller
      setUploading(false);
      uploadControllerRef.current = null;
      cachedSftpIdRef.current = null;
    }
  }, [currentPath, createUploadBridge, createUploadCallbacks, ensureSftp, isLocalSession, joinPath, loadFiles, t]);

  const handleDownload = useCallback(
    async (file: RemoteFile) => {
      try {
        const fullPath = joinPath(currentPath, file.name);

        // For local files, use blob download (file is already on local filesystem)
        if (isLocalSession) {
          setLoading(true);
          const content = await readLocalFile(fullPath);
          const blob = new Blob([content], { type: "application/octet-stream" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
        }

        // For remote SFTP files/directories, use streaming download with save dialog
        if (!showSaveDialog || !startStreamTransfer) {
          toast.error(t("sftp.error.downloadFailed"), "SFTP");
          return;
        }

        // Check if this is a directory download
        const isDirectory = file.type === 'directory' || (file.type === 'symlink' && file.linkTarget === 'directory');

        if (isDirectory) {
          // For directories, download recursively
          if (!listSftp) {
            toast.error(t("sftp.error.downloadFailed"), "SFTP");
            return;
          }

          // Show save dialog to get target path (the saved "file" becomes the folder path)
          const targetPath = await showSaveDialog(file.name);
          if (!targetPath) return;

          const sftpId = await ensureSftp();
          const transferId = `download-dir-${Date.now()}-${Math.random().toString(36).slice(2)}`;

          // Track the currently active child transfer ID for cancellation
          let activeChildTransferId: string | null = null;
          const setActiveChild = (childId: string | null) => {
            activeChildTransferId = childId;
            if (childId) {
              activeChildTransferIdsRef.current.set(transferId, childId);
            } else {
              activeChildTransferIdsRef.current.delete(transferId);
            }
          };

          // Create download task for progress display
          const downloadTask: TransferTask = {
            id: transferId,
            fileName: file.name,
            status: "downloading",
            progress: 0,
            totalBytes: 0,
            transferredBytes: 0,
            speed: 0,
            startTime: Date.now(),
            direction: "download",
            isDirectory: true,
          };
          setUploadTasks(prev => [...prev, downloadTask]);

          try {
            // Safely create target directory.
            // showSaveDialog "Replace" may leave a file (not directory) at the path,
            // so we remove it first — ONLY in this explicit overwrite context.
            try {
              await createUploadBridge.mkdirLocal(targetPath);
            } catch (mkdirErr: unknown) {
              const isEEXIST = mkdirErr instanceof Error && mkdirErr.message.includes('EEXIST');
              if (isEEXIST && deleteLocalFile) {
                // Path exists as a file (from save dialog replace), remove it and retry
                await deleteLocalFile(targetPath);
                await createUploadBridge.mkdirLocal(targetPath);
              } else {
                throw mkdirErr;
              }
            }

            // Recursively download directory contents
            let completedBytes = 0;
            // Track visited remote paths to prevent symlink cycles
            const visitedPaths = new Set<string>();
            const MAX_RECURSION_DEPTH = 32;

            const downloadDir = async (remotePath: string, localPath: string, depth = 0): Promise<void> => {
              // Prevent excessive recursion (catches symlink cycles like loop -> .)
              if (depth > MAX_RECURSION_DEPTH) {
                throw new Error('Maximum directory depth exceeded (possible symlink cycle)');
              }
              // Prevent revisiting the same path
              if (visitedPaths.has(remotePath)) return;
              visitedPaths.add(remotePath);
              // Check if transfer was cancelled
              if (cancelledTransferIdsRef.current.has(transferId)) {
                throw new Error('Transfer cancelled');
              }

              const entries = await listSftp(sftpId, remotePath);

              for (const entry of entries) {
                if (entry.name === '..' || entry.name === '.') continue;

                // Check cancellation between files
                if (cancelledTransferIdsRef.current.has(transferId)) {
                  // Cancel the active child transfer if any
                  if (activeChildTransferId && cancelTransfer) {
                    try { await cancelTransfer(activeChildTransferId); } catch { /* ignore */ }
                  }
                  throw new Error('Transfer cancelled');
                }

                const remoteEntryPath = joinPath(remotePath, entry.name);
                const localEntryPath = `${localPath}/${entry.name}`;

                const isDir = entry.type === 'directory' || (entry.type === 'symlink' && entry.linkTarget === 'directory');
                if (isDir) {
                  try {
                    await createUploadBridge.mkdirLocal(localEntryPath);
                  } catch (mkdirErr: unknown) {
                    // Only ignore EEXIST (directory already exists), propagate other errors
                    const isEEXIST = mkdirErr instanceof Error && mkdirErr.message.includes('EEXIST');
                    if (!isEEXIST) throw mkdirErr;
                  }
                  await downloadDir(remoteEntryPath, localEntryPath, depth + 1);
                } else {
                  // Download individual file
                  const childTransferId = `download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                  activeChildTransferId = childTransferId;
                  setActiveChild(childTransferId);
                  const entrySize = typeof entry.size === 'number' ? entry.size : parseInt(String(entry.size), 10) || 0;

                  await new Promise<void>((resolve, reject) => {
                    startStreamTransfer(
                      {
                        transferId: childTransferId,
                        sourcePath: remoteEntryPath,
                        targetPath: localEntryPath,
                        sourceType: 'sftp',
                        targetType: 'local',
                        sourceSftpId: sftpId,
                        totalBytes: entrySize,
                      },
                      // onProgress - update parent task
                      (transferred, total, speed) => {
                        if (cancelledTransferIdsRef.current.has(transferId)) {
                          // Actively cancel the in-flight child transfer
                          if (cancelTransfer) {
                            cancelTransfer(childTransferId).catch(() => { /* ignore */ });
                          }
                          return;
                        }
                        const totalProgress = completedBytes + transferred;
                        setUploadTasks(prev =>
                          prev.map(task =>
                            task.id === transferId
                              ? {
                                ...task,
                                transferredBytes: Math.max(task.transferredBytes, totalProgress),
                                totalBytes: Math.max(task.totalBytes, totalProgress, completedBytes + total),
                                progress: (() => {
                                  const effectiveTotal = Math.max(task.totalBytes, completedBytes + total);
                                  if (effectiveTotal <= 0) return task.progress;
                                  const percent = (totalProgress / effectiveTotal) * 100;
                                  return Math.max(task.progress, Math.min(percent, 99));
                                })(),
                                speed: Number.isFinite(speed) && speed > 0 ? speed : 0,
                              }
                              : task
                          )
                        );
                      },
                      // onComplete
                      () => {
                        completedBytes += entrySize;
                        setActiveChild(null);
                        resolve();
                      },
                      // onError
                      (error) => {
                        setActiveChild(null);
                        reject(new Error(error));
                      }
                    ).then((result) => {
                      // Handle resolved result with error (e.g. cancellation)
                      if (result === undefined) {
                        setActiveChild(null);
                        reject(new Error('Stream transfer unavailable'));
                      } else if (result?.error) {
                        setActiveChild(null);
                        reject(new Error(result.error));
                      }
                    }).catch(reject);
                  });
                }
              }
            };

            await downloadDir(fullPath, targetPath);

            // Mark as completed
            setUploadTasks(prev =>
              prev.map(task =>
                task.id === transferId
                  ? {
                    ...task,
                    status: "completed" as const,
                    progress: 100,
                    transferredBytes: completedBytes,
                    totalBytes: completedBytes,
                    speed: 0,
                  }
                  : task
              )
            );
            toast.success(`${t("sftp.context.download")}: ${file.name}`, "SFTP");
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : t("sftp.error.downloadFailed");
            const isCancelError = errorMsg.includes('cancelled') || errorMsg.includes('canceled')
              || cancelledTransferIdsRef.current.has(transferId);
            setUploadTasks(prev =>
              prev.map(task =>
                task.id === transferId
                  ? {
                    ...task,
                    status: isCancelError ? "cancelled" as const : "failed" as const,
                    speed: 0,
                    error: isCancelError ? undefined : errorMsg,
                  }
                  : task
              )
            );
            if (!isCancelError) {
              toast.error(errorMsg, "SFTP");
            }
          } finally {
            cancelledTransferIdsRef.current.delete(transferId);
          }
          return;
        }

        // Show save dialog to get target path
        const targetPath = await showSaveDialog(file.name);
        if (!targetPath) {
          // User cancelled the save dialog
          return;
        }

        const sftpId = await ensureSftp();
        const transferId = `download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const fileSize = typeof file.size === 'number' ? file.size : parseInt(file.size, 10) || 0;

        // Create download task for progress display
        const downloadTask: TransferTask = {
          id: transferId,
          fileName: file.name,
          status: "downloading",
          progress: 0,
          totalBytes: fileSize,
          transferredBytes: 0,
          speed: 0,
          startTime: Date.now(),
          direction: "download",
        };
        setUploadTasks(prev => [...prev, downloadTask]);

        // Track if this download was cancelled or error was handled
        let wasCancelled = false;
        let errorHandled = false;

        const result = await startStreamTransfer(
          {
            transferId,
            sourcePath: fullPath,
            targetPath,
            sourceType: 'sftp',
            targetType: 'local',
            sourceSftpId: sftpId,
            totalBytes: fileSize,
          },
          // onProgress
          (transferred, total, speed) => {
            setUploadTasks(prev =>
              prev.map(task =>
                task.id === transferId
                  ? {
                    ...task,
                    transferredBytes: Math.max(
                      task.transferredBytes,
                      Math.min(transferred, total > 0 ? total : transferred)
                    ),
                    totalBytes: total > 0 ? total : task.totalBytes,
                    progress: (() => {
                      const effectiveTotal = total > 0 ? total : task.totalBytes;
                      if (effectiveTotal <= 0) return task.progress;
                      const percent = (Math.max(task.transferredBytes, transferred) / effectiveTotal) * 100;
                      return Math.max(task.progress, Math.min(percent, 100));
                    })(),
                    speed: Number.isFinite(speed) && speed > 0 ? speed : 0,
                  }
                  : task
              )
            );
          },
          // onComplete
          () => {
            setUploadTasks(prev =>
              prev.map(task =>
                task.id === transferId
                  ? {
                    ...task,
                    status: "completed" as const,
                    progress: 100,
                    transferredBytes: task.totalBytes > 0 ? task.totalBytes : task.transferredBytes,
                    speed: 0,
                  }
                  : task
              )
            );
            toast.success(`${t("sftp.context.download")}: ${file.name}`, "SFTP");
          },
          // onError
          (error) => {
            errorHandled = true;
            // Check if this is a cancellation error
            if (error.includes('cancelled') || error.includes('canceled')) {
              wasCancelled = true;
              setUploadTasks(prev =>
                prev.map(task =>
                  task.id === transferId
                    ? { ...task, status: "cancelled" as const, speed: 0 }
                    : task
                )
              );
            } else {
              setUploadTasks(prev =>
                prev.map(task =>
                  task.id === transferId
                    ? { ...task, status: "failed" as const, error }
                    : task
                )
              );
              toast.error(error, "SFTP");
            }
          }
        );

        // Check if bridge doesn't support streaming (returns undefined)
        if (result === undefined) {
          // Remove the pending task and show error
          setUploadTasks(prev => prev.filter(task => task.id !== transferId));
          toast.error(t("sftp.error.downloadFailed"), "SFTP");
          return;
        }

        // Handle result - check for cancellation in result.error as well
        // (backend may set error without calling onError callback)
        if (result?.error) {
          const isCancelError = result.error.includes('cancelled') || result.error.includes('canceled');
          if (isCancelError) {
            // Mark as cancelled if not already done by onError
            if (!wasCancelled) {
              setUploadTasks(prev =>
                prev.map(task =>
                  task.id === transferId
                    ? { ...task, status: "cancelled" as const, speed: 0 }
                    : task
                )
              );
            }
            // Don't show error for cancellation
            return;
          }
          // For non-cancel errors, only show toast if onError didn't already handle it
          if (!errorHandled) {
            setUploadTasks(prev =>
              prev.map(task =>
                task.id === transferId
                  ? { ...task, status: "failed" as const, error: result.error }
                  : task
              )
            );
            toast.error(result.error, "SFTP");
          }
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : t("sftp.error.downloadFailed"),
          "SFTP",
        );
      } finally {
        setLoading(false);
      }
    },
    [currentPath, ensureSftp, isLocalSession, joinPath, readLocalFile, setLoading, showSaveDialog, startStreamTransfer, t, listSftp, createUploadBridge, deleteLocalFile, cancelledTransferIdsRef, cancelTransfer],
  );



  const handleUploadMultiple = useCallback(
    async (fileList: FileList) => {
      if (fileList.length === 0) return;

      // Use compressed upload if enabled in settings (auto-fallback is handled in uploadService)
      await performUpload(fileList, useCompressedUpload);
    },
    [performUpload, useCompressedUpload],
  );

  const handleUploadFromDrop = useCallback(
    async (dataTransfer: DataTransfer) => {
      setUploading(true);

      // Get SFTP ID for remote sessions
      let sftpId: string | null = null;
      if (!isLocalSession) {
        sftpId = await ensureSftp();
        cachedSftpIdRef.current = sftpId;
      }

      // Create controller for cancellation
      const controller = new UploadController();
      uploadControllerRef.current = controller;

      const callbacks = createUploadCallbacks();

      try {
        await uploadFromDataTransfer(
          dataTransfer,
          {
            targetPath: currentPath,
            sftpId,
            isLocal: isLocalSession,
            bridge: createUploadBridge,
            joinPath,
            callbacks,
            useCompressedUpload,
          },
          controller
        );

        await loadFiles(currentPath, { force: true });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("sftp.error.uploadFailed"),
          "SFTP"
        );
      } finally {
        // Upload process is complete - clear uploading state and controller
        setUploading(false);
        uploadControllerRef.current = null;
        cachedSftpIdRef.current = null;
      }
    },
    [currentPath, createUploadBridge, createUploadCallbacks, ensureSftp, isLocalSession, joinPath, loadFiles, t, useCompressedUpload],
  );

  // Handle upload from DropEntry array (used for drag-and-drop to terminal)
  const handleUploadEntries = useCallback(
    async (entries: DropEntry[]) => {
      if (entries.length === 0) return;

      setUploading(true);

      // Get SFTP ID for remote sessions
      let sftpId: string | null = null;
      if (!isLocalSession) {
        sftpId = await ensureSftp();
        cachedSftpIdRef.current = sftpId;
      }

      // Create controller for cancellation
      const controller = new UploadController();
      uploadControllerRef.current = controller;

      const callbacks = createUploadCallbacks();

      try {
        await uploadEntriesDirect(
          entries,
          {
            targetPath: currentPath,
            sftpId,
            isLocal: isLocalSession,
            bridge: createUploadBridge,
            joinPath,
            callbacks,
            useCompressedUpload,
          },
          controller
        );

        await loadFiles(currentPath, { force: true });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("sftp.error.uploadFailed"),
          "SFTP"
        );
      } finally {
        // Upload process is complete - clear uploading state and controller
        setUploading(false);
        uploadControllerRef.current = null;
        cachedSftpIdRef.current = null;
      }
    },
    [currentPath, createUploadBridge, createUploadCallbacks, ensureSftp, isLocalSession, joinPath, loadFiles, t, useCompressedUpload],
  );

  // Handle upload from File array (used by file input after copying files)
  const handleUploadFromFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      // Use compressed upload if enabled in settings (auto-fallback is handled in uploadService)
      await performUpload(files, useCompressedUpload);
    },
    [performUpload, useCompressedUpload],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        // Copy the files before clearing the input, because clearing the input
        // will also clear the FileList reference
        const files = Array.from(e.target.files);
        // Clear input first to allow selecting the same files again
        e.target.value = "";
        // Now start the upload with the copied files
        void handleUploadFromFiles(files);
      } else {
        e.target.value = "";
      }
    },
    [handleUploadFromFiles],
  );

  const handleFolderSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        // Copy the files before clearing the input, because clearing the input
        // will also clear the FileList reference
        const files = Array.from(e.target.files);
        // Clear input first to allow selecting the same folder again
        e.target.value = "";
        // Now start the upload with the copied files
        void handleUploadFromFiles(files);
      } else {
        e.target.value = "";
      }
    },
    [handleUploadFromFiles],
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        void handleUploadFromDrop(e.dataTransfer);
      }
    },
    [handleUploadFromDrop],
  );

  const cancelUpload = useCallback(async () => {
    const controller = uploadControllerRef.current;
    if (controller) {
      // Mark all active transfer IDs as cancelled before calling cancel
      const activeIds = controller.getActiveTransferIds();
      for (const id of activeIds) {
        cancelledTransferIdsRef.current.add(id);
      }
      await controller.cancel();
    }

    // Always clear all uploading/pending tasks immediately, even without controller
    setUploadTasks(prev => {
      const hasActiveTasks = prev.some(t => t.status === "uploading" || t.status === "pending");
      if (!hasActiveTasks) {
        return prev;
      }

      return prev.map(task =>
        task.status === "uploading" || task.status === "pending"
          ? { ...task, status: "cancelled" as const, speed: 0 }
          : task
      );
    });

    // Also reset uploading state
    setUploading(false);
  }, []);

  // Cancel a specific task (works for both uploads and downloads)
  const cancelTask = useCallback(async (taskId: string) => {
    // Find the task to determine its type
    const task = uploadTasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.direction === "download") {
      // For download tasks, cancel the specific transfer
      // Add to cancelled set so recursive downloads can check
      cancelledTransferIdsRef.current.add(taskId);

      if (cancelTransfer) {
        try {
          // Cancel the parent task ID (works for single-file downloads)
          await cancelTransfer(taskId);
        } catch {
          // Ignore cancellation errors
        }
        // Also cancel the active child transfer for directory downloads
        const activeChildId = activeChildTransferIdsRef.current.get(taskId);
        if (activeChildId) {
          try {
            await cancelTransfer(activeChildId);
          } catch {
            // Ignore cancellation errors
          }
          activeChildTransferIdsRef.current.delete(taskId);
        }
      }
      // Mark task as cancelled
      setUploadTasks(prev =>
        prev.map(t =>
          t.id === taskId
            ? { ...t, status: "cancelled" as const, speed: 0 }
            : t
        )
      );
    } else {
      // For upload tasks, cancel the entire upload batch
      // because controller.cancel() cancels all active uploads
      const controller = uploadControllerRef.current;
      if (controller) {
        // Mark all active transfer IDs as cancelled before calling cancel
        const activeIds = controller.getActiveTransferIds();
        for (const id of activeIds) {
          cancelledTransferIdsRef.current.add(id);
        }
        await controller.cancel();
      }

      // Mark ALL uploading/pending tasks as cancelled (not just the clicked one)
      setUploadTasks(prev =>
        prev.map(t =>
          t.status === "uploading" || t.status === "pending"
            ? { ...t, status: "cancelled" as const, speed: 0 }
            : t
        )
      );

      // Reset uploading state
      setUploading(false);
    }
  }, [uploadTasks, cancelTransfer]);

  const dismissTask = useCallback((taskId: string) => {
    setUploadTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  return {
    uploading,
    uploadTasks,
    dragActive,
    handleDownload,
    handleUploadMultiple,
    handleUploadFromDrop,
    handleUploadEntries,
    handleFileSelect,
    handleFolderSelect,
    handleDrag,
    handleDrop,
    cancelUpload,
    cancelTask,
    dismissTask,
  };
};
