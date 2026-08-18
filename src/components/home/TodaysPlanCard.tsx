import React from 'react';
import { CheckSquare, Square, ChevronRight } from 'lucide-react';
import { MaintenanceTask } from '../../types';

interface TodaysPlanCardProps {
  tasks: MaintenanceTask[];
  onOpen: () => void;
}

export const TodaysPlanCard: React.FC<TodaysPlanCardProps> = ({ tasks, onOpen }) => {
  const completedCount = tasks.filter((t) => t.completed).length;
  const visibleTasks = tasks.slice(0, 4);

  return (
    <div
      className="rounded-[24px] p-5 space-y-3"
      style={{ backgroundColor: 'var(--tz-surface-card)', border: '1px solid var(--tz-border-subtle)' }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold" style={{ color: 'var(--tz-text-primary)' }}>
          Today&rsquo;s plan
        </h3>
        {tasks.length > 0 && (
          <span className="text-xs font-semibold" style={{ color: 'var(--tz-brand-teal)' }}>
            {completedCount} / {tasks.length} done
          </span>
        )}
      </div>

      {visibleTasks.length > 0 ? (
        <div className="space-y-2">
          {visibleTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2.5 text-sm">
              {task.completed ? (
                <CheckSquare className="w-4 h-4 shrink-0" style={{ color: 'var(--tz-brand-teal)' }} />
              ) : (
                <Square className="w-4 h-4 shrink-0" style={{ color: 'var(--tz-text-secondary)' }} />
              )}
              <span
                className="truncate"
                style={{
                  color: task.completed ? 'var(--tz-text-secondary)' : 'var(--tz-text-primary)',
                  textDecoration: task.completed ? 'line-through' : 'none',
                }}
              >
                {task.title}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--tz-text-secondary)' }}>
          All caught up for today.
        </p>
      )}

      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-1 text-xs font-semibold"
        style={{ color: 'var(--tz-brand-teal)' }}
      >
        View plan
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
