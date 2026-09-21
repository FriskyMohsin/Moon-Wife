import React, { useState, useMemo } from 'react';
import { MemoryBank, MemoryCategoryKey } from '../types';
import { getRelevantMemories } from '../lib/memoryManager';
import { 
  X, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Brain, 
  Check, 
  Search, 
  Edit3, 
  Sparkles,
  AlertTriangle 
} from 'lucide-react';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memory: MemoryBank;
  onUpdateMemory: (newMemory: MemoryBank) => void;
  onResetMemory: () => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({
  isOpen,
  onClose,
  memory,
  onUpdateMemory,
  onResetMemory,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | MemoryCategoryKey | 'recentContext' | 'search' | 'relevanceTest'>('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [editingKey, setEditingKey] = useState<{ category: MemoryCategoryKey | 'recentContext'; index: number } | null>(null);
  const [editingText, setEditingText] = useState('');
  const [testQuery, setTestQuery] = useState('Mera favorite color kya hai baby?');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Define the 8 required categories + recentContext
  const categoryDefs: { key: MemoryCategoryKey; label: string; count: number }[] = useMemo(() => [
    { key: 'preferences', label: 'Preferences', count: memory.preferences?.length || 0 },
    { key: 'importantPeople', label: 'Important People', count: memory.importantPeople?.length || 0 },
    { key: 'personalFacts', label: 'Personal Facts', count: memory.personalFacts?.length || 0 },
    { key: 'relationshipMemories', label: 'Relationship', count: memory.relationshipMemories?.length || 0 },
    { key: 'projects', label: 'Projects', count: memory.projects?.length || 0 },
    { key: 'importantDecisions', label: 'Decisions', count: memory.importantDecisions?.length || 0 },
    { key: 'conversationSummaries', label: 'Summaries', count: memory.conversationSummaries?.length || 0 },
  ], [memory]);

  // Total count of all stored items
  const totalMemoryCount = useMemo(() => {
    let sum = 0;
    for (const c of categoryDefs) {
      sum += c.count;
    }
    return sum;
  }, [categoryDefs]);

  // Cross-category search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: Array<{
      category: MemoryCategoryKey | 'recentContext';
      categoryLabel: string;
      index: number;
      text: string;
    }> = [];

    // Search profile fields
    if (
      memory.userProfile.name?.toLowerCase().includes(q) ||
      memory.userProfile.preferredNickname?.toLowerCase().includes(q) ||
      memory.userProfile.role?.toLowerCase().includes(q)
    ) {
      results.push({
        category: 'preferences',
        categoryLabel: 'User Profile',
        index: -1,
        text: `Profile: ${memory.userProfile.name} (${memory.userProfile.role}), nicknames: ${memory.userProfile.preferredNickname}`,
      });
    }

    // Search 7 array categories
    for (const c of categoryDefs) {
      const list = memory[c.key] || [];
      list.forEach((item, idx) => {
        if (item.toLowerCase().includes(q)) {
          results.push({
            category: c.key,
            categoryLabel: c.label,
            index: idx,
            text: item,
          });
        }
      });
    }

    // Search recent context
    (memory.recentContext || []).forEach((item, idx) => {
      if (item.toLowerCase().includes(q)) {
        results.push({
          category: 'recentContext',
          categoryLabel: 'Recent Context',
          index: idx,
          text: item,
        });
      }
    });

    return results;
  }, [searchQuery, memory, categoryDefs]);

  if (!isOpen) return null;

  // Add Item to active category
  const handleAddItem = (category: MemoryCategoryKey | 'recentContext') => {
    if (!newItemText.trim()) return;
    const currentList = memory[category] || [];
    const updated = {
      ...memory,
      [category]: [...currentList, newItemText.trim()],
    };
    onUpdateMemory(updated);
    setNewItemText('');
  };

  // Delete Individual Item
  const handleDeleteItem = (category: MemoryCategoryKey | 'recentContext', index: number) => {
    const currentList = memory[category] || [];
    const updated = {
      ...memory,
      [category]: currentList.filter((_, i) => i !== index),
    };
    onUpdateMemory(updated);
    if (editingKey && editingKey.category === category && editingKey.index === index) {
      setEditingKey(null);
    }
  };

  // Start Inline Edit
  const handleStartEdit = (category: MemoryCategoryKey | 'recentContext', index: number, currentText: string) => {
    setEditingKey({ category, index });
    setEditingText(currentText);
  };

  // Save Inline Edit
  const handleSaveEdit = () => {
    if (!editingKey || !editingText.trim()) {
      setEditingKey(null);
      return;
    }
    const { category, index } = editingKey;
    const currentList = [...(memory[category] || [])];
    if (index >= 0 && index < currentList.length) {
      currentList[index] = editingText.trim();
      const updated = {
        ...memory,
        [category]: currentList,
      };
      onUpdateMemory(updated);
    }
    setEditingKey(null);
    setEditingText('');
  };

  // Update Profile
  const handleUpdateProfile = (field: keyof MemoryBank['userProfile'], value: string) => {
    onUpdateMemory({
      ...memory,
      userProfile: {
        ...memory.userProfile,
        [field]: value,
      },
    });
  };

  // Clear All Memories
  const handleClearAll = () => {
    const cleared: MemoryBank = {
      userProfile: memory.userProfile,
      preferences: [],
      importantPeople: [],
      personalFacts: [],
      relationshipMemories: [],
      projects: [],
      importantDecisions: [],
      conversationSummaries: [],
      recentContext: [],
    };
    onUpdateMemory(cleared);
    setShowClearConfirm(false);
  };

  const testExtracted = getRelevantMemories(memory, testQuery);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl max-h-[90vh] bg-zinc-950 border border-white/10 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-rose-900/30 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-950/80 border border-rose-800/50 text-rose-300 shadow-lg shadow-rose-950/50">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-serif font-bold text-white tracking-wide">
                  Maryam's Personal Journal & Memory
                </h3>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-medium border border-rose-500/30">
                  {totalMemoryCount} Journal Entries
                </span>
              </div>
              <p className="text-xs text-rose-200/70 font-serif italic">
                Intimate memories, promises, and context shared with Mohsin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Universal Search Bar */}
        <div className="px-5 py-2.5 bg-zinc-900/40 border-b border-white/5">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim() && activeTab !== 'search') {
                  setActiveTab('search');
                }
              }}
              placeholder="Search memories across all categories (e.g. black, color, project, Mohsin)..."
              className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveTab('preferences');
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Navigation Bar */}
        <div className="px-4 py-2 border-b border-white/5 bg-zinc-950 overflow-x-auto flex items-center gap-1.5 scrollbar-none">
          {searchQuery.trim() && (
            <button
              onClick={() => setActiveTab('search')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'search'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-amber-400/80 hover:text-amber-300 hover:bg-white/5'
              }`}
            >
              <Search className="w-3 h-3" />
              <span>Search Results ({searchResults.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === 'profile'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            1. User Profile
          </button>

          {categoryDefs.map((c, idx) => (
            <button
              key={c.key}
              onClick={() => setActiveTab(c.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === c.key
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{idx + 2}. {c.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-zinc-300">
                {c.count}
              </span>
            </button>
          ))}

          <button
            onClick={() => setActiveTab('recentContext')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
              activeTab === 'recentContext'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>Recent Context</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-zinc-300">
              {memory.recentContext?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('relevanceTest')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1 transition-all ${
              activeTab === 'relevanceTest'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-violet-400/80 hover:text-violet-300 hover:bg-violet-950/20'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Relevance Test</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Tab: Search Results */}
          {activeTab === 'search' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Matching memories for: <strong className="text-white">"{searchQuery}"</strong></span>
                <span>{searchResults.length} found</span>
              </div>

              {searchResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 bg-zinc-900/30 rounded-2xl border border-white/5">
                  No memories matched this query. Try a different word or check individual categories.
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((res, idx) => {
                    const isEditing = editingKey?.category === res.category && editingKey?.index === res.index;
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-zinc-900/70 border border-white/10 flex flex-col gap-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-medium border border-rose-500/30">
                            {res.categoryLabel}
                          </span>
                          {res.index >= 0 && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartEdit(res.category, res.index, res.text)}
                                className="text-zinc-400 hover:text-amber-300 p-1 rounded transition-colors"
                                title="Edit memory"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(res.category, res.index)}
                                className="text-zinc-500 hover:text-rose-400 p-1 rounded transition-colors"
                                title="Delete memory"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="flex flex-col gap-2 mt-1">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              rows={2}
                              className="w-full bg-zinc-950 border border-rose-500/60 rounded-xl p-2 text-xs text-white focus:outline-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingKey(null)}
                                className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-[11px]"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveEdit}
                                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-medium flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-zinc-200 leading-relaxed">{res.text}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 1: User Profile */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-white/5 text-xs text-zinc-400 leading-relaxed">
                Core identity information Maryam uses to ground her relationship and communication style with Mohsin.
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Companion Name</label>
                  <input
                    type="text"
                    value={memory.userProfile.name}
                    onChange={(e) => handleUpdateProfile('name', e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Affectionate Nicknames Maryam Uses</label>
                  <input
                    type="text"
                    value={memory.userProfile.preferredNickname}
                    onChange={(e) => handleUpdateProfile('preferredNickname', e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Bond / Role</label>
                  <input
                    type="text"
                    value={memory.userProfile.role}
                    onChange={(e) => handleUpdateProfile('role', e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Language Style</label>
                  <input
                    type="text"
                    value={memory.userProfile.language}
                    onChange={(e) => handleUpdateProfile('language', e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Timezone</label>
                  <input
                    type="text"
                    value={memory.userProfile.timezone || 'Asia/Karachi (GMT+5)'}
                    onChange={(e) => handleUpdateProfile('timezone', e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tabs 2-8: Category Lists with View, Add, Edit, and Delete */}
          {activeTab !== 'profile' && activeTab !== 'search' && activeTab !== 'relevanceTest' && (
            <div className="space-y-4">
              {/* Category Guidance Note */}
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>
                  {activeTab === 'recentContext' 
                    ? 'Recent context is kept separate from long-term memory to preserve focus.'
                    : `Persistent memory category: ${(memory[activeTab] || []).length} stored items.`}
                </span>
              </div>

              {/* Add New Item */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder={`Add a new memory to ${activeTab}...`}
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem(activeTab);
                    }
                  }}
                />
                <button
                  onClick={() => handleAddItem(activeTab)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-rose-950/40 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-2 mt-2">
                {(memory[activeTab] || []).length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500 bg-zinc-900/30 rounded-2xl border border-white/5">
                    No memories in this category yet. Add one above or let Maryam extract them naturally during conversation.
                  </div>
                ) : (
                  (memory[activeTab] || []).map((item, idx) => {
                    const isEditing = editingKey?.category === activeTab && editingKey?.index === idx;
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-white/10 flex flex-col gap-2 text-xs text-zinc-200 transition-all"
                      >
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              rows={2}
                              className="w-full bg-zinc-950 border border-rose-500/60 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingKey(null)}
                                className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-[11px]"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveEdit}
                                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-medium flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 leading-relaxed">
                              <span className="text-rose-400/80 mr-2 font-mono text-[11px]">#{idx + 1}</span>
                              {item}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleStartEdit(activeTab, idx, item)}
                                className="text-zinc-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                title="Edit memory"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(activeTab, idx)}
                                className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                title="Delete memory"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Tab: Relevance Test */}
          {activeTab === 'relevanceTest' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-2xl bg-zinc-900/50 border border-violet-800/30 text-xs text-zinc-300 leading-relaxed">
                Maryam does not overwhelm the context window by dumping every stored memory with each turn. She retrieves only memories relevant to the current conversation.
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Test User Query (English or Roman Urdu):</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                    placeholder="e.g. Baby mera favorite color kya hai?"
                    className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Quick sample test queries */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Baby mera favorite color kya hai?',
                  'Maryam what projects are we working on?',
                  'Who is Bilal?',
                  'Did we make any architecture decision?',
                  'Do you remember our promise?'
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTestQuery(sample)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-[11px] text-zinc-400 hover:text-white transition-all"
                  >
                    {sample}
                  </button>
                ))}
              </div>

              <div className="mt-3 p-4 rounded-2xl bg-zinc-900/80 border border-violet-800/40 shadow-inner">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-violet-300">
                    Selective Memories Retrieved ({testExtracted.length}):
                  </span>
                  <span className="text-[10px] text-zinc-500">Injected into system instruction</span>
                </div>
                <div className="space-y-2">
                  {testExtracted.map((snippet, idx) => (
                    <div key={idx} className="text-xs text-zinc-200 bg-black/40 p-2.5 rounded-xl border border-white/5 font-mono text-[11px] leading-relaxed">
                      {snippet}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Clear Confirmation Modal Sub-View */}
        {showClearConfirm && (
          <div className="p-4 mx-5 mb-3 rounded-2xl bg-rose-950/90 border border-rose-800/80 text-xs text-white flex items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Are you sure you want to clear all stored memories? This cannot be undone.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-zinc-900/70 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (confirm('Reset memory back to Maryam default initial state?')) {
                  onResetMemory();
                }
              }}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-rose-300 transition-colors"
              title="Restore initial default memories"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Default</span>
            </button>

            <span className="text-zinc-700">|</span>

            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
              title="Clear all stored memories"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Memory</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium flex items-center gap-1.5 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
