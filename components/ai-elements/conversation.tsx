import { cn } from '../../lib/utils';
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
import React, { useCallback } from 'react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
import { ArrowDown } from 'lucide-react';

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn('relative flex-1 overflow-y-hidden', className)}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);

export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

export const ConversationContent = ({ className, ...props }: ConversationContentProps) => (
  <StickToBottom.Content
    className={cn('flex flex-col gap-4 p-4', className)}
    {...props}
  />
);

export interface ConversationEmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  icon?: ReactNode;
}

export const ConversationEmptyState = ({
  className,
  title = 'Start a conversation',
  description = 'Ask about your servers, run commands, or get help with configurations.',
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      'flex size-full flex-col items-center justify-center gap-3 p-8 text-center',
      className,
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </>
    )}
  </div>
);

export const ConversationScrollButton = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleClick = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  if (isAtBottom) return null;

  return (
    <button
      type="button"
      className={cn(
        'absolute bottom-3 left-1/2 -translate-x-1/2 z-10',
        'h-7 w-7 rounded-full border border-border/40 bg-background/90 backdrop-blur-sm',
        'flex items-center justify-center',
        'text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer',
        'shadow-sm',
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      <ArrowDown size={14} />
    </button>
  );
};
