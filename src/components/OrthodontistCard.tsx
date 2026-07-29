import React, { useState } from 'react';
import { User, Phone, Calendar, Clock, Edit2, Save, FileText, Sparkles } from 'lucide-react';
import { AlignerSettings } from '../types';

interface OrthodontistCardProps {
  settings: AlignerSettings;
  onUpdateSettings: (newSettings: AlignerSettings) => void;
}

export const OrthodontistCard: React.FC<OrthodontistCardProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);
  const [doctorNotes, setDoctorNotes] = useState<string>(
    'Ask about attachment check on Tray 9. Bring Tray 7 and Tray 8 to appointment.'
  );

  // Calculate days until appointment
  const apptDate = new Date(`${settings.nextApptDate}T${settings.nextApptTime}`);
  const now = new Date();
  const diffTime = apptDate.getTime() - now.getTime();
  const daysUntilAppt = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <User className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="font-bold text-slate-100 text-base">{settings.orthodontistName}</h3>
            <p className="text-xs text-slate-400">{settings.clinicName}</p>
          </div>
        </div>

        <a
          href={`tel:${settings.doctorPhone}`}
          className="p-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 transition-colors"
          title="Call Clinic"
        >
          <Phone className="w-4 h-4" />
        </a>
      </div>

      {/* Appointment Countdown Badge */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <Calendar className="w-4 h-4 text-teal-400 shrink-0" />
          <div>
            <div className="text-slate-200 font-semibold">Next Orthodontic Visit</div>
            <div className="text-slate-400 text-[11px]">
              {settings.nextApptDate} at {settings.nextApptTime}
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="font-bold text-teal-300 font-mono text-sm">
            {daysUntilAppt > 0 ? `${daysUntilAppt} Days Left` : 'Today'}
          </span>
        </div>
      </div>

      {/* Doctor Visit Prep Notes */}
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <label className="text-slate-300 font-semibold flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Visit Questions & Notes</span>
          </label>
          <button
            onClick={() => setIsEditingNotes(!isEditingNotes)}
            className="text-teal-400 hover:text-teal-300 flex items-center gap-1 text-[11px] font-medium"
          >
            {isEditingNotes ? (
              <>
                <Save className="w-3 h-3" /> Save
              </>
            ) : (
              <>
                <Edit2 className="w-3 h-3" /> Edit
              </>
            )}
          </button>
        </div>

        {isEditingNotes ? (
          <textarea
            value={doctorNotes}
            onChange={(e) => setDoctorNotes(e.target.value)}
            rows={3}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-400 text-xs"
          />
        ) : (
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 text-slate-300 leading-relaxed italic">
            "{doctorNotes}"
          </div>
        )}
      </div>
    </div>
  );
};
