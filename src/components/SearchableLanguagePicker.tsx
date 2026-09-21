import React, { useState } from 'react';
import { Search, Globe, Check, Sparkles, Languages, HelpCircle } from 'lucide-react';
import {
  LanguageItem,
  ALL_LANGUAGES,
  POPULAR_LANGUAGES,
  searchLanguages,
  getLanguageByCodeOrName,
} from '../lib/languageCatalog';

interface SearchableLanguagePickerProps {
  selectedLanguage: string;
  onSelectLanguage: (langName: string) => void;
  autoMatchLanguage?: boolean;
  onToggleAutoMatch?: (enabled: boolean) => void;
  readOnly?: boolean;
}

export const SearchableLanguagePicker: React.FC<SearchableLanguagePickerProps> = ({
  selectedLanguage,
  onSelectLanguage,
  autoMatchLanguage = false,
  onToggleAutoMatch,
  readOnly = false,
}) => {
  const [activeTab, setActiveTab] = useState<'popular' | 'all'>('popular');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customInput, setCustomInput] = useState<string>('');
  const [isAddingCustom, setIsAddingCustom] = useState<boolean>(false);

  const filtered = searchLanguages(searchQuery, activeTab);
  const activeObj = getLanguageByCodeOrName(selectedLanguage);

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    onSelectLanguage(customInput.trim());
    setCustomInput('');
    setIsAddingCustom(false);
  };

  return (
    <div className="space-y-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-xs">
      {/* Header & Active Selection Summary */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-rose-400" />
          <span className="font-bold text-white text-sm">Companion Language Settings</span>
        </div>
        <div className="flex items-center gap-2 bg-rose-950/80 border border-rose-800/60 px-3 py-1 rounded-full text-rose-200 text-xs font-semibold">
          <span>{activeObj.name}</span>
          {activeObj.nativeName !== activeObj.name && (
            <span className="text-rose-300 font-normal">({activeObj.nativeName})</span>
          )}
          {activeObj.isRtl && (
            <span className="text-[10px] bg-rose-900 px-1.5 py-0.2 rounded text-rose-200">RTL</span>
          )}
        </div>
      </div>

      {/* Auto Language Matching Toggle */}
      {onToggleAutoMatch && (
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
          <div>
            <div className="text-slate-200 font-bold flex items-center gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Automatically Match My Language
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
              When enabled, your companion detects your current message language (e.g. Urdu, English, Hindi, Arabic) and naturally responds in that language.
            </p>
          </div>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onToggleAutoMatch(!autoMatchLanguage)}
            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 p-1 ${
              autoMatchLanguage ? 'bg-rose-600' : 'bg-slate-800'
            } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                autoMatchLanguage ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}

      {!readOnly && (
        <>
          {/* Search Input & Category Tabs */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search language name or native script (e.g. Urdu, اردو, Bangla, বাংলা, Arabic...)"
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500 placeholder-slate-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('popular')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'popular'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Popular ({POPULAR_LANGUAGES.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'all'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  All Languages ({ALL_LANGUAGES.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingCustom(!isAddingCustom)}
                className="text-[11px] text-rose-400 hover:underline font-medium"
              >
                {isAddingCustom ? 'Cancel Custom' : '+ Other Language'}
              </button>
            </div>
          </div>

          {/* Custom Extensible Language Input */}
          {isAddingCustom && (
            <form onSubmit={handleAddCustom} className="flex gap-2 p-2 bg-slate-900 rounded-xl border border-slate-800">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Type custom language (e.g. Swahili, Pashto, Sinhala)..."
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-rose-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shrink-0"
              >
                Apply Custom
              </button>
            </form>
          )}

          {/* Languages Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
            {filtered.map((item) => {
              const isSelected =
                selectedLanguage.toLowerCase() === item.name.toLowerCase() ||
                selectedLanguage.toLowerCase() === item.code.toLowerCase();

              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => onSelectLanguage(item.name)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between group ${
                    isSelected
                      ? 'bg-rose-950/80 border-rose-600 text-white'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="truncate pr-1">
                    <div className="font-semibold text-xs text-white truncate group-hover:text-rose-300">
                      {item.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-sans truncate">
                      {item.nativeName}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {item.isRtl && (
                      <span className="text-[9px] px-1 rounded bg-slate-800 text-amber-300 font-mono">
                        RTL
                      </span>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-rose-400" />}
                  </div>
                </button>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-full p-4 text-center text-slate-500 text-xs">
                No languages found matching "{searchQuery}". You can add it using the "+ Other Language" option above.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
