import type {
  ExternalAgentConfig,
} from './types';

/** Callbacks for streaming external agent output */
export interface ExternalAgentCallbacks {
  onTextDelta: (text: string) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

/**
 * Bridge interface matching the agent-related methods from window.netcatty
 */
interface AgentBridge {
  aiSpawnAgent(agentId: string, command: string, args?: string[], env?: Record<string, string>): Promise<{ ok: boolean; pid?: number; error?: string }>;
  aiWriteToAgent(agentId: string, data: string): Promise<{ ok: boolean; error?: string }>;
  aiKillAgent(agentId: string): Promise<{ ok: boolean; error?: string }>;
  onAiAgentStdout(agentId: string, cb: (data: string) => void): () => void;
  onAiAgentStderr(agentId: string, cb: (data: string) => void): () => void;
  onAiAgentExit(agentId: string, cb: (code: number) => void): () => void;
}

/**
 * Start an external agent and send a message through it.
 * The agent communicates via stdin/stdout with newline-delimited text.
 *
 * For agents that don't support ACP (most CLI agents), we use a simpler
 * interaction model: pipe the user message to stdin and stream stdout as response text.
 */
export async function runExternalAgentTurn(
  config: ExternalAgentConfig,
  userMessage: string,
  callbacks: ExternalAgentCallbacks,
  bridge: AgentBridge | undefined,
  signal?: AbortSignal,
): Promise<void> {
  if (!bridge) {
    callbacks.onError('Bridge not available');
    return;
  }

  const agentId = `ext_${config.id}_${Date.now()}`;

  // Spawn the agent process
  const result = await bridge.aiSpawnAgent(
    agentId,
    config.command,
    config.args,
    config.env,
  );

  if (!result.ok) {
    callbacks.onError(`Failed to start ${config.name}: ${result.error}`);
    return;
  }

  const cleanupFns: (() => void)[] = [];

  return new Promise<void>((resolve) => {
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      for (const fn of cleanupFns) {
        try { fn(); } catch { /* cleanup */ }
      }
      callbacks.onDone();
      resolve();
    };

    // Handle abort
    if (signal) {
      const onAbort = () => {
        bridge.aiKillAgent(agentId).catch(() => {});
        callbacks.onError('Cancelled');
        finish();
      };
      signal.addEventListener('abort', onAbort, { once: true });
      cleanupFns.push(() => signal.removeEventListener('abort', onAbort));
    }

    // Stream stdout as text
    const unsubStdout = bridge.onAiAgentStdout(agentId, (data) => {
      if (!done) {
        callbacks.onTextDelta(data);
      }
    });
    cleanupFns.push(unsubStdout);

    // Capture stderr for errors/logging
    const unsubStderr = bridge.onAiAgentStderr(agentId, (_data) => {
      // Some agents use stderr for status, don't treat as error
      // Just log it or ignore
    });
    cleanupFns.push(unsubStderr);

    // Handle exit
    const unsubExit = bridge.onAiAgentExit(agentId, (_code) => {
      finish();
    });
    cleanupFns.push(unsubExit);

    // Send the user message to stdin and close stdin
    bridge.aiWriteToAgent(agentId, userMessage + '\n').catch((err) => {
      callbacks.onError(`Failed to write to agent: ${err}`);
      finish();
    });

    // Timeout after 5 minutes
    const timeout = setTimeout(() => {
      if (!done) {
        bridge.aiKillAgent(agentId).catch(() => {});
        callbacks.onError('Agent timeout (5 minutes)');
        finish();
      }
    }, 300000);
    cleanupFns.push(() => clearTimeout(timeout));
  });
}

/**
 * Kill a running external agent session
 */
export async function killExternalAgent(
  agentId: string,
  bridge: AgentBridge | undefined,
): Promise<void> {
  if (bridge) {
    await bridge.aiKillAgent(agentId).catch(() => {});
  }
}
