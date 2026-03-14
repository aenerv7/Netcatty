/**
 * Settings AI Tab - AI provider configuration, external agents, and safety settings
 */
import {
  Bot,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  Pencil,
  Plus,
  ScanSearch,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import type {
  AIPermissionMode,
  AIProviderId,
  ExternalAgentConfig,
  ProviderConfig,
} from "../../../infrastructure/ai/types";
import { PROVIDER_PRESETS } from "../../../infrastructure/ai/types";
import { encryptField, decryptField } from "../../../infrastructure/persistence/secureFieldAdapter";
import { TabsContent } from "../../ui/tabs";
import { Button } from "../../ui/button";
import { Toggle, Select, SettingRow } from "../settings-ui";
import { cn } from "../../../lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SettingsAITabProps {
  providers: ProviderConfig[];
  addProvider: (provider: ProviderConfig) => void;
  updateProvider: (id: string, updates: Partial<ProviderConfig>) => void;
  removeProvider: (id: string) => void;
  activeProviderId: string;
  setActiveProviderId: (id: string) => void;
  activeModelId: string;
  setActiveModelId: (id: string) => void;
  globalPermissionMode: AIPermissionMode;
  setGlobalPermissionMode: (mode: AIPermissionMode) => void;
  externalAgents: ExternalAgentConfig[];
  setExternalAgents: (value: ExternalAgentConfig[] | ((prev: ExternalAgentConfig[]) => ExternalAgentConfig[])) => void;
  defaultAgentId: string;
  setDefaultAgentId: (id: string) => void;
  commandTimeout: number;
  setCommandTimeout: (value: number) => void;
  maxIterations: number;
  setMaxIterations: (value: number) => void;
}

// ---------------------------------------------------------------------------
// Provider icon helper
// ---------------------------------------------------------------------------

const PROVIDER_ICON_PATHS: Record<AIProviderId, string> = {
  openai: "/ai/providers/openai.svg",
  anthropic: "/ai/providers/anthropic.svg",
  google: "/ai/providers/google.svg",
  ollama: "/ai/providers/ollama.svg",
  openrouter: "/ai/providers/openrouter.svg",
  custom: "/ai/providers/custom.svg",
};

const PROVIDER_COLORS: Record<AIProviderId, string> = {
  openai: "bg-emerald-600",
  anthropic: "bg-orange-600",
  google: "bg-blue-600",
  ollama: "bg-purple-600",
  openrouter: "bg-pink-600",
  custom: "bg-zinc-600",
};

const ProviderIconBadge: React.FC<{
  providerId: AIProviderId;
  size?: "sm" | "md";
}> = ({ providerId, size = "md" }) => (
  <div
    className={cn(
      "rounded-md flex items-center justify-center shrink-0 overflow-hidden",
      size === "sm" ? "w-5 h-5" : "w-8 h-8",
      PROVIDER_COLORS[providerId],
    )}
  >
    <img
      src={PROVIDER_ICON_PATHS[providerId]}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn(
        "object-contain brightness-0 invert",
        size === "sm" ? "w-3 h-3" : "w-4 h-4",
      )}
    />
  </div>
);

// ---------------------------------------------------------------------------
// Provider Config Form (inline expandable)
// ---------------------------------------------------------------------------

interface ProviderFormState {
  apiKey: string;
  baseURL: string;
  defaultModel: string;
}

const ProviderConfigForm: React.FC<{
  provider: ProviderConfig;
  onSave: (updates: Partial<ProviderConfig>) => void;
  onCancel: () => void;
}> = ({ provider, onSave, onCancel }) => {
  const [form, setForm] = useState<ProviderFormState>({
    apiKey: "",
    baseURL: provider.baseURL ?? PROVIDER_PRESETS[provider.providerId]?.defaultBaseURL ?? "",
    defaultModel: provider.defaultModel ?? "",
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Decrypt and load existing API key on mount
  useEffect(() => {
    if (provider.apiKey) {
      setIsDecrypting(true);
      decryptField(provider.apiKey)
        .then((decrypted) => {
          setForm((prev) => ({ ...prev, apiKey: decrypted ?? "" }));
        })
        .catch(() => {
          // If decryption fails, show raw value
          setForm((prev) => ({ ...prev, apiKey: provider.apiKey ?? "" }));
        })
        .finally(() => setIsDecrypting(false));
    }
  }, [provider.apiKey]);

  const handleSave = useCallback(async () => {
    const updates: Partial<ProviderConfig> = {
      baseURL: form.baseURL || undefined,
      defaultModel: form.defaultModel || undefined,
    };

    // Encrypt API key before saving
    if (form.apiKey) {
      updates.apiKey = await encryptField(form.apiKey);
    } else {
      updates.apiKey = undefined;
    }

    onSave(updates);
  }, [form, onSave]);

  return (
    <div className="mt-3 space-y-3 border-t border-border/40 pt-3">
      {/* API Key */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">API Key</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type={showApiKey ? "text" : "password"}
              value={isDecrypting ? "" : form.apiKey}
              onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
              placeholder={isDecrypting ? "Decrypting..." : "Enter API key"}
              disabled={isDecrypting}
              className="w-full h-8 rounded-md border border-input bg-background px-3 pr-9 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Base URL */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Base URL</label>
        <input
          type="text"
          value={form.baseURL}
          onChange={(e) => setForm((prev) => ({ ...prev, baseURL: e.target.value }))}
          placeholder={PROVIDER_PRESETS[provider.providerId]?.defaultBaseURL || "https://"}
          className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Default Model */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Default Model</label>
        <input
          type="text"
          value={form.defaultModel}
          onChange={(e) => setForm((prev) => ({ ...prev, defaultModel: e.target.value }))}
          placeholder="e.g. gpt-4o, claude-sonnet-4-20250514"
          className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button variant="default" size="sm" onClick={() => void handleSave()}>
          <Check size={14} className="mr-1.5" />
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Provider Card
// ---------------------------------------------------------------------------

const ProviderCard: React.FC<{
  provider: ProviderConfig;
  isActive: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onEdit: () => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<ProviderConfig>) => void;
  isEditing: boolean;
  onCancelEdit: () => void;
}> = ({ provider, isActive, onToggleEnabled, onEdit, onRemove, onUpdate, isEditing, onCancelEdit }) => {
  const hasApiKey = !!provider.apiKey;

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors",
        isActive ? "border-primary/50 bg-primary/5" : "border-border/60 bg-muted/20",
      )}
    >
      <div className="flex items-center gap-3">
        {/* Provider icon */}
        <ProviderIconBadge providerId={provider.providerId} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{provider.name}</span>
            {isActive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={cn(
                "text-xs",
                hasApiKey ? "text-emerald-500" : "text-muted-foreground",
              )}
            >
              {hasApiKey ? "API key configured" : "No API key"}
            </span>
            {provider.defaultModel && (
              <>
                <span className="text-muted-foreground text-xs">|</span>
                <span className="text-xs text-muted-foreground truncate">{provider.defaultModel}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Configure"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Remove"
          >
            <Trash2 size={14} />
          </button>
          <Toggle checked={provider.enabled} onChange={onToggleEnabled} />
        </div>
      </div>

      {/* Expandable config form */}
      {isEditing && (
        <ProviderConfigForm
          provider={provider}
          onSave={(updates) => {
            onUpdate(updates);
            onCancelEdit();
          }}
          onCancel={onCancelEdit}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Add Provider Dropdown
// ---------------------------------------------------------------------------

const AddProviderDropdown: React.FC<{
  onAdd: (providerId: AIProviderId) => void;
}> = ({ onAdd }) => {
  const [isOpen, setIsOpen] = useState(false);

  const providerIds = Object.keys(PROVIDER_PRESETS) as AIProviderId[];

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-1.5"
      >
        <Plus size={14} />
        Add Provider
        <ChevronDown size={12} className={cn("transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
          {/* Menu */}
          <div className="absolute top-full left-0 mt-1 z-[101] min-w-[200px] rounded-md border border-border bg-popover shadow-md py-1">
            {providerIds.map((pid) => (
              <button
                key={pid}
                onClick={() => {
                  onAdd(pid);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
              >
                <ProviderIconBadge providerId={pid} size="sm" />
                {PROVIDER_PRESETS[pid].name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// External Agent Card
// ---------------------------------------------------------------------------

const ExternalAgentCard: React.FC<{
  agent: ExternalAgentConfig;
  isDefault: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onSetDefault: () => void;
  onRemove: () => void;
}> = ({ agent, isDefault, onToggleEnabled, onSetDefault, onRemove }) => (
  <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-border/60 bg-muted/20">
    <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
      <Bot size={14} className="text-muted-foreground" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium truncate">{agent.name}</span>
        {isDefault && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
            Default
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
        {agent.command} {agent.args?.join(" ") ?? ""}
      </div>
    </div>
    <div className="flex items-center gap-1 shrink-0">
      {!isDefault && (
        <button
          onClick={onSetDefault}
          className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Set as default"
        >
          Set default
        </button>
      )}
      <button
        onClick={onRemove}
        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        title="Remove"
      >
        <Trash2 size={14} />
      </button>
      <Toggle checked={agent.enabled} onChange={onToggleEnabled} />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Add Agent Form
// ---------------------------------------------------------------------------

const AddAgentForm: React.FC<{
  onAdd: (agent: ExternalAgentConfig) => void;
  onCancel: () => void;
}> = ({ onAdd, onCancel }) => {
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");

  const handleSubmit = useCallback(() => {
    if (!name.trim() || !command.trim()) return;
    onAdd({
      id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      command: command.trim(),
      args: args.trim() ? args.trim().split(/\s+/) : undefined,
      enabled: true,
    });
  }, [name, command, args, onAdd]);

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Agent name"
          className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Command</label>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="e.g. /usr/local/bin/my-agent"
          className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Arguments (space-separated)</label>
        <input
          type="text"
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          placeholder="e.g. --stdio --verbose"
          className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button variant="default" size="sm" onClick={handleSubmit} disabled={!name.trim() || !command.trim()}>
          <Plus size={14} className="mr-1.5" />
          Add Agent
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Tab Component
// ---------------------------------------------------------------------------

const SettingsAITab: React.FC<SettingsAITabProps> = ({
  providers,
  addProvider,
  updateProvider,
  removeProvider,
  activeProviderId,
  setActiveProviderId,
  activeModelId,
  setActiveModelId,
  globalPermissionMode,
  setGlobalPermissionMode,
  externalAgents,
  setExternalAgents,
  defaultAgentId,
  setDefaultAgentId,
  commandTimeout,
  setCommandTimeout,
  maxIterations,
  setMaxIterations,
}) => {
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Add a new provider from preset
  const handleAddProvider = useCallback(
    (providerId: AIProviderId) => {
      const preset = PROVIDER_PRESETS[providerId];
      const id = `provider_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      addProvider({
        id,
        providerId,
        name: preset.name,
        baseURL: preset.defaultBaseURL,
        enabled: true,
      });
      // Auto-open config form
      setEditingProviderId(id);
    },
    [addProvider],
  );

  // Remove provider with confirmation
  const handleRemoveProvider = useCallback(
    (id: string) => {
      removeProvider(id);
      if (editingProviderId === id) {
        setEditingProviderId(null);
      }
    },
    [removeProvider, editingProviderId],
  );

  // Provider options for default model select
  const enabledProviders = providers.filter((p) => p.enabled);
  const providerOptions = enabledProviders.map((p) => ({ value: p.id, label: p.name }));

  // Permission mode options
  const permissionModeOptions = [
    { value: "observer", label: "Observer - Read only, no actions" },
    { value: "confirm", label: "Confirm - Ask before actions" },
    { value: "autonomous", label: "Autonomous - Execute freely" },
  ];

  // Agent options for default agent
  const agentOptions = [
    { value: "catty", label: "Catty (Built-in)" },
    ...externalAgents
      .filter((a) => a.enabled)
      .map((a) => ({ value: a.id, label: a.name })),
  ];

  // Scan for external agents on PATH
  const handleScanAgents = useCallback(async () => {
    setIsScanning(true);
    // Simulated scan - in production this would use the bridge to scan PATH
    // For now just set a timeout to show the scanning state
    setTimeout(() => {
      setIsScanning(false);
    }, 1500);
  }, []);

  // Add external agent
  const handleAddAgent = useCallback(
    (agent: ExternalAgentConfig) => {
      setExternalAgents((prev) => [...prev, agent]);
      setShowAddAgent(false);
    },
    [setExternalAgents],
  );

  // Remove external agent
  const handleRemoveAgent = useCallback(
    (id: string) => {
      setExternalAgents((prev) => prev.filter((a) => a.id !== id));
      if (defaultAgentId === id) {
        setDefaultAgentId("catty");
      }
    },
    [setExternalAgents, defaultAgentId, setDefaultAgentId],
  );

  // Toggle agent enabled
  const handleToggleAgent = useCallback(
    (id: string, enabled: boolean) => {
      setExternalAgents((prev) =>
        prev.map((a) => (a.id === id ? { ...a, enabled } : a)),
      );
    },
    [setExternalAgents],
  );

  return (
    <TabsContent
      value="ai"
      className="data-[state=inactive]:hidden h-full flex flex-col"
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-8 py-6">
        <div className="max-w-2xl space-y-8">
          {/* Header */}
          <div>
            <h2 className="text-xl font-semibold">AI</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure AI providers, agents, and safety settings
            </p>
          </div>

          {/* ── Providers Section ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-muted-foreground" />
                <h3 className="text-base font-medium">Providers</h3>
              </div>
              <AddProviderDropdown onAdd={handleAddProvider} />
            </div>

            {providers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
                <Bot size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No providers configured. Add a provider to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {providers.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    isActive={provider.id === activeProviderId}
                    onToggleEnabled={(enabled) =>
                      updateProvider(provider.id, { enabled })
                    }
                    onEdit={() =>
                      setEditingProviderId(
                        editingProviderId === provider.id ? null : provider.id,
                      )
                    }
                    onRemove={() => handleRemoveProvider(provider.id)}
                    onUpdate={(updates) => updateProvider(provider.id, updates)}
                    isEditing={editingProviderId === provider.id}
                    onCancelEdit={() => setEditingProviderId(null)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Default Model Section ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-muted-foreground" />
              <h3 className="text-base font-medium">Default Model</h3>
            </div>

            <div className="bg-muted/30 rounded-lg p-4 space-y-1">
              <SettingRow
                label="Active Provider"
                description="Select which AI provider to use by default"
              >
                <Select
                  value={activeProviderId}
                  options={providerOptions}
                  onChange={setActiveProviderId}
                  className="w-48"
                  placeholder="None"
                />
              </SettingRow>

              <SettingRow
                label="Model"
                description="Model identifier to use for AI requests"
              >
                <input
                  type="text"
                  value={activeModelId}
                  onChange={(e) => setActiveModelId(e.target.value)}
                  placeholder="e.g. gpt-4o"
                  className="w-48 h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </SettingRow>
            </div>
          </div>

          {/* ── External Agents Section ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScanSearch size={18} className="text-muted-foreground" />
                <h3 className="text-base font-medium">External Agents</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleScanAgents()}
                  disabled={isScanning}
                  className="gap-1.5"
                >
                  <ScanSearch size={14} className={isScanning ? "animate-spin" : ""} />
                  {isScanning ? "Scanning..." : "Scan for Agents"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddAgent(!showAddAgent)}
                  className="gap-1.5"
                >
                  {showAddAgent ? <X size={14} /> : <Plus size={14} />}
                  {showAddAgent ? "Cancel" : "Add Agent"}
                </Button>
              </div>
            </div>

            {showAddAgent && (
              <AddAgentForm
                onAdd={handleAddAgent}
                onCancel={() => setShowAddAgent(false)}
              />
            )}

            {externalAgents.length === 0 && !showAddAgent ? (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
                <ScanSearch size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No external agents configured. Scan for agents or add one manually.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {externalAgents.map((agent) => (
                  <ExternalAgentCard
                    key={agent.id}
                    agent={agent}
                    isDefault={agent.id === defaultAgentId}
                    onToggleEnabled={(enabled) => handleToggleAgent(agent.id, enabled)}
                    onSetDefault={() => setDefaultAgentId(agent.id)}
                    onRemove={() => handleRemoveAgent(agent.id)}
                  />
                ))}
              </div>
            )}

            {/* Default Agent selection */}
            {agentOptions.length > 1 && (
              <div className="bg-muted/30 rounded-lg p-4">
                <SettingRow
                  label="Default Agent"
                  description="Agent to use when starting a new AI session"
                >
                  <Select
                    value={defaultAgentId}
                    options={agentOptions}
                    onChange={setDefaultAgentId}
                    className="w-48"
                  />
                </SettingRow>
              </div>
            )}
          </div>

          {/* ── Safety Section ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-muted-foreground" />
              <h3 className="text-base font-medium">Safety</h3>
            </div>

            <div className="bg-muted/30 rounded-lg p-4 space-y-1">
              <SettingRow
                label="Permission Mode"
                description="Controls how the AI interacts with your terminals"
              >
                <Select
                  value={globalPermissionMode}
                  options={permissionModeOptions}
                  onChange={(val) => setGlobalPermissionMode(val as AIPermissionMode)}
                  className="w-64"
                />
              </SettingRow>

              <SettingRow
                label="Command Timeout"
                description="Maximum seconds a command can run before being terminated"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={commandTimeout}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val > 0) setCommandTimeout(val);
                    }}
                    min={1}
                    max={3600}
                    className="w-20 h-9 rounded-md border border-input bg-background px-3 text-sm text-right focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">sec</span>
                </div>
              </SettingRow>

              <SettingRow
                label="Max Iterations"
                description="Maximum number of AI tool-use loops to prevent runaway execution"
              >
                <input
                  type="number"
                  value={maxIterations}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val > 0) setMaxIterations(val);
                  }}
                  min={1}
                  max={100}
                  className="w-20 h-9 rounded-md border border-input bg-background px-3 text-sm text-right focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </SettingRow>
            </div>

            <p className="text-xs text-muted-foreground">
              Safety settings apply globally. Per-host overrides can be configured in the connection settings.
            </p>
          </div>
        </div>
      </div>
    </TabsContent>
  );
};

export default SettingsAITab;
