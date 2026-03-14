import { tool } from 'ai';
import { z } from 'zod';
import type { NetcattyBridge, ExecutorContext } from '../cattyAgent/executor';
import { checkCommandSafety } from '../cattyAgent/safety';

/**
 * Create Catty Agent tools using the Vercel AI SDK `tool()` helper with zod schemas.
 *
 * Each tool mirrors the original implementation in `cattyAgent/executor.ts` but uses
 * the SDK's declarative format with zod parameter schemas and `execute` functions.
 *
 * @param bridge  - The Electron IPC bridge for executing operations
 * @param context - Workspace/session context available to the agent
 * @param commandBlocklist - Optional command blocklist patterns for safety checks
 */
export function createCattyTools(
  bridge: NetcattyBridge,
  context: ExecutorContext,
  commandBlocklist?: string[],
) {
  return {
    terminal_execute: tool({
      description:
        'Execute a shell command on a remote host via the specified terminal session. ' +
        "The command runs in the session's shell and output is returned when complete.",
      inputSchema: z.object({
        sessionId: z.string().describe('The terminal session ID to execute the command on.'),
        command: z.string().describe('The shell command to execute on the remote host.'),
      }),
      execute: async ({ sessionId, command }) => {
        // Safety check
        const safety = checkCommandSafety(command, commandBlocklist);
        if (safety.blocked) {
          return {
            error: `Command blocked by safety policy. Matched pattern: ${safety.matchedPattern}`,
          };
        }

        const result = await bridge.aiExec(sessionId, command);
        if (!result.ok) {
          return { error: result.error || 'Command failed' };
        }
        return {
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          exitCode: result.exitCode ?? -1,
        };
      },
    }),

    terminal_read_output: tool({
      description:
        'Read recent terminal output from a session. Returns the last N lines ' +
        'of the terminal buffer, useful for reviewing command results or monitoring output.',
      inputSchema: z.object({
        sessionId: z.string().describe('The terminal session ID to read output from.'),
        lines: z
          .number()
          .optional()
          .default(50)
          .describe('Number of lines to read from the terminal buffer. Defaults to 50.'),
      }),
      execute: async ({ sessionId: _sessionId }) => {
        // Direct xterm buffer reading is not yet available via IPC.
        return {
          note:
            'Direct terminal buffer reading is not yet supported. ' +
            'Use terminal_execute to run commands and capture their output.',
        };
      },
    }),

    terminal_send_input: tool({
      description:
        'Send raw input to a terminal session. Use this for interactive programs that ' +
        'require input such as y/n prompts, passwords, ctrl+c (\\x03), ctrl+d (\\x04), ' +
        'or any other keyboard input.',
      inputSchema: z.object({
        sessionId: z.string().describe('The terminal session ID to send input to.'),
        input: z
          .string()
          .describe(
            'The raw input string to send. Use escape sequences for special keys ' +
              '(e.g. "\\x03" for ctrl+c, "\\n" for enter).',
          ),
      }),
      execute: async ({ sessionId, input }) => {
        const result = await bridge.aiTerminalWrite(sessionId, input);
        if (!result.ok) {
          return { error: result.error || 'Failed to send input' };
        }
        return { sent: input };
      },
    }),

    sftp_list_directory: tool({
      description:
        'List the contents of a directory on the remote host via SFTP. Returns file names, ' +
        'sizes, types, and modification timestamps.',
      inputSchema: z.object({
        sessionId: z.string().describe('The session ID for the SFTP connection.'),
        path: z.string().describe('The absolute path of the remote directory to list.'),
      }),
      execute: async ({ sessionId, path }) => {
        const session = context.sessions.find((s) => s.sessionId === sessionId);
        if (!session?.sftpId) {
          // Fallback: use terminal exec with ls
          const result = await bridge.aiExec(sessionId, `ls -la ${path}`);
          if (!result.ok) {
            return { error: result.error || 'Failed to list directory' };
          }
          return { output: result.stdout || '(empty directory)' };
        }
        const files = await bridge.listSftp(session.sftpId, path);
        return { files };
      },
    }),

    sftp_read_file: tool({
      description:
        'Read the content of a file on the remote host via SFTP. Returns the file content ' +
        'as text, truncated to maxBytes if the file is large.',
      inputSchema: z.object({
        sessionId: z.string().describe('The session ID for the SFTP connection.'),
        path: z.string().describe('The absolute path of the remote file to read.'),
        maxBytes: z
          .number()
          .optional()
          .default(10000)
          .describe('Maximum number of bytes to read from the file. Defaults to 10000.'),
      }),
      execute: async ({ sessionId, path, maxBytes }) => {
        const session = context.sessions.find((s) => s.sessionId === sessionId);
        if (!session?.sftpId) {
          // Fallback: use terminal exec
          const result = await bridge.aiExec(sessionId, `head -c ${maxBytes} ${path}`);
          if (!result.ok) {
            return { error: result.error || 'Failed to read file' };
          }
          return { content: result.stdout || '(empty file)' };
        }
        const content = await bridge.readSftp(session.sftpId, path);
        return { content: content || '(empty file)' };
      },
    }),

    sftp_write_file: tool({
      description:
        'Write content to a file on the remote host via SFTP. Creates the file if it does ' +
        'not exist, or overwrites it if it does.',
      inputSchema: z.object({
        sessionId: z.string().describe('The session ID for the SFTP connection.'),
        path: z.string().describe('The absolute path of the remote file to write.'),
        content: z.string().describe('The text content to write to the file.'),
      }),
      execute: async ({ sessionId, path, content }) => {
        const session = context.sessions.find((s) => s.sessionId === sessionId);
        if (!session?.sftpId) {
          // Fallback: use terminal exec with heredoc
          const escaped = content.replace(/'/g, "'\\''");
          const result = await bridge.aiExec(
            sessionId,
            `cat > ${path} << 'CATTY_EOF'\n${escaped}\nCATTY_EOF`,
          );
          if (!result.ok) {
            return { error: result.error || 'Failed to write file' };
          }
          return { written: path };
        }
        await bridge.writeSftp(session.sftpId, path, content);
        return { written: path };
      },
    }),

    workspace_get_info: tool({
      description:
        'Get information about the current workspace, including all configured hosts ' +
        'and their connection status. No parameters required.',
      inputSchema: z.object({}),
      execute: async () => {
        return {
          workspaceId: context.workspaceId || null,
          workspaceName: context.workspaceName || null,
          sessions: context.sessions.map((s) => ({
            sessionId: s.sessionId,
            hostname: s.hostname,
            label: s.label,
            os: s.os,
            username: s.username,
            connected: s.connected,
          })),
        };
      },
    }),

    workspace_get_session_info: tool({
      description:
        'Get detailed information about a specific terminal or SFTP session, including ' +
        'the host it is connected to, connection status, and session metadata.',
      inputSchema: z.object({
        sessionId: z.string().describe('The session ID to get information about.'),
      }),
      execute: async ({ sessionId }) => {
        const session = context.sessions.find((s) => s.sessionId === sessionId);
        if (!session) {
          return { error: `Session not found: ${sessionId}` };
        }
        return { ...session };
      },
    }),

    multi_host_execute: tool({
      description:
        'Execute a command on multiple hosts simultaneously or sequentially. ' +
        'Use this for batch operations such as checking status across a fleet, ' +
        'deploying updates, or running maintenance tasks on multiple servers.',
      inputSchema: z.object({
        sessionIds: z
          .array(z.string())
          .describe('Array of session IDs to execute the command on.'),
        command: z.string().describe('The shell command to execute on each host.'),
        mode: z
          .enum(['parallel', 'sequential'])
          .optional()
          .default('parallel')
          .describe(
            'Execution mode. "parallel" runs on all hosts at once, ' +
              '"sequential" runs one at a time. Defaults to "parallel".',
          ),
        stopOnError: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'If true and mode is "sequential", stop executing on remaining hosts ' +
              'when a command fails. Defaults to false.',
          ),
      }),
      execute: async ({ sessionIds, command, mode, stopOnError }) => {
        // Safety check
        const safety = checkCommandSafety(command, commandBlocklist);
        if (safety.blocked) {
          return {
            error: `Command blocked by safety policy. Matched pattern: ${safety.matchedPattern}`,
          };
        }

        const results: Record<string, { ok: boolean; output: string }> = {};

        if (mode === 'sequential') {
          for (const sid of sessionIds) {
            const session = context.sessions.find((s) => s.sessionId === sid);
            const label = session?.label || sid;
            const result = await bridge.aiExec(sid, command);
            results[label] = {
              ok: result.ok,
              output: result.ok
                ? result.stdout || '(no output)'
                : `Error: ${result.error || result.stderr || 'Failed'}`,
            };
            if (!result.ok && stopOnError) break;
          }
        } else {
          // Parallel execution
          const promises = sessionIds.map(async (sid) => {
            const session = context.sessions.find((s) => s.sessionId === sid);
            const label = session?.label || sid;
            const result = await bridge.aiExec(sid, command);
            return {
              label,
              ok: result.ok,
              output: result.ok
                ? result.stdout || '(no output)'
                : `Error: ${result.error || result.stderr || 'Failed'}`,
            };
          });
          const resolved = await Promise.all(promises);
          for (const r of resolved) {
            results[r.label] = { ok: r.ok, output: r.output };
          }
        }

        return { results };
      },
    }),
  };
}
