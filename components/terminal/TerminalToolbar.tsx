/**
 * Terminal Toolbar
 * Displays Scripts, Highlight, Search buttons and close button in terminal status bar
 */
import { Check, Languages, X, Zap, Search, TextCursorInput } from 'lucide-react';
import React, { useState } from 'react';
import { useI18n } from '../../application/i18n/I18nProvider';
import { Host } from '../../types';
import { Button } from '../ui/button';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import HostKeywordHighlightPopover from './HostKeywordHighlightPopover';

export interface TerminalToolbarProps {
    status: 'connecting' | 'connected' | 'disconnected';
    host?: Host;
    onOpenScripts: () => void;
    onUpdateHost?: (host: Host) => void;
    showClose?: boolean;
    onClose?: () => void;
    // Search functionality
    isSearchOpen?: boolean;
    onToggleSearch?: () => void;
    // Compose bar
    isComposeBarOpen?: boolean;
    onToggleComposeBar?: () => void;
    // Terminal encoding
    terminalEncoding?: 'utf-8' | 'gb18030';
    onSetTerminalEncoding?: (encoding: 'utf-8' | 'gb18030') => void;
}

export const TerminalToolbar: React.FC<TerminalToolbarProps> = ({
    status,
    host,
    onOpenScripts,
    onUpdateHost,
    showClose,
    onClose,
    isSearchOpen,
    onToggleSearch,
    isComposeBarOpen,
    onToggleComposeBar,
    terminalEncoding,
    onSetTerminalEncoding,
}) => {
    const { t } = useI18n();
    const [highlightPopoverOpen, setHighlightPopoverOpen] = useState(false);
    const buttonBase = "h-6 w-6 p-0 shadow-none border-none text-[color:var(--terminal-toolbar-fg)] bg-transparent hover:bg-transparent";

    const isLocalTerminal = host?.protocol === 'local' || host?.id?.startsWith('local-');
    const isSerialTerminal = host?.protocol === 'serial' || host?.id?.startsWith('serial-');
    const isSSHSession = !isLocalTerminal && !isSerialTerminal && host?.protocol !== 'telnet' && !host?.moshEnabled && host?.hostname !== 'localhost';

    return (
        <TooltipProvider delayDuration={500} skipDelayDuration={100} disableHoverableContent>
            {isSSHSession && onSetTerminalEncoding && (
                <Popover>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className={buttonBase}
                                    aria-label={t("terminal.toolbar.encoding")}
                                >
                                    <Languages size={12} />
                                </Button>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent>{t("terminal.toolbar.encoding")}</TooltipContent>
                    </Tooltip>
                    <PopoverContent className="w-36 p-1" align="start">
                        {(["utf-8", "gb18030"] as const).map((enc) => (
                            <PopoverClose asChild key={enc}>
                                <button
                                    className={cn(
                                        "w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm hover:bg-secondary transition-colors",
                                        terminalEncoding === enc && "font-medium"
                                    )}
                                    onClick={() => onSetTerminalEncoding(enc)}
                                >
                                    <Check
                                        size={12}
                                        className={cn(
                                            "shrink-0",
                                            terminalEncoding === enc ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {t(`terminal.toolbar.encoding.${enc === "utf-8" ? "utf8" : enc}`)}
                                </button>
                            </PopoverClose>
                        ))}
                    </PopoverContent>
                </Popover>
            )}

            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="secondary"
                        size="icon"
                        className={buttonBase}
                        aria-label={t("terminal.toolbar.scripts")}
                        onClick={onOpenScripts}
                    >
                        <Zap size={12} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{t("terminal.toolbar.scripts")}</TooltipContent>
            </Tooltip>

            {!isLocalTerminal && !isSerialTerminal && (
                <HostKeywordHighlightPopover
                    host={host}
                    onUpdateHost={onUpdateHost}
                    isOpen={highlightPopoverOpen}
                    setIsOpen={setHighlightPopoverOpen}
                    buttonClassName={buttonBase}
                />
            )}

            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="secondary"
                        size="icon"
                        className={buttonBase}
                        aria-label={t("terminal.toolbar.composeBar")}
                        aria-pressed={isComposeBarOpen}
                        onClick={onToggleComposeBar}
                    >
                        <TextCursorInput size={12} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{t("terminal.toolbar.composeBar")}</TooltipContent>
            </Tooltip>

            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="secondary"
                        size="icon"
                        className={buttonBase}
                        aria-label={t("terminal.toolbar.searchTerminal")}
                        aria-pressed={isSearchOpen}
                        onClick={onToggleSearch}
                    >
                        <Search size={12} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{t("terminal.toolbar.searchTerminal")}</TooltipContent>
            </Tooltip>

            {showClose && onClose && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-[color:var(--terminal-toolbar-fg)] hover:bg-transparent"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                            }}
                        >
                            <X size={11} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("terminal.toolbar.closeSession")}</TooltipContent>
                </Tooltip>
            )}
        </TooltipProvider>
    );
};

export default TerminalToolbar;
