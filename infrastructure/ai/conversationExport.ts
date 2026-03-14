import type { AISession } from './types';

/**
 * Export a session as Markdown
 */
export function exportAsMarkdown(session: AISession): string {
  const lines: string[] = [];

  lines.push(`# ${session.title || 'Untitled Chat'}`);
  lines.push('');
  lines.push(`- **Agent:** ${session.agentId}`);
  lines.push(`- **Scope:** ${session.scope.type}${session.scope.targetId ? ` (${session.scope.targetId})` : ''}`);
  lines.push(`- **Created:** ${new Date(session.createdAt).toLocaleString()}`);
  lines.push(`- **Updated:** ${new Date(session.updatedAt).toLocaleString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of session.messages) {
    if (msg.role === 'system') continue;

    const time = new Date(msg.timestamp).toLocaleTimeString();

    if (msg.role === 'user') {
      lines.push(`## User [${time}]`);
      lines.push('');
      lines.push(msg.content);
      lines.push('');
    } else if (msg.role === 'assistant') {
      lines.push(`## Assistant [${time}]${msg.model ? ` (${msg.model})` : ''}`);
      lines.push('');
      lines.push(msg.content);

      if (msg.toolCalls?.length) {
        lines.push('');
        for (const tc of msg.toolCalls) {
          lines.push(`### Tool Call: \`${tc.name}\``);
          lines.push('');
          lines.push('```json');
          lines.push(JSON.stringify(tc.arguments, null, 2));
          lines.push('```');
          lines.push('');
        }
      }
      lines.push('');
    } else if (msg.role === 'tool') {
      if (msg.toolResults?.length) {
        for (const tr of msg.toolResults) {
          lines.push(`### Tool Result${tr.isError ? ' (Error)' : ''}`);
          lines.push('');
          lines.push('```');
          lines.push(tr.content);
          lines.push('```');
          lines.push('');
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Export a session as JSON
 */
export function exportAsJSON(session: AISession): string {
  return JSON.stringify(session, null, 2);
}

/**
 * Export a session as plain text
 */
export function exportAsPlainText(session: AISession): string {
  const lines: string[] = [];

  lines.push(`Chat: ${session.title || 'Untitled'}`);
  lines.push(`Date: ${new Date(session.createdAt).toLocaleString()}`);
  lines.push('='.repeat(60));
  lines.push('');

  for (const msg of session.messages) {
    if (msg.role === 'system') continue;

    const time = new Date(msg.timestamp).toLocaleTimeString();

    if (msg.role === 'user') {
      lines.push(`[${time}] You:`);
      lines.push(msg.content);
      lines.push('');
    } else if (msg.role === 'assistant') {
      lines.push(`[${time}] Assistant:`);
      lines.push(msg.content);

      if (msg.toolCalls?.length) {
        for (const tc of msg.toolCalls) {
          lines.push(`  > Tool: ${tc.name}(${JSON.stringify(tc.arguments)})`);
        }
      }
      lines.push('');
    } else if (msg.role === 'tool') {
      if (msg.toolResults?.length) {
        for (const tr of msg.toolResults) {
          lines.push(`  > Result${tr.isError ? ' [ERROR]' : ''}:`);
          lines.push(`  ${tr.content}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate a suggested filename for export
 */
export function getExportFilename(session: AISession, format: 'md' | 'json' | 'txt'): string {
  const title = (session.title || 'chat')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const date = new Date(session.createdAt).toISOString().slice(0, 10);
  return `netcatty-${title}-${date}.${format}`;
}
