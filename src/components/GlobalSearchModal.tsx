import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  X, 
  BookOpen, 
  Award, 
  Briefcase, 
  FolderTree, 
  AlertTriangle, 
  Clock, 
  ArrowRight, 
  CornerDownLeft, 
  Layers, 
  Filter, 
  Sparkles,
  GitBranch,
  CheckCircle2
} from 'lucide-react';
import { SearchResultItem, SearchEntityType, KnowledgeSpace, InstructionSection, QuizQuestion } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaces: KnowledgeSpace[];
  sections: InstructionSection[];
  questions: QuizQuestion[];
  cases: any[];
  courses: any[];
  onNavigateToResult: (item: SearchResultItem) => void;
}

const RECENT_SEARCHES_KEY = 'viatec_recent_searches_v1';

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  spaces = [],
  sections = [],
  questions = [],
  cases = [],
  courses = [],
  onNavigateToResult
}) => {
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<SearchEntityType>('all');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('all');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [counts, setCounts] = useState<Record<SearchEntityType, number>>({
    all: 0,
    instruction: 0,
    question: 0,
    case: 0,
    course: 0,
    glossary: 0
  });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (saved) {
        setRecentSearches(JSON.parse(saved).slice(0, 5));
      }
    } catch {}
  }, [isOpen]);

  // Autofocus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Save query to recent searches
  const saveRecentSearch = (searchTerm: string) => {
    const term = searchTerm.trim();
    if (!term || term.length < 2) return;
    try {
      const updated = [term, ...recentSearches.filter(s => s.toLowerCase() !== term.toLowerCase())].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {}
  };

  // Perform search with debounce
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setCounts({ all: 0, instruction: 0, question: 0, case: 0, course: 0, glossary: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.set('q', trimmed);
        if (selectedType !== 'all') params.set('type', selectedType);
        if (selectedSpaceId !== 'all') params.set('spaceId', selectedSpaceId);

        const res = await fetch(`/api/search?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setCounts(data.counts || { all: 0, instruction: 0, question: 0, case: 0, course: 0, glossary: 0 });
          setSelectedIndex(0);
        } else {
          // Fallback to client-side search if API encounters an issue
          performClientFallbackSearch(trimmed, selectedType, selectedSpaceId);
        }
      } catch (err) {
        performClientFallbackSearch(trimmed, selectedType, selectedSpaceId);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [query, selectedType, selectedSpaceId, isOpen]);

  // Client-side fallback search implementation
  const performClientFallbackSearch = (
    q: string, 
    typeFilter: SearchEntityType, 
    spaceFilter: string
  ) => {
    const qLower = q.toLowerCase();
    const tokens = qLower.split(/\s+/).filter(Boolean);
    const fallbackResults: SearchResultItem[] = [];

    // 1. Sections
    if (typeFilter === 'all' || typeFilter === 'instruction') {
      for (const s of sections) {
        if (spaceFilter !== 'all' && (s.spaceId || 'space-general') !== spaceFilter) continue;
        const text = `${s.title} ${s.subtitle || ''} ${s.summary || ''} ${(s.keyPoints || []).join(' ')} ${(s.stopRules || []).join(' ')}`.toLowerCase();
        if (tokens.some(t => text.includes(t))) {
          fallbackResults.push({
            id: s.id,
            type: 'instruction',
            title: s.title,
            subtitle: s.subtitle || s.department,
            snippet: s.summary || (s.keyPoints && s.keyPoints[0]) || '',
            spaceId: s.spaceId || 'space-general',
            department: s.department,
            courseId: s.courseId,
            sectionId: s.id,
            version: s.version || '1.0',
            status: s.status || 'published',
            score: text.includes(qLower) ? 100 : 50
          });
        }
      }
    }

    // 2. Questions
    if (typeFilter === 'all' || typeFilter === 'question') {
      for (const qItem of questions) {
        const text = `${qItem.question} ${qItem.explanation || ''} ${(qItem.options || []).join(' ')}`.toLowerCase();
        if (tokens.some(t => text.includes(t))) {
          fallbackResults.push({
            id: qItem.id,
            type: 'question',
            title: qItem.question,
            subtitle: `Тестування • ${qItem.department || 'Загальне'}`,
            snippet: qItem.explanation || '',
            department: qItem.department,
            sectionId: qItem.sectionId,
            courseId: qItem.courseId,
            score: text.includes(qLower) ? 80 : 40
          });
        }
      }
    }

    // 3. Cases
    if (typeFilter === 'all' || typeFilter === 'case') {
      for (const c of cases) {
        const text = `${c.title} ${c.scenario || ''}`.toLowerCase();
        if (tokens.some(t => text.includes(t))) {
          fallbackResults.push({
            id: c.id,
            type: 'case',
            title: c.title,
            subtitle: 'Практичний кейс',
            snippet: c.scenario || '',
            sectionId: c.sectionId,
            score: text.includes(qLower) ? 80 : 40
          });
        }
      }
    }

    fallbackResults.sort((a, b) => b.score - a.score);
    setResults(fallbackResults);
    setCounts({
      all: fallbackResults.length,
      instruction: fallbackResults.filter(r => r.type === 'instruction').length,
      question: fallbackResults.filter(r => r.type === 'question').length,
      case: fallbackResults.filter(r => r.type === 'case').length,
      course: fallbackResults.filter(r => r.type === 'course').length,
      glossary: fallbackResults.filter(r => r.type === 'glossary').length
    });
    setSelectedIndex(0);
  };

  // Keyboard navigation inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex(prev => (prev + 1) % results.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelectResult(results[selectedIndex]);
      }
    }
  };

  const handleSelectResult = (item: SearchResultItem) => {
    saveRecentSearch(query);
    onNavigateToResult(item);
    onClose();
  };

  const handleQuickTermClick = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  // Helper to highlight matching keywords in snippets and titles
  const renderHighlighted = (text: string, searchQuery: string) => {
    if (!searchQuery.trim() || !text) return text;
    const tokens = searchQuery
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 1)
      .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (tokens.length === 0) return text;

    const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-amber-100 text-amber-900 rounded-xs px-0.5 font-semibold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 md:p-12 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div 
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDown}
      >
        {/* Top Search Input Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50/50">
          <Search className={`w-5 h-5 transition-colors ${loading ? 'text-blue-600 animate-pulse' : 'text-slate-400'}`} />
          
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Швидкий пошук регламентів, правил, тестів, СТОП-списків (напр. «РМК», «картка», «100 грн»)..."
            className="flex-1 bg-transparent text-base sm:text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />

          {query && (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
              title="Очистити поле"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 text-[11px] font-mono font-medium text-slate-400">
            <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md shadow-2xs">ESC</kbd>
          </div>
        </div>

        {/* Filter Bar: Spaces & Entity Types */}
        <div className="px-3 sm:px-4 py-2 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Entity Type Chips */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {[
              { key: 'all', label: 'Всі результати', count: counts.all },
              { key: 'instruction', label: 'Інструкції', count: counts.instruction },
              { key: 'question', label: 'Тести', count: counts.question },
              { key: 'case', label: 'Кейси', count: counts.case },
              { key: 'glossary', label: 'Терміни / СТОП', count: counts.glossary },
              { key: 'course', label: 'Курси', count: counts.course },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setSelectedType(tab.key as SearchEntityType)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                  selectedType === tab.key
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                {query.trim() && tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    selectedType === tab.key ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Space Filter Dropdown / Pill */}
          {spaces.length > 0 && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <FolderTree className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedSpaceId}
                onChange={(e) => setSelectedSpaceId(e.target.value)}
                className="bg-slate-100 text-slate-700 text-xs font-medium py-1 px-2 rounded-lg border-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Всі простори знань</option>
                {spaces.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Results Area */}
        <div 
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 min-h-[220px]"
        >
          {/* State 1: Query is empty -> Show Recent Searches & Quick Suggestions */}
          {!query.trim() && (
            <div className="py-4 px-2 space-y-6">
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Останні пошукові запити
                    </span>
                    <button
                      onClick={clearRecentSearches}
                      className="text-slate-400 hover:text-rose-600 text-[11px] transition"
                    >
                      Очистити історію
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuickTermClick(term)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition flex items-center gap-1.5 group"
                      >
                        <Clock className="w-3 h-3 text-slate-400 group-hover:text-blue-600" />
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  Популярні теми та швидкі запити
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { title: 'Повернення день у день (РМК)', term: 'РМК день у день', desc: 'Сценарій А під час відкритої зміни' },
                    { title: 'Акт про видачу понад 100 грн', term: 'Акт 100 грн', desc: 'Вимоги до фіскальних документів' },
                    { title: 'Повернення на ту саму картку', term: 'повернення на картку', desc: 'Суворе СТОП-правило для терміналу' },
                    { title: 'Сценарій Б (закрита зміна)', term: 'Сценарій Б закрита зміна', desc: 'Оформлення повернення за вчора' },
                    { title: 'Термін 14 днів і заява', term: '14 днів заява', desc: 'Права покупця та бланки заяв' },
                    { title: 'Коригування ПДВ бухгалтерією', term: 'ПДВ коригування', desc: 'Регламент для фінансового відділу' }
                  ].map((sug, i) => (
                    <div
                      key={i}
                      onClick={() => handleQuickTermClick(sug.term)}
                      className="p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition flex items-start gap-2.5 group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-600 text-slate-500 flex items-center justify-center shrink-0 mt-0.5 transition">
                        <Search className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition">
                          {sug.title}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {sug.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* State 2: Searching with no results */}
          {query.trim() && !loading && results.length === 0 && (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Нічого не знайдено за запитом «{query}»
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                Спробуйте скористатися більш загальними словами (наприклад, «каса», «акт», «чек», «ПДВ») або перевірте вибраний простір знань.
              </p>
              <button
                onClick={() => {
                  setSelectedType('all');
                  setSelectedSpaceId('all');
                  inputRef.current?.focus();
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium transition"
              >
                Скинути фільтри
              </button>
            </div>
          )}

          {/* State 3: Results list */}
          {results.map((item, index) => {
            const isSelected = index === selectedIndex;

            // Icon and badges based on type
            let typeIcon = <BookOpen className="w-4 h-4 text-blue-600" />;
            let typeLabel = 'Інструкція';
            let typeBg = 'bg-blue-50 text-blue-700 border-blue-200';
            let actionLabel = 'Читати регламент';

            if (item.type === 'question') {
              typeIcon = <Award className="w-4 h-4 text-emerald-600" />;
              typeLabel = 'Тест';
              typeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
              actionLabel = 'Пройти тест';
            } else if (item.type === 'case') {
              typeIcon = <Briefcase className="w-4 h-4 text-purple-600" />;
              typeLabel = 'Кейс';
              typeBg = 'bg-purple-50 text-purple-700 border-purple-200';
              actionLabel = 'Запустити кейс';
            } else if (item.type === 'course') {
              typeIcon = <FolderTree className="w-4 h-4 text-indigo-600" />;
              typeLabel = 'Курс';
              typeBg = 'bg-indigo-50 text-indigo-700 border-indigo-200';
              actionLabel = 'Перейти до курсу';
            } else if (item.type === 'glossary') {
              typeIcon = <AlertTriangle className="w-4 h-4 text-amber-600" />;
              typeLabel = 'Термін / СТОП';
              typeBg = 'bg-amber-50 text-amber-700 border-amber-200';
              actionLabel = 'Переглянути правило';
            }

            return (
              <div
                key={`${item.type}-${item.id}`}
                onClick={() => handleSelectResult(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`p-3 rounded-xl border transition cursor-pointer flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-300 shadow-xs'
                    : 'bg-white border-slate-150 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    {typeIcon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${typeBg}`}>
                        {typeLabel}
                      </span>
                      {item.spaceName && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          <FolderTree className="w-3 h-3 text-slate-400" />
                          {item.spaceName}
                        </span>
                      )}
                      {item.version && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-purple-600 font-mono font-bold bg-purple-50 px-1 py-0.2 rounded border border-purple-100">
                          <GitBranch className="w-2.5 h-2.5" />
                          v{item.version}
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 leading-snug truncate">
                      {renderHighlighted(item.title, query)}
                    </h4>

                    {item.subtitle && (
                      <p className="text-xs text-slate-500 font-medium truncate mb-1">
                        {renderHighlighted(item.subtitle, query)}
                      </p>
                    )}

                    {item.snippet && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/80 p-1.5 rounded-md border border-slate-100 mt-1">
                        {renderHighlighted(item.snippet, query)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1 text-xs text-slate-400 self-center">
                  <span className={`hidden sm:inline font-medium text-xs ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                    {actionLabel}
                  </span>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <CornerDownLeft className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer / Helper Keys */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md font-mono text-[10px] shadow-2xs">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md font-mono text-[10px] shadow-2xs">↓</kbd>
              <span>Навігація</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md font-mono text-[10px] shadow-2xs">↵</kbd>
              <span>Вибрати</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <span>Глобальний пошук «ВІАТЕК»</span>
            <span>•</span>
            <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md font-mono text-[10px] shadow-2xs">⌘K</kbd>
          </div>
        </div>
      </div>
    </div>
  );
};
