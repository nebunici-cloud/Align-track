import React from 'react';
import { X } from 'lucide-react';
import { AlignerSettings } from '../../types';
import { TrayProgressCard } from '../TrayProgressCard';
import { OrthodontistCard } from '../OrthodontistCard';

interface TreatmentSheetProps {
  settings: AlignerSettings;
  onUpdateSettings: (settings: AlignerSettings) => void;
  onOpenPhotoDiary: () => void;
  onClose: () => void;
}

export const TreatmentSheet: React.FC<TreatmentSheetProps> = ({
  settings,
  onUpdateSettings,
  onOpenPhotoDiary,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-t-[28px] bg-slate-900 border-t border-slate-800 p-5 pb-8 space-y-4 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between sticky top-0 bg-slate-900 pb-1">
          <h3 className="text-base font-bold text-slate-100">Treatment</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4 text-slate-300" />
          </button>
        </div>

        <TrayProgressCard settings={settings} onUpdateSettings={onUpdateSettings} onOpenPhotoDiary={onOpenPhotoDiary} />
        <OrthodontistCard settings={settings} onUpdateSettings={onUpdateSettings} />
      </div>
    </div>
  );
};
