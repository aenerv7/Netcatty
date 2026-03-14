import { DEFAULT_COMMAND_BLOCKLIST } from '../types';

/**
 * Check if a command matches any pattern in the blocklist.
 * Returns the matching pattern if blocked, null if safe.
 */
export function checkCommandSafety(
  command: string,
  blocklist: string[] = DEFAULT_COMMAND_BLOCKLIST,
): { blocked: boolean; matchedPattern?: string } {
  for (const pattern of blocklist) {
    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(command)) {
        return { blocked: true, matchedPattern: pattern };
      }
    } catch {
      // Invalid regex pattern, skip
    }
  }
  return { blocked: false };
}

/**
 * Check if a command matches allowed patterns.
 * Used in autonomous mode to skip confirmation for known-safe commands.
 */
export function isCommandAllowed(
  command: string,
  allowedPatterns: string[],
): boolean {
  return allowedPatterns.some(pattern => {
    try {
      return new RegExp(pattern, 'i').test(command);
    } catch {
      return false;
    }
  });
}

/**
 * Determine if a tool call requires user permission.
 * Returns 'allow', 'confirm', or 'deny'.
 */
export function checkToolPermission(
  toolName: string,
  toolArgs: Record<string, unknown>,
  options: {
    permissionMode: 'observer' | 'confirm' | 'autonomous';
    commandBlocklist?: string[];
    allowedCommands?: string[];
    allowFileWrite?: boolean;
  },
): 'allow' | 'confirm' | 'deny' {
  // Read-only tools are always allowed
  const readOnlyTools = new Set([
    'terminal_read_output',
    'workspace_get_info',
    'workspace_get_session_info',
    'sftp_list_directory',
    'sftp_read_file',
  ]);

  if (readOnlyTools.has(toolName)) return 'allow';

  // Write/execute tools
  const writeTools = new Set([
    'terminal_execute',
    'terminal_send_input',
    'sftp_write_file',
    'multi_host_execute',
  ]);

  if (!writeTools.has(toolName)) return 'confirm'; // Unknown tool, require confirmation

  // Observer mode: deny all write operations
  if (options.permissionMode === 'observer') return 'deny';

  // Check command blocklist for execution tools
  if (toolName === 'terminal_execute' || toolName === 'multi_host_execute') {
    const command = String(toolArgs.command || '');
    const safety = checkCommandSafety(command, options.commandBlocklist);
    if (safety.blocked) return 'deny';
  }

  // Check file write permission
  if (toolName === 'sftp_write_file' && options.allowFileWrite === false) {
    return 'deny';
  }

  // Autonomous mode: allow if command is in allowed list, otherwise confirm
  if (options.permissionMode === 'autonomous') {
    if (toolName === 'terminal_execute' || toolName === 'multi_host_execute') {
      const command = String(toolArgs.command || '');
      if (options.allowedCommands && isCommandAllowed(command, options.allowedCommands)) {
        return 'allow';
      }
    }
    // For autonomous mode, allow most non-blocked operations
    return 'allow';
  }

  // Confirm mode: always require confirmation for write operations
  return 'confirm';
}

/**
 * Detect if the agent is in a doom loop (repeating the same actions).
 */
export function detectDoomLoop(
  recentToolCalls: Array<{ name: string; arguments: Record<string, unknown> }>,
  maxRepeats: number = 3,
): boolean {
  if (recentToolCalls.length < maxRepeats * 2) return false;

  // Check if the last N tool calls are identical
  const lastN = recentToolCalls.slice(-maxRepeats);
  const serialized = lastN.map(tc => `${tc.name}:${JSON.stringify(tc.arguments)}`);
  const allSame = serialized.every(s => s === serialized[0]);

  if (allSame) return true;

  // Check for alternating patterns (A-B-A-B)
  if (recentToolCalls.length >= maxRepeats * 2) {
    const pairs = recentToolCalls.slice(-maxRepeats * 2);
    const pairA = `${pairs[0].name}:${JSON.stringify(pairs[0].arguments)}`;
    const pairB = `${pairs[1].name}:${JSON.stringify(pairs[1].arguments)}`;
    if (pairA !== pairB) {
      const isAlternating = pairs.every((tc, i) => {
        const expected = i % 2 === 0 ? pairA : pairB;
        return `${tc.name}:${JSON.stringify(tc.arguments)}` === expected;
      });
      if (isAlternating) return true;
    }
  }

  return false;
}
