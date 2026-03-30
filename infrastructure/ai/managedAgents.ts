import type { DiscoveredAgent, ExternalAgentConfig } from './types';

export type ManagedAgentKey = 'codex' | 'claude';

const MANAGED_AGENT_META: Record<ManagedAgentKey, { commandNames: string[] }> = {
  codex: { commandNames: ['codex', 'codex-acp'] },
  claude: { commandNames: ['claude', 'claude-agent-acp'] },
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
  return agent.command === 'codex' || agent.command === 'claude';
}

export function matchesManagedAgentConfig(
  agent: Pick<ExternalAgentConfig, 'id' | 'command' | 'acpCommand'>,
  agentKey: ManagedAgentKey,
): boolean {
  const meta = MANAGED_AGENT_META[agentKey];
  const basename = getCommandBasename(agent.command);
  return (
    agent.id === `discovered_${agentKey}` ||
    agent.acpCommand === `${agentKey}${agentKey === 'codex' ? '-acp' : '-agent-acp'}` ||
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
