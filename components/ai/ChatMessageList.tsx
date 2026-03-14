/**
 * ChatMessageList - Renders the list of chat messages
 *
 * Uses AI Elements components (Conversation, Message, ToolCall) for scrollable
 * container, markdown rendering via streamdown, and expandable tool calls.
 */

import { Bot, User } from 'lucide-react';
import React from 'react';
import { cn } from '../../lib/utils';
import type { ChatMessage } from '../../infrastructure/ai/types';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '../ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '../ai-elements/message';
import { ToolCall } from '../ai-elements/tool-call';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages, isStreaming }) => {
  const visibleMessages = messages.filter(m => m.role !== 'system');

  if (visibleMessages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <ConversationEmptyState
          icon={<div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center"><Bot size={24} className="text-muted-foreground" /></div>}
          title="Start a conversation"
          description="Ask about your servers, run commands, or get help with configurations."
        />
      </div>
    );
  }

  const lastAssistantMessage = visibleMessages.findLast(m => m.role === 'assistant');
  const lastAssistantIsStreaming = isStreaming && lastAssistantMessage === visibleMessages[visibleMessages.length - 1];
  const showStreamingDots = isStreaming && !(lastAssistantIsStreaming && lastAssistantMessage?.content);

  return (
    <Conversation className="flex-1">
      <ConversationContent className="gap-3 px-3 py-3">
        {visibleMessages.map((message) => {
          if (message.role === 'tool') {
            return message.toolResults?.map((tr) => (
              <ToolCall
                key={tr.toolCallId}
                name={tr.toolCallId}
                result={tr.content}
                isError={tr.isError}
              />
            ));
          }

          const isUser = message.role === 'user';
          const isLastAssistant = message === lastAssistantMessage;

          return (
            <Message key={message.id} from={message.role}>
              <div className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
                {/* Avatar */}
                <div className={cn(
                  'shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5',
                  isUser ? 'bg-primary/10' : 'bg-muted/60',
                )}>
                  {isUser
                    ? <User size={12} className="text-primary/70" />
                    : <Bot size={12} className="text-muted-foreground/70" />
                  }
                </div>

                <MessageContent>
                  {message.content && (
                    isUser
                      ? <div className="whitespace-pre-wrap break-words text-[13px]">{message.content}</div>
                      : <MessageResponse isAnimating={isStreaming && isLastAssistant}>
                          {message.content}
                        </MessageResponse>
                  )}

                  {/* Tool calls */}
                  {message.toolCalls?.map((tc) => (
                    <ToolCall
                      key={tc.id}
                      name={tc.name}
                      args={tc.arguments}
                      isLoading={message.executionStatus === 'running'}
                    />
                  ))}
                </MessageContent>
              </div>
            </Message>
          );
        })}

        {/* Streaming indicator — only when no content is actively streaming */}
        {showStreamingDots && (
          <div className="flex gap-2.5 px-0">
            <div className="shrink-0 w-6 h-6 rounded-full bg-muted/60 flex items-center justify-center mt-0.5">
              <Bot size={12} className="text-muted-foreground/70" />
            </div>
            <div className="flex items-center gap-1 pt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
};

export default React.memo(ChatMessageList);
