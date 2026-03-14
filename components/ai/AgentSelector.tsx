/**
 * AgentSelector - Dropdown for switching between AI agents
 *
 * Dark, grouped agent menu with local SVG branding for built-in and
 * external agents.
 */

import { ChevronDown } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import type { AgentInfo, ExternalAgentConfig } from '../../infrastructure/ai/types';
import AgentIconBadge from './AgentIconBadge';
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from '../ui/dropdown';

interface AgentSelectorProps {
  currentAgentId: string;
  externalAgents: ExternalAgentConfig[];
  onSelectAgent: (agentId: string) => void;
  onManageAgents?: () => void;
}

const BUILTIN_AGENTS: AgentInfo[] = [
  {
    id: 'catty',
    name: 'Catty Agent',
    type: 'builtin',
    description: 'Built-in terminal assistant',
    available: true,
  },
];

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-4 pb-2 pt-2 text-[10px] font-medium tracking-wide text-muted-foreground/52">
    {children}
  </div>
);

const AgentMenuRow: React.FC<{
  agent: AgentInfo;
  onClick: () => void;
}> = ({ agent, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-full items-center gap-3 rounded-md px-4 text-left text-[13px] text-foreground/86 transition-colors cursor-pointer hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
    >
      <AgentIconBadge agent={agent} size="xs" variant="plain" className="opacity-78" />
      <span className="min-w-0 flex-1 truncate">{agent.name}</span>
    </button>
  );
};

const AgentSelector: React.FC<AgentSelectorProps> = ({
  currentAgentId,
  externalAgents,
  onSelectAgent,
  onManageAgents,
}) => {
  const [open, setOpen] = useState(false);

  const enabledExternalAgents = useMemo(
    () =>
      externalAgents
        .filter((agent) => agent.enabled)
        .map(
          (agent): AgentInfo => ({
            id: agent.id,
            name: agent.name,
            type: 'external',
            icon: agent.icon,
            command: agent.command,
            args: agent.args,
            available: true,
          }),
        ),
    [externalAgents],
  );

  const allAgents = useMemo(
    () => [...BUILTIN_AGENTS, ...enabledExternalAgents],
    [enabledExternalAgents],
  );

  const currentAgent = useMemo(
    () => allAgents.find((agent) => agent.id === currentAgentId) ?? BUILTIN_AGENTS[0],
    [allAgents, currentAgentId],
  );

  const handleSelect = useCallback(
    (agentId: string) => {
      onSelectAgent(agentId);
      setOpen(false);
    },
    [onSelectAgent],
  );

  const handleManageAgents = useCallback(() => {
    setOpen(false);
    onManageAgents?.();
  }, [onManageAgents]);

  return (
    <Dropdown open={open} onOpenChange={setOpen}>
      <DropdownTrigger asChild>
        <button
          type="button"
          className="group flex h-8 min-w-0 max-w-[170px] items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/28"
        >
          <AgentIconBadge
            agent={currentAgent}
            size="xs"
            variant="plain"
            className="opacity-78"
          />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground/90">
            {currentAgent.name}
          </span>
          <ChevronDown
            size={12}
            className={cn(
              'shrink-0 text-muted-foreground/60 transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </DropdownTrigger>

      <DropdownContent
        align="start"
        sideOffset={6}
        className="w-[288px] rounded-2xl border border-border/50 bg-[#171717]/98 p-0 text-foreground shadow-[0_22px_56px_rgba(0,0,0,0.54)] supports-[backdrop-filter]:bg-[#171717]/94 supports-[backdrop-filter]:backdrop-blur-xl"
      >
        {BUILTIN_AGENTS.map((agent) => (
          <AgentMenuRow
            key={agent.id}
            agent={agent}
            onClick={() => handleSelect(agent.id)}
          />
        ))}

        {enabledExternalAgents.length > 0 && (
          <>
            <div className="mx-0 my-1 border-t border-border/50" />
            <SectionLabel>External Agents</SectionLabel>
            {enabledExternalAgents.map((agent) => (
              <AgentMenuRow
                key={agent.id}
                agent={agent}
                onClick={() => handleSelect(agent.id)}
              />
            ))}
          </>
        )}

        <div className="mx-0 my-1 border-t border-border/50" />
        <button
          onClick={handleManageAgents}
          className="flex h-10 w-full items-center gap-3 rounded-md px-4 text-left text-[13px] text-foreground/82 transition-colors cursor-pointer hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
        >
          <AgentIconBadge agent="add-more" size="xs" variant="plain" className="opacity-72" />
          <span className="min-w-0 flex-1 truncate">Add More Agents</span>
        </button>
      </DropdownContent>
    </Dropdown>
  );
};

export default React.memo(AgentSelector);
