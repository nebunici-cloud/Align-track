import React from 'react';
import { Sparkles, CheckCircle2, Circle, Play, Droplets, ShieldCheck, Box } from 'lucide-react';
import { MaintenanceTask } from '../types';

interface MaintenanceChecklistProps {
  tasks: MaintenanceTask[];
  onToggleTask: (id: string) => void;
  onOpenChewiesTimer: () => void;
}

const CATEGORY_ICONS: Record<MaintenanceTask['category'], React.ReactNode> = {
  clean: <Sparkles className="w-4 h-4 text-teal-400" />,
  chewies: <ShieldCheck className="w-4 h-4 text-cyan-400" />,
  soak: <Droplets className="w-4 h-4 text-blue-400" />,
  case: <Box className="w-4 h-4 text-amber-400" />,
};

export const MaintenanceChecklist: React.FC<MaintenanceChecklistProps> = ({
  tasks,
  onToggleTask,
  onOpenChewiesTimer,
}) => {
  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-teal-400" />
          <div>
            <h3 className="font-bold text-slate-100 text-base">Daily Hygiene & Care</h3>
            <p className="text-xs text-slate-400">Keep aligners crystal clear and seating tight</p>
          </div>
        </div>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-teal-300 border border-slate-700">
          {completedCount}/{tasks.length} Completed
        </span>
      </div>

      {/* Task Items */}
      <div className="space-y-2.5">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
              task.completed
                ? 'bg-slate-800/30 border-slate-800 text-slate-400'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-200 hover:border-slate-600'
            }`}
          >
            <div
              onClick={() => onToggleTask(task.id)}
              className="flex items-center gap-3 cursor-pointer flex-1"
            >
              {task.completed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-slate-500 shrink-0" />
              )}

              <div className="flex items-center gap-2">
                {CATEGORY_ICONS[task.category]}
                <span className={`text-xs font-semibold ${task.completed ? 'line-through text-slate-500' : ''}`}>
                  {task.title}
                </span>
              </div>
            </div>

            {/* If chewies task, provide quick interactive timer trigger */}
            {task.category === 'chewies' && (
              <button
                onClick={onOpenChewiesTimer}
                className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-xs font-semibold flex items-center gap-1 border border-teal-500/30 transition-colors shrink-0"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Chewies Timer</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
