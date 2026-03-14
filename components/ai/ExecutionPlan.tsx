/**
 * ExecutionPlan - Renders a multi-step execution plan for AI agent tasks.
 *
 * Shows a numbered list of steps with status indicators, host badges,
 * optional command previews, and action buttons.
 */

import {
  CheckCircle2,
  Circle,
  Loader2,
  SkipForward,
  XCircle,
} from 'lucide-react';
import React from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface ExecutionPlanStep {
  description: string;
  host?: string;
  command?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
}

interface ExecutionPlanProps {
  steps: ExecutionPlanStep[];
  onApprove: () => void;
  onModify: () => void;
  onReject: () => void;
  isExecuting: boolean;
}

// -------------------------------------------------------------------
// Status icon mapping
// -------------------------------------------------------------------

function StepStatusIcon({
  status,
}: {
  status: ExecutionPlanStep['status'];
}) {
  switch (status) {
    case 'pending':
      return <Circle size={16} className="text-muted-foreground" />;
    case 'running':
      return (
        <Loader2 size={16} className="text-blue-500 animate-spin" />
      );
    case 'completed':
      return <CheckCircle2 size={16} className="text-green-500" />;
    case 'failed':
      return <XCircle size={16} className="text-destructive" />;
    case 'skipped':
      return (
        <SkipForward size={16} className="text-muted-foreground/60" />
      );
  }
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

const ExecutionPlan: React.FC<ExecutionPlanProps> = ({
  steps,
  onApprove,
  onModify,
  onReject,
  isExecuting,
}) => {
  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/60 bg-muted/50">
        <span className="text-sm font-medium">
          Execution Plan ({steps.length} step{steps.length !== 1 ? 's' : ''})
        </span>
      </div>

      {/* Steps list */}
      <div className="divide-y divide-border/30">
        {steps.map((step, index) => (
          <div
            key={index}
            className={cn(
              'flex items-start gap-3 px-3 py-2.5 transition-colors',
              step.status === 'running' && 'bg-blue-500/5',
              step.status === 'completed' && 'bg-green-500/5',
              step.status === 'failed' && 'bg-destructive/5',
              step.status === 'skipped' && 'opacity-50',
            )}
          >
            {/* Step number + status icon */}
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              <span className="text-xs text-muted-foreground font-mono w-4 text-right">
                {index + 1}
              </span>
              <StepStatusIcon status={step.status} />
            </div>

            {/* Step content */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    'text-sm',
                    step.status === 'skipped' && 'line-through',
                  )}
                >
                  {step.description}
                </span>
                {step.host && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {step.host}
                  </Badge>
                )}
              </div>
              {step.command && (
                <code className="block text-xs font-mono bg-muted/80 px-2 py-1 rounded text-muted-foreground truncate">
                  {step.command}
                </code>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="px-3 py-2.5 border-t border-border/60 flex items-center justify-end gap-2">
        {isExecuting ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onReject}
          >
            Cancel
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={onReject}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={onModify}>
              Modify Plan
            </Button>
            <Button size="sm" onClick={onApprove}>
              Approve
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

ExecutionPlan.displayName = 'ExecutionPlan';

export default ExecutionPlan;
export { ExecutionPlan };
export type { ExecutionPlanProps, ExecutionPlanStep };
