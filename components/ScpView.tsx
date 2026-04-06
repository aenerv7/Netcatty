/**
 * ScpView - SCP File Browser
 *
 * Reuses the entire SftpView UI but connects in SCP mode (SSH exec for
 * directory listing, cat/pipe for file transfers). This is for devices
 * that don't support the SFTP subsystem.
 *
 * The SCP instance uses its own ActiveTabStoreProvider (created inside
 * SftpView when scpMode=true) so the left/right pane tab IDs don't
 * collide with the SFTP tab's store.
 */

import React, { memo, useEffect, useState, Suspense, lazy } from "react";
import { useIsScpActive } from "../application/state/activeTabStore";
import type { Host, Identity, SSHKey, GroupConfig, HotkeyScheme, KeyBinding } from "../domain/models";

const LazySftpView = lazy(() =>
  import("./SftpView").then((m) => ({ default: m.SftpView })),
);

interface ScpViewProps {
  hosts: Host[];
  keys: SSHKey[];
  identities: Identity[];
  groupConfigs?: GroupConfig[];
  updateHosts: (hosts: Host[]) => void;
  sftpDefaultViewMode: "list" | "tree";
  sftpDoubleClickBehavior: "open" | "transfer";
  sftpAutoSync: boolean;
  sftpShowHiddenFiles: boolean;
  sftpUseCompressedUpload: boolean;
  hotkeyScheme: HotkeyScheme;
  keyBindings: KeyBinding[];
  editorWordWrap: boolean;
  setEditorWordWrap: (enabled: boolean) => void;
}

const ScpViewInner: React.FC<ScpViewProps> = (props) => {
  const isActive = useIsScpActive();
  const [shouldMount, setShouldMount] = useState(isActive);

  useEffect(() => {
    if (isActive) setShouldMount(true);
  }, [isActive]);

  if (!shouldMount) return null;

  // SftpView handles its own visibility via isActive/containerStyle internally
  return (
    <Suspense fallback={null}>
      <LazySftpView {...props} scpMode />
    </Suspense>
  );
};

export const ScpView = memo(ScpViewInner);
