/**
 * SyncStatusButton - Simple WebDAV Cloud Sync for Top Bar
 *
 * Shows current sync state with cloud icon and colored indicators:
 * - Gray dot: Not configured — click to set up WebDAV
 * - Green dot: Configured — click to push/pull
 * - Spinning: Sync in progress
 * - Red dot: Error
 */

import React, { useCallback, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Cloud,
  CloudOff,
  Eye,
  EyeOff,
  Loader2,
  Server,
  Unplug,
} from 'lucide-react';
import { useSimpleSync } from '../application/state/useSimpleSync';
import { useI18n } from '../application/i18n/I18nProvider';
import type { SyncPayload, WebDAVAuthType, WebDAVConfig } from '../domain/sync';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from './ui/toast';

// ============================================================================
// Status Dot
// ============================================================================

type DotStatus = 'configured' | 'syncing' | 'error' | 'unconfigured';

const StatusDot: React.FC<{ status: DotStatus; className?: string }> = ({ status, className }) => {
  const colors: Record<DotStatus, string> = {
    configured: 'bg-green-500',
    syncing: 'bg-blue-500 animate-pulse',
    error: 'bg-red-500',
    unconfigured: 'bg-muted-foreground/30',
  };
  return <span className={cn('w-2 h-2 rounded-full', colors[status], className)} />;
};

// ============================================================================
// WebDAV Config Form
// ============================================================================

interface ConfigFormProps {
  onConnect: (config: WebDAVConfig, password: string) => Promise<void>;
  isConnecting: boolean;
}

const ConfigForm: React.FC<ConfigFormProps> = ({ onConnect, isConnecting }) => {
  const { t } = useI18n();
  const [endpoint, setEndpoint] = useState('');
  const [authType, setAuthType] = useState<WebDAVAuthType>('basic');
  const [username, setUsername] = useState('');
  const [webdavPassword, setWebdavPassword] = useState('');
  const [token, setToken] = useState('');
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [showEncPassword, setShowEncPassword] = useState(false);
  const [showWebdavPassword, setShowWebdavPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const config: WebDAVConfig = {
      endpoint,
      authType,
      ...(authType !== 'token' ? { username, password: webdavPassword } : { token }),
    };
    await onConnect(config, encryptionPassword);
  };

  const canSubmit = endpoint.trim() && encryptionPassword.trim() && !isConnecting;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="sync-endpoint" className="text-xs">{t('sync.config.endpointUrl')}</Label>
        <Input
          id="sync-endpoint"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder={t('sync.config.endpointPlaceholder')}
          className="h-8 text-xs"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sync-auth-type" className="text-xs">{t('sync.config.authType')}</Label>
        <Select value={authType} onValueChange={(v) => setAuthType(v as WebDAVAuthType)}>
          <SelectTrigger id="sync-auth-type" className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="basic">{t('sync.config.authBasic')}</SelectItem>
            <SelectItem value="digest">{t('sync.config.authDigest')}</SelectItem>
            <SelectItem value="token">{t('sync.config.authToken')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {authType !== 'token' ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="sync-username" className="text-xs">{t('sync.config.username')}</Label>
            <Input
              id="sync-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sync-password" className="text-xs">{t('sync.config.password')}</Label>
            <div className="relative">
              <Input
                id="sync-password"
                type={showWebdavPassword ? 'text' : 'password'}
                value={webdavPassword}
                onChange={(e) => setWebdavPassword(e.target.value)}
                className="h-8 text-xs pr-8"
              />
              <button
                type="button"
                onClick={() => setShowWebdavPassword(!showWebdavPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showWebdavPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="sync-token" className="text-xs">{t('sync.config.token')}</Label>
          <div className="relative">
            <Input
              id="sync-token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="h-8 text-xs pr-8"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="sync-enc-password" className="text-xs">{t('sync.config.encryptionPassword')}</Label>
        <div className="relative">
          <Input
            id="sync-enc-password"
            type={showEncPassword ? 'text' : 'password'}
            value={encryptionPassword}
            onChange={(e) => setEncryptionPassword(e.target.value)}
            placeholder={t('sync.config.encryptionPlaceholder')}
            className="h-8 text-xs pr-8"
          />
          <button
            type="button"
            onClick={() => setShowEncPassword(!showEncPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showEncPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <Button type="submit" size="sm" className="w-full gap-1.5" disabled={!canSubmit}>
        {isConnecting ? <Loader2 size={14} className="animate-spin" /> : <Server size={14} />}
        {t('sync.config.connect')}
      </Button>
    </form>
  );
};

// ============================================================================
// Connected View
// ============================================================================

interface ConnectedViewProps {
  onPush: () => Promise<void>;
  onPull: () => Promise<void>;
  onDisconnect: () => void;
  isSyncing: boolean;
  lastError: string | null;
  endpoint: string;
}

const ConnectedView: React.FC<ConnectedViewProps> = ({
  onPush, onPull, onDisconnect, isSyncing, lastError, endpoint,
}) => {
  const { t } = useI18n();
  let displayEndpoint = endpoint;
  try {
    const url = new URL(endpoint);
    displayEndpoint = url.host;
  } catch { /* keep raw */ }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Server size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium">WebDAV</div>
          <div className="text-[11px] text-muted-foreground truncate">{displayEndpoint}</div>
        </div>
      </div>

      {lastError && (
        <div className="text-xs text-red-500 bg-red-500/10 rounded-md p-2 break-words">
          {lastError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={isSyncing}
          onClick={onPush}
        >
          {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={14} />}
          {t('sync.action.push')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={isSyncing}
          onClick={onPull}
        >
          {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <ArrowDown size={14} />}
          {t('sync.action.pull')}
        </Button>
      </div>

      <button
        onClick={onDisconnect}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors w-full justify-center pt-1"
      >
        <Unplug size={12} />
        {t('sync.action.disconnect')}
      </button>
    </div>
  );
};

// ============================================================================
// Main SyncStatusButton
// ============================================================================

interface SyncStatusButtonProps {
  onBuildPayload: () => SyncPayload;
  onApplyPayload: (payload: SyncPayload) => void;
  className?: string;
}

export const SyncStatusButton: React.FC<SyncStatusButtonProps> = ({
  onBuildPayload,
  onApplyPayload,
  className,
}) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const sync = useSimpleSync();

  const dotStatus: DotStatus = sync.isSyncing
    ? 'syncing'
    : sync.lastError
      ? 'error'
      : sync.status === 'configured'
        ? 'configured'
        : 'unconfigured';

  const handleConnect = useCallback(async (config: WebDAVConfig, password: string) => {
    try {
      const localPayload = onBuildPayload();
      const remotePayload = await sync.configure(config, password, localPayload);
      if (remotePayload) {
        onApplyPayload(remotePayload);
        toast.success(t('sync.toast.connectedPulled'), t('sync.cloudSync'));
      } else {
        toast.success(t('sync.toast.connectedPushed'), t('sync.cloudSync'));
      }
      setIsOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('sync.toast.connectionFailed'),
        t('sync.cloudSync'),
      );
    }
  }, [sync, onBuildPayload, onApplyPayload, t]);

  const handlePush = useCallback(async () => {
    try {
      const payload = onBuildPayload();
      await sync.push(payload);
      toast.success(t('sync.toast.pushed'), t('sync.cloudSync'));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('sync.toast.pushFailed'),
        t('sync.cloudSync'),
      );
    }
  }, [sync, onBuildPayload, t]);

  const handlePull = useCallback(async () => {
    try {
      const payload = await sync.pull();
      onApplyPayload(payload);
      toast.success(t('sync.toast.pulled'), t('sync.cloudSync'));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('sync.toast.pullFailed'),
        t('sync.cloudSync'),
      );
    }
  }, [sync, onApplyPayload, t]);

  const handleDisconnect = useCallback(() => {
    sync.disconnect();
    toast.info(t('sync.toast.disconnected'), t('sync.cloudSync'));
  }, [sync, t]);

  const getButtonIcon = () => {
    if (sync.isSyncing) return <Loader2 size={16} className="animate-spin" />;
    if (sync.status === 'configured') return <Cloud size={16} />;
    return <CloudOff size={16} />;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8 relative text-muted-foreground hover:text-foreground app-no-drag',
            className,
          )}
          title={t('sync.cloudSync')}
        >
          {getButtonIcon()}
          <StatusDot
            status={dotStatus}
            className="absolute top-0.5 right-0.5 ring-2 ring-background"
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-border/60">
          <div className="flex items-center gap-2">
            {sync.status === 'configured' ? (
              <Cloud size={16} className="text-green-500" />
            ) : sync.isSyncing ? (
              <Loader2 size={16} className="text-blue-500 animate-spin" />
            ) : sync.lastError ? (
              <Cloud size={16} className="text-red-500" />
            ) : (
              <CloudOff size={16} className="text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              {sync.isSyncing
                ? t('sync.syncing')
                : sync.lastError
                  ? t('sync.error')
                  : sync.status === 'configured'
                    ? t('sync.cloudSync')
                    : t('sync.notConfigured')}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          {sync.status === 'unconfigured' || (sync.status === 'error' && !sync.webdavConfig) ? (
            <ConfigForm onConnect={handleConnect} isConnecting={sync.isSyncing} />
          ) : (
            <ConnectedView
              onPush={handlePush}
              onPull={handlePull}
              onDisconnect={handleDisconnect}
              isSyncing={sync.isSyncing}
              lastError={sync.lastError}
              endpoint={sync.webdavConfig?.endpoint || ''}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SyncStatusButton;
