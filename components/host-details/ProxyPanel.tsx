/**
 * Proxy Configuration Sub-Panel
 * Panel for configuring HTTP/SOCKS5 proxy settings
 */
import { Check, Globe, KeyRound, Trash2 } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import { useI18n } from '../../application/i18n/I18nProvider';
import { isValidProxyPort } from '../../domain/proxyProfiles';
import { cn } from '../../lib/utils';
import { ProxyConfig, ProxyProfile } from '../../types';
import { AsidePanel, AsidePanelContent, type AsidePanelLayout } from '../ui/aside-panel';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface ProxyPanelProps {
    proxyConfig?: ProxyConfig;
    proxyProfiles?: ProxyProfile[];
    selectedProxyProfileId?: string;
    onUpdateProxy: (field: keyof ProxyConfig, value: string | number) => void;
    onSelectProxyProfile?: (profileId: string | undefined) => void;
    onClearProxy: () => void;
    onBack: () => void;
    onCancel: () => void;
    layout?: AsidePanelLayout;
}

export const ProxyPanel: React.FC<ProxyPanelProps> = ({
    proxyConfig,
    proxyProfiles = [],
    selectedProxyProfileId,
    onUpdateProxy,
    onSelectProxyProfile,
    onClearProxy,
    onBack,
    onCancel,
    layout = 'overlay',
}) => {
    const { t } = useI18n();
    const customValue = '__custom__';
    const selectedProfile = useMemo(
        () => proxyProfiles.find((profile) => profile.id === selectedProxyProfileId),
        [proxyProfiles, selectedProxyProfileId],
    );
    const hasMissingProfile = Boolean(selectedProxyProfileId && !selectedProfile);
    const selectedValue = selectedProfile ? selectedProfile.id : customValue;
    const isUsingProfile = Boolean(selectedProfile);
    const hasManualProxyHost = Boolean(proxyConfig?.host?.trim());
    const hasInvalidManualProxyPort = hasManualProxyHost && !isValidProxyPort(proxyConfig?.port);
    const canSave = isUsingProfile || (hasManualProxyHost && !hasInvalidManualProxyPort);
    const handleBack = useCallback(() => {
        if (hasInvalidManualProxyPort) return;
        onBack();
    }, [hasInvalidManualProxyPort, onBack]);

    return (
        <AsidePanel
            open={true}
            onClose={onCancel}
            title={t('hostDetails.proxyPanel.title')}
            showBackButton={true}
            onBack={handleBack}
            layout={layout}
            actions={
                <Button size="sm" onClick={handleBack} disabled={!canSave}>
                    {t('common.save')}
                </Button>
            }
        >
            <AsidePanelContent>
                {(proxyProfiles.length > 0 || hasMissingProfile) && onSelectProxyProfile && (
                    <Card className="p-3 space-y-3 bg-card border-border/80">
                        <div className="flex items-center gap-2">
                            <Globe size={14} className="text-muted-foreground" />
                            <p className="text-xs font-semibold">{t('hostDetails.proxyPanel.savedProxy')}</p>
                        </div>
                        <Select
                            value={selectedValue}
                            onValueChange={(value) => onSelectProxyProfile(value === customValue ? undefined : value)}
                        >
                            <SelectTrigger
                                aria-label={t('hostDetails.proxyPanel.savedProxy')}
                                className="h-10"
                            >
                                <SelectValue placeholder={t('hostDetails.proxyPanel.selectSaved')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={customValue}>{t('hostDetails.proxyPanel.customProxy')}</SelectItem>
                                {proxyProfiles.map((profile) => (
                                    <SelectItem key={profile.id} value={profile.id}>
                                        {profile.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {hasMissingProfile && (
                            <div className="min-w-0 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
                                {t('hostDetails.proxyPanel.missingSaved')}
                            </div>
                        )}
                        {selectedProfile && (
                            <div className="min-w-0 rounded-md bg-secondary/50 p-2 text-sm">
                                <div className="flex min-w-0 items-center gap-2">
                                    <Badge variant="secondary" className="text-xs shrink-0">
                                        {selectedProfile.config.type.toUpperCase()}
                                    </Badge>
                                    <span className="truncate">
                                        {selectedProfile.config.host}:{selectedProfile.config.port}
                                    </span>
                                </div>
                            </div>
                        )}
                    </Card>
                )}

                {!isUsingProfile && (
                    <>
                        <Card className="p-3 space-y-3 bg-card border-border/80">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <Globe size={14} className="text-muted-foreground" />
                                    <p className="text-xs font-semibold">{t('field.type')}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant={proxyConfig?.type === 'http' ? "secondary" : "ghost"}
                                        size="sm"
                                        className={cn("h-8", proxyConfig?.type === 'http' && "bg-primary/15")}
                                        onClick={() => onUpdateProxy('type', 'http')}
                                    >
                                        <Check size={14} className={cn("mr-1", proxyConfig?.type !== 'http' && "opacity-0")} />
                                        HTTP
                                    </Button>
                                    <Button
                                        variant={proxyConfig?.type === 'socks5' ? "secondary" : "ghost"}
                                        size="sm"
                                        className={cn("h-8", proxyConfig?.type === 'socks5' && "bg-primary/15")}
                                        onClick={() => onUpdateProxy('type', 'socks5')}
                                    >
                                        <Check size={14} className={cn("mr-1", proxyConfig?.type !== 'socks5' && "opacity-0")} />
                                        SOCKS5
                                    </Button>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Input
                                    aria-label={t('hostDetails.proxyPanel.hostPlaceholder')}
                                    placeholder={t('hostDetails.proxyPanel.hostPlaceholder')}
                                    value={proxyConfig?.host || ""}
                                    onChange={(e) => onUpdateProxy('host', e.target.value)}
                                    className="h-10 flex-1"
                                />
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-muted-foreground">{t('hostDetails.port')}</span>
                                    <Input
                                        aria-label={t('hostDetails.port')}
                                        type="number"
                                        placeholder="3128"
                                        min={1}
                                        max={65535}
                                        step={1}
                                        value={proxyConfig?.port || ""}
                                        onChange={(e) => onUpdateProxy('port', parseInt(e.target.value) || 0)}
                                        className="h-10 w-20 text-center"
                                    />
                                </div>
                            </div>
                            {hasInvalidManualProxyPort && (
                                <p className="text-xs text-destructive">
                                    {t('proxyProfiles.error.port')}
                                </p>
                            )}
                        </Card>

                        <Card className="p-3 space-y-3 bg-card border-border/80">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <KeyRound size={14} className="text-muted-foreground" />
                                    <p className="text-xs font-semibold">{t('hostDetails.proxyPanel.credentials')}</p>
                                </div>
                                <Badge variant="secondary" className="text-xs">{t('common.optional')}</Badge>
                            </div>
                            <Input
                                aria-label={t('hostDetails.proxyPanel.usernamePlaceholder')}
                                placeholder={t('hostDetails.proxyPanel.usernamePlaceholder')}
                                value={proxyConfig?.username || ""}
                                onChange={(e) => onUpdateProxy('username', e.target.value)}
                                className="h-10"
                            />
                            <Input
                                aria-label={t('hostDetails.proxyPanel.passwordPlaceholder')}
                                placeholder={t('hostDetails.proxyPanel.passwordPlaceholder')}
                                type="password"
                                value={proxyConfig?.password || ""}
                                onChange={(e) => onUpdateProxy('password', e.target.value)}
                                className="h-10"
                            />
                        </Card>
                    </>
                )}

                {(proxyConfig?.host || selectedProxyProfileId) && (
                    <Button variant="ghost" className="w-full h-10 text-destructive" onClick={onClearProxy}>
                        <Trash2 size={14} className="mr-2" /> {t('hostDetails.proxyPanel.remove')}
                    </Button>
                )}
            </AsidePanelContent>
        </AsidePanel>
    );
};

export default ProxyPanel;
