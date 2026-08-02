import React from 'react';
import { X, CheckSquare, Square, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { AlignerSettings, MaintenanceTask } from '../../types';
import { TrayceTheme } from '../../hooks/useTrayceTheme';

interface DailyPlanSheetProps {
  theme: TrayceTheme;
  tasks: MaintenanceTask[];
  settings: AlignerSettings;
  onToggleTask?: (taskId: string) => void;
  onOpenChewiesTimer?: () => void;
  onUpdateSettings?: (settings: AlignerSettings) => void;
  onClose: () => void;
}

export const DailyPlanSheet: React.FC<DailyPlanSheetProps> = ({
  theme,
  tasks,
  settings,
  onToggleTask,
  onOpenChewiesTimer,
  onUpdateSettings,
  onClose,
}) => {
  const rubberTarget = settings.rubberBandsTargetPerDay || 3;
  const rubberCount = settings.rubberBandsChangedToday || 0;
  const completedCount = tasks.filter((t) => t.completed).length;

  const handleIncrementRubberBands = () => {
    if (onUpdateSettings) {
      onUpdateSettings({ ...settings, rubberBandsChangedToday: Math.min(rubberTarget + 2, rubberCount + 1) });
    }
  };

  const handleResetRubberBands = () => {
    if (onUpdateSettings) {
      onUpdateSettings({ ...settings, rubberBandsChangedToday: 0 });
    }
  };

  return (
    <div className={`tz-scope tz-${theme} fixed inset-0 z-50 flex items-end justify-center`} role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-[28px] p-5 pb-8 space-y-4 animate-in slide-in-from-bottom duration-200"
        style={{ backgroundColor: 'var(--tz-surface-card)', borderTop: '1px solid var(--tz-border-subtle)' }}
      >
        <div className="flex items-center justify-between sticky top-0 pb-1" style={{ backgroundColor: 'var(--tz-surface-card)' }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: 'var(--tz-text-primary)' }}>
              Daily plan
            </h3>
            {tasks.length > 0 && (
              <p className="text-xs" style={{ color: 'var(--tz-text-secondary)' }}>
                {completedCount} of {tasks.length} routines completed
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--tz-surface-card-deep)' }}
          >
            <X className="w-4 h-4" style={{ color: 'var(--tz-text-secondary)' }} />
          </button>
        </div>

        {settings.useRubberBands !== false && (
          <div className="rounded-2xl p-3.5 space-y-2.5" style={{ backgroundColor: 'var(--tz-surface-card-deep)', border: '1px solid var(--tz-border-subtle)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--tz-text-primary)' }}>
                <Sparkles className="w-4 h-4" style={{ color: 'var(--tz-accent-sand)' }} />
                Rubber bands / elastics
              </div>
              {rubberCount > 0 && (
                <button type="button" onClick={handleResetRubberBands} aria-label="Reset today's count">
                  <RefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--tz-text-secondary)' }} />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: 'var(--tz-text-secondary)' }}>
                {rubberCount} / {rubberTarget} changed today
              </span>
              <button
                type="button"
                onClick={handleIncrementRubberBands}
                className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
                style={{ backgroundColor: 'var(--tz-accent-sand)', color: '#092337' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Log change
              </button>
            </div>
          </div>
        )}

        {tasks.length > 0 ? (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onToggleTask && onToggleTask(task.id)}
                className="p-3 rounded-2xl flex items-center justify-between text-sm cursor-pointer"
                style={{
                  backgroundColor: 'var(--tz-surface-card-deep)',
                  border: '1px solid var(--tz-border-subtle)',
                  color: task.completed ? 'var(--tz-text-secondary)' : 'var(--tz-text-primary)',
                  textDecoration: task.completed ? 'line-through' : 'none',
                }}
              >
                <div className="flex items-center gap-2.5">
                  {task.completed ? (
                    <CheckSquare className="w-4 h-4 shrink-0" style={{ color: 'var(--tz-brand-teal)' }} />
                  ) : (
                    <Square className="w-4 h-4 shrink-0" style={{ color: 'var(--tz-text-secondary)' }} />
                  )}
                  <span className="font-medium">{task.title}</span>
                </div>

                {task.category === 'chewies' && onOpenChewiesTimer && !task.completed && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChewiesTimer();
                    }}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold"
                    style={{ backgroundColor: 'var(--tz-bg-canvas)', color: 'var(--tz-brand-teal)' }}
                  >
                    Start chewies
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-center py-6" style={{ color: 'var(--tz-text-secondary)' }}>
            All caught up for today.
          </p>
        )}
      </div>
    </div>
  );
};
