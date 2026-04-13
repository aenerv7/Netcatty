import type { DiscoveredAgent, ExternalAgentConfig, ProviderConfig } from './types';

export type ManagedAgentKey = 'codex' | 'claude' | 'copilot';

const MANAGED_AGENT_META: Record<ManagedAgentKey, { commandNames: string[]; acpCommand: string }> = {
  codex: { commandNames: ['codex', 'codex-acp'], acpCommand: 'codex-acp' },
  claude: { commandNames: ['claude', 'claude-agent-acp'], acpCommand: 'claude-agent-acp' },
  copilot: { commandNames: ['copilot'], acpCommand: 'copilot' },
};

function getCommandBasename(command: string | undefined): string {
  const normalized = String(command || '').trim();
  if (!normalized) return '';
  const parts = normalized.split(/[\\/]/);
  return (parts.pop() || '').toLowerCase();
}

function isPathLikeCommand(command: string | undefined): boolean {
  const normalized = String(command || '').trim();
  return normalized.includes('/') || normalized.includes('\\');
}

function matchesPrimaryCliBasename(command: string | undefined, agentKey: ManagedAgentKey): boolean {
  const basename = getCommandBasename(command);
  return basename === agentKey || basename.startsWith(`${agentKey}.`);
}

export function isSettingsManagedDiscoveredAgent(
  agent: Pick<DiscoveredAgent, 'command'>,
): agent is Pick<DiscoveredAgent, 'command'> & { command: ManagedAgentKey } {
  return agent.command === 'codex' || agent.command === 'claude' || agent.command === 'copilot';
}

export function matchesManagedAgentConfig(
  agent: Pick<ExternalAgentConfig, 'id' | 'command' | 'acpCommand'>,
  agentKey: ManagedAgentKey,
): boolean {
  const meta = MANAGED_AGENT_META[agentKey];
  const basename = getCommandBasename(agent.command);
  return (
    agent.id === `discovered_${agentKey}` ||
    agent.acpCommand === meta.acpCommand ||
    meta.commandNames.some((commandName) => basename === commandName || basename.startsWith(`${commandName}.`))
  );
}

export function getManagedAgentStoredPath(
  agents: ExternalAgentConfig[],
  agentKey: ManagedAgentKey,
): string | null {
  const managedId = `discovered_${agentKey}`;
  const preferredAgent = agents.find(
    (agent) =>
      agent.id === managedId &&
      isPathLikeCommand(agent.command) &&
      matchesPrimaryCliBasename(agent.command, agentKey),
  );
  if (preferredAgent) {
    return preferredAgent.command;
  }

  const fallbackAgent = agents.find(
    (agent) =>
      matchesManagedAgentConfig(agent, agentKey) &&
      isPathLikeCommand(agent.command) &&
      matchesPrimaryCliBasename(agent.command, agentKey),
  );
  return fallbackAgent?.command ?? null;
}

// Codex agent deliberately excluded: its auth is owned by ~/.codex/auth.json
// or ~/.codex/config.toml and must not be affected by netcatty's provider list
// (see issue #705).
export function findManagedAgentProvider(
  providers: ProviderConfig[],
  agentKey: ManagedAgentKey,
): ProviderConfig | undefined {
  if (agentKey === 'claude') {
    return (
      providers.find((provider) => provider.providerId === 'anthropic' && provider.enabled && !!provider.apiKey)
      ?? providers.find((provider) => provider.providerId === 'custom' && provider.enabled && !!provider.apiKey && !!provider.baseURL)
    );
  }

  return undefined;
}
