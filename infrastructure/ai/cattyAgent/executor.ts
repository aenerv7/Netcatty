import type { ToolCall, ToolResult } from '../types';

/**
 * Bridge interface for Catty Agent to interact with the Electron main process.
 * This mirrors the AI-related subset of window.netcatty from electron/preload.cjs.
 */
export interface NetcattyBridge {
  aiExec(
    sessionId: string,
    command: string,
  ): Promise<{
    ok: boolean;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    error?: string;
  }>;
  aiTerminalWrite(
    sessionId: string,
    data: string,
  ): Promise<{ ok: boolean; error?: string }>;
  listSftp(
    sftpId: string,
    path: string,
    encoding?: string,
  ): Promise<unknown>;
  readSftp(
    sftpId: string,
    path: string,
    encoding?: string,
  ): Promise<string>;
  writeSftp(
    sftpId: string,
    path: string,
    content: string,
    encoding?: string,
  ): Promise<void>;
}

// Workspace context provided to the executor
export interface ExecutorContext {
  // Available sessions in scope
  sessions: Array<{
    sessionId: string;
    hostId: string;
    hostname: string;
    label: string;
    os?: string;
    username?: string;
    connected: boolean;
    sftpId?: string; // If SFTP is open for this session
  }>;
  // Workspace info
  workspaceId?: string;
  workspaceName?: string;
}

/**
 * Create a tool executor function for the Catty Agent.
 * This bridges tool calls to the netcatty Electron IPC layer.
 */
export function createToolExecutor(
  bridge: NetcattyBridge | undefined,
  context: ExecutorContext,
): (toolCall: ToolCall) => Promise<ToolResult> {
  return async (toolCall: ToolCall): Promise<ToolResult> => {
    if (!bridge) {
      return {
        toolCallId: toolCall.id,
        content: 'Netcatty bridge is not available',
        isError: true,
      };
    }

    const args = toolCall.arguments;

    try {
      switch (toolCall.name) {
        case 'terminal_execute': {
          const sessionId = String(args.sessionId || '');
          const command = String(args.command || '');
          if (!sessionId || !command) {
            return {
              toolCallId: toolCall.id,
              content: 'Missing sessionId or command',
              isError: true,
            };
          }
          const result = await bridge.aiExec(sessionId, command);
          if (!result.ok) {
            return {
              toolCallId: toolCall.id,
              content: `Error: ${result.error || 'Command failed'}`,
              isError: true,
            };
          }
          const output = [
            result.stdout ? `STDOUT:\n${result.stdout}` : '',
            result.stderr ? `STDERR:\n${result.stderr}` : '',
            `Exit code: ${result.exitCode ?? 'unknown'}`,
          ]
            .filter(Boolean)
            .join('\n\n');
          return {
            toolCallId: toolCall.id,
            content: output || 'Command completed (no output)',
          };
        }

        case 'terminal_read_output': {
          const sessionId = String(args.sessionId || '');
          if (!sessionId) {
            return {
              toolCallId: toolCall.id,
              content: 'Missing sessionId',
              isError: true,
            };
          }
          // Direct xterm buffer reading is not yet available via IPC.
          // Fallback: inform the LLM to use terminal_execute instead.
          return {
            toolCallId: toolCall.id,
            content:
              'Note: Direct terminal buffer reading is not yet supported. ' +
              'Use terminal_execute to run commands and capture their output.',
          };
        }

        case 'terminal_send_input': {
          const sessionId = String(args.sessionId || '');
          const input = String(args.input || '');
          if (!sessionId || !input) {
            return {
              toolCallId: toolCall.id,
              content: 'Missing sessionId or input',
              isError: true,
            };
          }
          const result = await bridge.aiTerminalWrite(sessionId, input);
          if (!result.ok) {
            return {
              toolCallId: toolCall.id,
              content: `Error: ${result.error}`,
              isError: true,
            };
          }
          return {
            toolCallId: toolCall.id,
            content: `Sent input to terminal: ${JSON.stringify(input)}`,
          };
        }

        case 'sftp_list_directory': {
          const sessionId = String(args.sessionId || '');
          const path = String(args.path || '/');
          // Find the SFTP connection for this session
          const session = context.sessions.find(
            (s) => s.sessionId === sessionId,
          );
          if (!session?.sftpId) {
            // Fallback: use terminal exec with ls
            const result = await bridge.aiExec(sessionId, `ls -la ${path}`);
            return {
              toolCallId: toolCall.id,
              content: result.ok
                ? result.stdout || '(empty directory)'
                : `Error: ${result.error}`,
              isError: !result.ok,
            };
          }
          const files = await bridge.listSftp(session.sftpId, path);
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify(files, null, 2),
          };
        }

        case 'sftp_read_file': {
          const sessionId = String(args.sessionId || '');
          const path = String(args.path || '');
          if (!sessionId || !path) {
            return {
              toolCallId: toolCall.id,
              content: 'Missing sessionId or path',
              isError: true,
            };
          }
          const session = context.sessions.find(
            (s) => s.sessionId === sessionId,
          );
          if (!session?.sftpId) {
            // Fallback: use terminal exec
            const maxBytes = Number(args.maxBytes) || 10000;
            const result = await bridge.aiExec(
              sessionId,
              `head -c ${maxBytes} ${path}`,
            );
            return {
              toolCallId: toolCall.id,
              content: result.ok
                ? result.stdout || '(empty file)'
                : `Error: ${result.error}`,
              isError: !result.ok,
            };
          }
          const content = await bridge.readSftp(session.sftpId, path);
          return {
            toolCallId: toolCall.id,
            content: content || '(empty file)',
          };
        }

        case 'sftp_write_file': {
          const sessionId = String(args.sessionId || '');
          const path = String(args.path || '');
          const content = String(args.content || '');
          if (!sessionId || !path) {
            return {
              toolCallId: toolCall.id,
              content: 'Missing sessionId or path',
              isError: true,
            };
          }
          const session = context.sessions.find(
            (s) => s.sessionId === sessionId,
          );
          if (!session?.sftpId) {
            // Fallback: use terminal exec with heredoc
            const escaped = content.replace(/'/g, "'\\''");
            const result = await bridge.aiExec(
              sessionId,
              `cat > ${path} << 'CATTY_EOF'\n${escaped}\nCATTY_EOF`,
            );
            return {
              toolCallId: toolCall.id,
              content: result.ok
                ? `File written: ${path}`
                : `Error: ${result.error}`,
              isError: !result.ok,
            };
          }
          await bridge.writeSftp(session.sftpId, path, content);
          return {
            toolCallId: toolCall.id,
            content: `File written: ${path}`,
          };
        }

        case 'workspace_get_info': {
          const info = {
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
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify(info, null, 2),
          };
        }

        case 'workspace_get_session_info': {
          const sessionId = String(args.sessionId || '');
          const session = context.sessions.find(
            (s) => s.sessionId === sessionId,
          );
          if (!session) {
            return {
              toolCallId: toolCall.id,
              content: `Session not found: ${sessionId}`,
              isError: true,
            };
          }
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify(session, null, 2),
          };
        }

        case 'multi_host_execute': {
          const sessionIds = (args.sessionIds as string[]) || [];
          const command = String(args.command || '');
          const mode = String(args.mode || 'parallel');
          const stopOnError = Boolean(args.stopOnError);

          if (sessionIds.length === 0 || !command) {
            return {
              toolCallId: toolCall.id,
              content: 'Missing sessionIds or command',
              isError: true,
            };
          }

          const results: Record<string, { ok: boolean; output: string }> = {};

          if (mode === 'sequential') {
            for (const sid of sessionIds) {
              const session = context.sessions.find(
                (s) => s.sessionId === sid,
              );
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
              const session = context.sessions.find(
                (s) => s.sessionId === sid,
              );
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

          return {
            toolCallId: toolCall.id,
            content: JSON.stringify(results, null, 2),
          };
        }

        default:
          return {
            toolCallId: toolCall.id,
            content: `Unknown tool: ${toolCall.name}`,
            isError: true,
          };
      }
    } catch (err) {
      return {
        toolCallId: toolCall.id,
        content: `Tool execution error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  };
}
