/**
 * ChatInput - Zed-style bottom input area for the AI chat panel
 *
 * Thin wrapper around the AI Elements prompt-input components.
 * Bordered textarea with monospace placeholder, expand toggle,
 * and a bottom toolbar with muted controls + subtle send button.
 */

import { Cpu, Expand, Plus, Shield, Sparkles } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '../ai-elements/prompt-input';
import type { PromptInputStatus } from '../ai-elements/prompt-input';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  providerName?: string;
  modelName?: string;
  permissionMode?: string;
  agentName?: string;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  providerName,
  modelName,
  permissionMode,
  agentName,
  placeholder,
}) => {
  const [expanded, setExpanded] = useState(false);

  const defaultPlaceholder = agentName
    ? `Message ${agentName} — @ to include context, / for commands`
    : 'Message Catty Agent...';

  const handleSubmit = useCallback(
    (_text: string, _event: FormEvent<HTMLFormElement>) => {
      onSend();
    },
    [onSend],
  );

  const status: PromptInputStatus = isStreaming ? 'streaming' : 'idle';

  const permissionLabel =
    permissionMode === 'observer'
      ? 'Read Only'
      : permissionMode === 'autonomous'
        ? 'Auto'
        : 'Confirm';

  const modelLabel = modelName || providerName || 'No model';
  const chipClassName =
    'inline-flex h-6 items-center gap-1 rounded-full px-1.5 text-[10.5px] text-foreground/72';
  const iconButtonClassName =
    'h-6 w-6 rounded-full bg-transparent text-foreground/62 hover:bg-muted/24 hover:text-foreground';

  return (
    <div className="shrink-0 px-4 pb-4">
      <PromptInput onSubmit={handleSubmit}>
        {/* Textarea with expand toggle */}
        <div className="relative">
          <PromptInputTextarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || defaultPlaceholder}
            disabled={disabled || isStreaming}
            className={expanded ? 'max-h-[220px]' : undefined}
          />
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="absolute top-3.5 right-3 rounded-md p-1 text-muted-foreground/38 hover:text-muted-foreground/72 hover:bg-muted/25 transition-colors cursor-pointer"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            <Expand size={12} />
          </button>
        </div>

        {/* Footer toolbar */}
        <PromptInputFooter className="gap-1.5 border-t-0 bg-transparent px-3 pb-2 pt-0">
          <PromptInputTools className="gap-1 flex-wrap">
            <PromptInputButton tooltip="Attach context" className={iconButtonClassName}>
              <Plus size={13} />
            </PromptInputButton>
            <div className={chipClassName}>
              <Sparkles size={11} className="text-primary" />
              <span className="truncate max-w-[92px]">{agentName || 'Catty Agent'}</span>
            </div>
            <div className={chipClassName}>
              <Cpu size={11} className="text-muted-foreground/64" />
              <span className="truncate max-w-[82px]">{modelLabel}</span>
            </div>
            <div className={chipClassName}>
              <Shield size={11} className="text-muted-foreground/64" />
              <span>{permissionLabel}</span>
            </div>
          </PromptInputTools>

          <div className="flex-1 min-w-0" />

          <div className="flex items-center gap-1">
            <PromptInputSubmit
              status={status}
              onStop={onStop}
              disabled={!value.trim() || disabled}
            />
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
};

export default React.memo(ChatInput);
