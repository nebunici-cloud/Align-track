import React, { useState } from 'react';
import { Camera, Plus, Trash2, Calendar, Sparkles, Image as ImageIcon } from 'lucide-react';
import { PhotoEntry, AlignerSettings } from '../types';
import { formatLocalDate } from '../utils/storage';

interface PhotoDiaryProps {
  photos: PhotoEntry[];
  settings: AlignerSettings;
  onAddPhoto: (photo: Omit<PhotoEntry, 'id'>, file?: File) => void;
  onDeletePhoto: (id: string) => void;
}

export const PhotoDiary: React.FC<PhotoDiaryProps> = ({
  photos,
  settings,
  onAddPhoto,
  onDeletePhoto,
}) => {
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedTray, setSelectedTray] = useState<number>(settings.currentTray);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoNote, setPhotoNote] = useState<string>('');

  const SAMPLE_PHOTOS = [
    'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=600&q=80',
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setPreviewUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePhoto = () => {
    // A real uploaded file is sent to the parent for cloud upload; otherwise fall back to a sample image.
    const finalUrl = selectedFile ? '' : SAMPLE_PHOTOS[Math.floor(Math.random() * SAMPLE_PHOTOS.length)];
    onAddPhoto(
      {
        trayNumber: selectedTray,
        date: formatLocalDate(new Date()),
        imageUrl: finalUrl,
        note: photoNote.trim() || `Tray #${selectedTray} Progress Check`,
      },
      selectedFile || undefined
    );

    setShowAddModal(false);
    setPreviewUrl('');
    setSelectedFile(null);
    setPhotoNote('');
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <Camera className="w-5 h-5 text-teal-400" />
          <div>
            <h3 className="font-bold text-slate-100 text-base">Smile Progress Photo Diary</h3>
            <p className="text-xs text-slate-400">Track teeth alignment changes per tray</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Photo Check</span>
        </button>
      </div>

      {/* Photos Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="bg-slate-800/50 border border-slate-700/60 rounded-2xl overflow-hidden group hover:border-teal-500/40 transition-all flex flex-col"
          >
            <div className="relative h-44 bg-slate-950 overflow-hidden">
              <img
                src={photo.imageUrl}
                alt={`Tray ${photo.trayNumber}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-bold text-teal-300 border border-slate-700">
                Tray #{photo.trayNumber}
              </div>
              <button
                onClick={() => onDeletePhoto(photo.id)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 text-slate-400 hover:text-rose-400 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete Photo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 text-xs space-y-1 flex-1 flex flex-col justify-between">
              <div className="text-slate-200 font-medium leading-snug">{photo.note}</div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-2 border-t border-slate-700/40 mt-2">
                <Calendar className="w-3 h-3 text-slate-500" />
                <span>{photo.date}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Photo Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Camera className="w-4 h-4 text-teal-400" />
                Log Smile Photo Check
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium mb-1 block">Associated Tray</label>
                <select
                  value={selectedTray}
                  onChange={(e) => setSelectedTray(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
                >
                  {Array.from({ length: settings.totalTrays }, (_, i) => i + 1).map((trayNum) => (
                    <option key={trayNum} value={trayNum}>
                      Tray #{trayNum} {trayNum === settings.currentTray ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium mb-1 block">Upload Image / Snap Camera</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="w-full text-slate-300 text-xs bg-slate-800 border border-slate-700 rounded-xl p-2 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-500/20 file:text-teal-300 hover:file:bg-teal-500/30"
                />
              </div>

              {previewUrl && (
                <div className="relative h-32 rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}

              <div>
                <label className="text-slate-300 font-medium mb-1 block">Observation Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Upper incisor gap closing nicely, fit feels tight..."
                  value={photoNote}
                  onChange={(e) => setPhotoNote(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePhoto}
                className="flex-1 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shadow-md transition-colors"
              >
                Save Photo Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
