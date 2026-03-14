/**
 * PermissionDialog - Modal for AI agent tool call permission requests.
 *
 * Shown when the agent needs user approval to execute a tool call.
 * Displays tool name, arguments, recommendation, and approve/reject actions.
 */

import { ShieldAlert } from 'lucide-react';
import React, { useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface PermissionDialogProps {
  open: boolean;
  toolCall: { name: string; arguments: Record<string, unknown> } | null;
  recommendation: 'allow' | 'confirm' | 'deny';
  onApprove: () => void;
  onReject: () => void;
  onDismiss: () => void;
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

const PermissionDialog: React.FC<PermissionDialogProps> = ({
  open,
  toolCall,
  recommendation,
  onApprove,
  onReject,
  onDismiss,
}) => {
  const isDenied = recommendation === 'deny';

  // Keyboard shortcuts: Enter to approve, Escape to reject
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Enter' && !isDenied) {
        e.preventDefault();
        onApprove();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onReject();
      }
    },
    [open, isDenied, onApprove, onReject],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Format arguments as readable code block content
  const formattedArgs = toolCall
    ? JSON.stringify(toolCall.arguments, null, 2)
    : '';

  // Extract host/session info from arguments if present
  const sessionId =
    toolCall?.arguments?.sessionId as string | undefined;
  const sessionIds =
    toolCall?.arguments?.sessionIds as string[] | undefined;

  const recommendationBadge = () => {
    switch (recommendation) {
      case 'allow':
        return (
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
            Allow
          </Badge>
        );
      case 'confirm':
        return (
          <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">
            Confirm
          </Badge>
        );
      case 'deny':
        return <Badge variant="destructive">Deny</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert
              size={20}
              className={cn(
                isDenied ? 'text-destructive' : 'text-yellow-500',
              )}
            />
            Permission Required
          </DialogTitle>
          <DialogDescription>
            The AI agent wants to execute a tool call that requires your
            approval.
          </DialogDescription>
        </DialogHeader>

        {toolCall && (
          <div className="space-y-3">
            {/* Tool name and recommendation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Tool:</span>
                <code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">
                  {toolCall.name}
                </code>
              </div>
              {recommendationBadge()}
            </div>

            {/* Target session(s) */}
            {(sessionId || sessionIds) && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Target:</span>
                {sessionId && (
                  <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                    {sessionId}
                  </code>
                )}
                {sessionIds && (
                  <div className="flex flex-wrap gap-1">
                    {sessionIds.map((id) => (
                      <code
                        key={id}
                        className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded"
                      >
                        {id}
                      </code>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Arguments code block */}
            <div className="rounded-md border border-border bg-muted/50 p-3 max-h-48 overflow-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all text-foreground">
                {formattedArgs}
              </pre>
            </div>

            {/* Deny warning */}
            {isDenied && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">
                  This command is blocked by your security policy and cannot be
                  executed.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {isDenied ? (
            <Button variant="destructive" onClick={onReject} className="w-full">
              Reject
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={onReject}
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                Reject
              </Button>
              <Button onClick={onApprove}>Approve</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

PermissionDialog.displayName = 'PermissionDialog';

export default PermissionDialog;
export { PermissionDialog };
export type { PermissionDialogProps };
