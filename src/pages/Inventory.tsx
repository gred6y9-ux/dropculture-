import { useState, useRef } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { ArrowLeft, Zap, Search, SortAsc, ShoppingBag, Flame, X, CheckSquare } from "lucide-react";
import { toast } from "@/components/Toast";

const GRADE_COLORS: Record<string, { card: string; text: string; dot: string; ring: string }> = {
  Stock:   { card: "bg-[#12121a] border-slate-700/50",  text: "text-slate-300",   dot: "bg-slate-500",   ring: "ring-slate-500" },
  Refined: { card: "bg-[#0d1520] border-blue-700/40",   text: "text-blue-300",    dot: "bg-blue-500",    ring: "ring-blue-500" },
  Rare:    { card: "bg-[#130d20] border-purple-700/40", text: "text-purple-300",  dot: "bg-purple-500",  ring: "ring-purple-500" },
  Exotic:  { card: "bg-[#1a0d18] border-pink-700/40",   text: "text-pink-300",    dot: "bg-pink-500",    ring: "ring-pink-500" },
  Legacy:  { card: "bg-[#1a1200] border-amber-600/50",  text: "text-amber-300",   dot: "bg-amber-500",   ring: "ring-amber-500" },
};

const GRADE_EMOJI: Record<string, string> = {
  Stock: "⚫", Refined: "🔵", Rare: "🟣", Exotic: "🌸", Legacy: "👑",
};

const SORT_OPTIONS = [
  { id: "newest", label: "Новіші" },
  { id: "value_desc", label: "Дорогі" },
  { id: "value_asc", label: "Дешеві" },
  { id: "grade", label: "Grade" },
];

const GRADE_ORDER: Record<string, number> = { Stock: 0, Refined: 1, Rare: 2, Exotic: 3, Legacy: 4 };

function timeAgo(dateStr: string | Date | undefined): string {
  if (!dateStr) return "";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "щойно";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} хв`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} год`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}д`;
  return date.toLocaleDateString("uk-UA");
}

export default function Inventory() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string | null>(null);
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"active" | "listed" | "all">("active");

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: items, isLoading, refetch } = trpc.game.getInventory.useQuery({}, {
    enabled: isAuthenticated, retry: false,
  });
  const { data: slotInfo, refetch: refetchSlots } = trpc.game.getInventorySlots.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: profile, refetch: refetchProfile } = trpc.game.getProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const [showSlotsModal, setShowSlotsModal] = useState(false);

  const buySlots = trpc.game.buyInventorySlots.useMutation({
    onSuccess: (data) => {
      refetchSlots(); refetchProfile();
      setShowSlotsModal(false);
      toast.success(`✅ +${data.addedSlots} слотів!`, `Тепер у тебе ${data.newSlots} слотів`);
    },
    onError: (err) => toast.error("Помилка", err.message),
  });

  const burnItems = trpc.game.burnItems.useMutation({
    onSuccess: (data: any) => {
      refetch();
      setSelectedIds(new Set());
      setSelectMode(false);
      toast.success("🔥 Burn успішно!", `Отримано ${data?.newGrade} предмет, витрачено ${data?.burnFee}₵`);
    },
    onError: (err) => toast.error("Помилка", err.message),
  });

  const gradeCounts = items?.reduce((acc, item) => {
    if ((item as any).isListed) return acc; // exclude listed from grade counts in active view
    const g = (item as any).template?.grade ?? "Stock";
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  const totalValue = items?.reduce((s, i) => s + ((i as any).marketPrice ?? 0), 0) ?? 0;

  let displayed = [...(items ?? [])];
  if (view === "active") displayed = displayed.filter(i => !(i as any).isListed);
  else if (view === "listed") displayed = displayed.filter(i => (i as any).isListed);
  if (filter) displayed = displayed.filter(i => (i as any).template?.grade === filter);
  if (search) displayed = displayed.filter(i => (i as any).template?.name?.toLowerCase().includes(search.toLowerCase()));
  if (sort === "value_desc") displayed.sort((a, b) => ((b as any).marketPrice ?? 0) - ((a as any).marketPrice ?? 0));
  else if (sort === "value_asc") displayed.sort((a, b) => ((a as any).marketPrice ?? 0) - ((b as any).marketPrice ?? 0));
  else if (sort === "grade") displayed.sort((a, b) => (GRADE_ORDER[(b as any).template?.grade] ?? 0) - (GRADE_ORDER[(a as any).template?.grade] ?? 0));
  else displayed.sort((a, b) => {
    const aDate = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : (a as any).id ?? 0;
    const bDate = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : (b as any).id ?? 0;
    return bDate - aDate;
  });

  // Selection helpers
  const startLongPress = (id: number) => {
    longPressTimer.current = setTimeout(() => {
      setSelectMode(true);
      setSelectedIds(new Set([id]));
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("medium");
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // Validate burn — must be 5 same-grade non-Legacy items
  const selectedItems = (items ?? []).filter((i: any) => selectedIds.has(i.id));
  const selectedGrades = new Set(selectedItems.map((i: any) => i.template?.grade));
  const canBurn = selectedItems.length === 5 && selectedGrades.size === 1 && !selectedGrades.has("Legacy");
  const burnHint = selectedItems.length < 5
    ? `Вибери ще ${5 - selectedItems.length}`
    : selectedItems.length > 5
    ? `Прибери ${selectedItems.length - 5}`
    : selectedGrades.size > 1
    ? "Має бути один grade"
    : selectedGrades.has("Legacy")
    ? "Legacy не можна спалити"
    : "Готово!";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        {selectMode ? (
          <Button variant="ghost" size="icon" onClick={exitSelectMode} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="flex-1">
          <h1 className="font-bold text-base">{selectMode ? `Вибрано ${selectedIds.size}` : "Інвентар"}</h1>
          <p className="text-xs text-slate-500">
            {selectMode ? "Утримай для виходу або тапай для вибору" : `${slotInfo?.used ?? 0} / ${slotInfo?.total ?? 100} слотів`}
          </p>
        </div>
        {!selectMode && (
          <div className="flex items-center gap-1 text-yellow-400 font-bold text-sm">
            <Zap className="w-3.5 h-3.5" />{totalValue.toLocaleString()}
          </div>
        )}
      </div>

      {/* Slot meter */}
      {!selectMode && slotInfo && (
        <div className="px-4 mb-3">
          {(() => {
            const pct = (slotInfo.used / slotInfo.total) * 100;
            const isWarning = pct >= 80;
            const isFull = pct >= 100;
            return (
              <div className={`bg-[#12121a] border rounded-xl p-2.5 ${isFull ? "border-red-500/40" : isWarning ? "border-amber-500/40" : "border-[#1e1e2e]"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    {isFull ? "🚫" : isWarning ? "⚠️" : "📦"} Слоти інвентаря
                    <span className={`text-[10px] ${isFull ? "text-red-400" : isWarning ? "text-amber-400" : "text-slate-500"}`}>
                      {slotInfo.used}/{slotInfo.total}
                    </span>
                  </p>
                  <Button onClick={() => setShowSlotsModal(true)} size="sm"
                    className="h-6 text-[10px] bg-purple-600 hover:bg-purple-700 rounded-lg px-2.5">
                    + Розширити
                  </Button>
                </div>
                <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    isFull ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-gradient-to-r from-purple-500 to-pink-500"
                  }`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                {isFull && <p className="text-[10px] text-red-400 mt-1.5">Інвентар повний — нові паки не відкриваються!</p>}
                {isWarning && !isFull && <p className="text-[10px] text-amber-400 mt-1.5">Скоро закінчиться місце</p>}
              </div>
            );
          })()}
        </div>
      )}

      {/* Search */}
      {!selectMode && (
        <div className="px-4 mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Пошук предмета..."
              className="w-full bg-[#12121a] border border-[#1e1e2e] rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
            />
          </div>
        </div>
      )}

      {/* View tabs */}
      {!selectMode && (
        <div className="px-4 mb-3">
          <div className="flex gap-1.5">
            {(() => {
              const activeCount = items?.filter(i => !(i as any).isListed).length ?? 0;
              const listedCount = items?.filter(i => (i as any).isListed).length ?? 0;
              const totalCount = items?.length ?? 0;
              return (
                <>
                  <button onClick={() => setView("active")}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${view === "active" ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
                    📦 Активні ({activeCount})
                  </button>
                  <button onClick={() => setView("listed")}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${view === "listed" ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
                    🛒 На маркеті ({listedCount})
                  </button>
                  <button onClick={() => setView("all")}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${view === "all" ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
                    Всі ({totalCount})
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Grade filters */}
      {!selectMode && (
        <div className="px-4 mb-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => setFilter(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${!filter ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
              Всі ({displayed.length})
            </button>
            {["Legacy", "Exotic", "Rare", "Refined", "Stock"].map(grade => (
              <button key={grade} onClick={() => setFilter(f => f === grade ? null : grade)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1
                  ${filter === grade ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
                <span>{GRADE_EMOJI[grade]}</span>
                <span>{grade} ({gradeCounts[grade] ?? 0})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sort */}
      {!selectMode && (
        <div className="px-4 mb-4">
          <div className="flex gap-1.5 items-center">
            <SortAsc className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            {SORT_OPTIONS.map(s => (
              <button key={s.id} onClick={() => setSort(s.id)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-all ${sort === s.id ? "bg-[#1e1e2e] text-white" : "text-slate-500"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Items grid */}
      <div className="px-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-slate-400 font-semibold">{search || filter ? "Нічого не знайдено" : "Інвентар порожній"}</p>
            <p className="text-slate-600 text-sm mt-1">{!search && !filter && "Відкрий пак щоб отримати предмети"}</p>
            {!search && !filter && (
              <Button onClick={() => navigate("/pack-open")} className="mt-4 bg-purple-600 hover:bg-purple-700 rounded-xl">
                Відкрити пак
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {displayed.map((item: any) => {
              const grade = item.template?.grade ?? "Stock";
              const colors = GRADE_COLORS[grade] ?? GRADE_COLORS.Stock;
              const isSelected = selectedIds.has(item.id);
              return (
                <Card key={item.id}
                  onClick={() => {
                    if (selectMode) {
                      // Don't allow selecting listed items for burn
                      if (item.isListed) {
                        toast.error("Предмет на маркеті", "Спочатку зніми з продажу");
                        return;
                      }
                      toggleSelect(item.id);
                    } else {
                      navigate(`/item/${item.id}`);
                    }
                  }}
                  onMouseDown={() => !selectMode && !item.isListed && startLongPress(item.id)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={() => !selectMode && !item.isListed && startLongPress(item.id)}
                  onTouchEnd={cancelLongPress}
                  className={`${colors.card} border p-2.5 cursor-pointer transition-all duration-150 relative
                    ${isSelected ? `ring-2 ${colors.ring} scale-95` : "hover:scale-105 active:scale-95"}
                    ${item.isListed && selectMode ? "opacity-40" : ""}
                  `}>
                  {/* Listed badge */}
                  {item.isListed && (
                    <div className="absolute top-1 right-1 bg-purple-600 rounded-md px-1 py-0.5 z-10 flex items-center gap-0.5">
                      <ShoppingBag className="w-2 h-2 text-white" />
                      <span className="text-[7px] text-white font-bold">SELL</span>
                    </div>
                  )}
                  {/* Selection checkmark */}
                  {selectMode && isSelected && (
                    <div className="absolute top-1 left-1 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center z-10">
                      <CheckSquare className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-lg">{GRADE_EMOJI[grade]}</span>
                    <div className={`${colors.dot} w-1.5 h-1.5 rounded-full`} />
                  </div>
                  <p className="text-xs font-bold text-white leading-tight mb-0.5 line-clamp-1">{item.template?.name}</p>
                  <p className="text-[8px] text-slate-500 mb-0.5">#{item.serialNum?.toString().padStart(4, "0")}</p>
                  <p className={`text-[9px] font-semibold ${colors.text} mb-1`}>{grade}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[8px] text-slate-500">F {item.floatVal?.toFixed(2)}</p>
                    <p className="text-[9px] text-yellow-400 font-bold">{(item.marketPrice ?? 0).toLocaleString()}</p>
                  </div>
                  {/* Time obtained — only in newest sort, not select mode */}
                  {sort === "newest" && !selectMode && item.createdAt && (
                    <p className="text-[8px] text-slate-600 mt-0.5">{timeAgo(item.createdAt)}</p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom action bar (select mode) */}
      {selectMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0d0d16]/95 backdrop-blur-sm border-t border-[#1e1e2e] p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white font-bold">{selectedIds.size} вибрано</span>
              <span className={`${canBurn ? "text-green-400" : "text-slate-500"}`}>{burnHint}</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={exitSelectMode} variant="outline" className="flex-1 border-[#2a2a3e] text-slate-400 rounded-xl">
                Скасувати
              </Button>
              <Button
                onClick={() => {
                  if (!canBurn) return;
                  if (!confirm(`Спалити 5 ${[...selectedGrades][0]} предметів за фі для отримання 1 предмета вищого grade?`)) return;
                  burnItems.mutate({ itemIds: Array.from(selectedIds) });
                }}
                disabled={!canBurn || burnItems.isPending}
                className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 rounded-xl font-bold">
                <Flame className="w-4 h-4 mr-1" /> {burnItems.isPending ? "..." : "Burn 5 → 1"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Slots purchase modal */}
      {showSlotsModal && slotInfo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-3xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white text-base">📦 Розширення інвентаря</h3>
              <button onClick={() => setShowSlotsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Зараз {slotInfo.used}/{slotInfo.total} слотів. Максимум 500.
            </p>
            <div className="space-y-2">
              {(() => {
                const tier = Math.floor((slotInfo.total - 100) / 100);
                const mult = Math.pow(1.5, Math.max(0, tier));
                const PACKS = [
                  { id: "small",  emoji: "📦", slots: 25,  baseCost: 500   },
                  { id: "medium", emoji: "🎒", slots: 50,  baseCost: 1500  },
                  { id: "large",  emoji: "🏪", slots: 100, baseCost: 5000  },
                ];
                return PACKS.map(p => {
                  const cost = Math.floor(p.baseCost * mult);
                  const tooMuch = slotInfo.total + p.slots > 500;
                  const userCoins = profile?.user?.coins ?? 0;
                  const cantAfford = userCoins < cost;
                  return (
                    <button key={p.id}
                      onClick={() => { if (!tooMuch && !cantAfford) buySlots.mutate({ pack: p.id as any }); }}
                      disabled={tooMuch || cantAfford || buySlots.isPending}
                      className={`w-full bg-[#0d0d14] border rounded-2xl p-3 flex items-center gap-3 transition-all
                        ${tooMuch || cantAfford ? "border-[#1e1e2e] opacity-50 cursor-not-allowed" : "border-purple-500/20 hover:border-purple-500/50 active:scale-95"}
                      `}>
                      <span className="text-2xl flex-shrink-0">{p.emoji}</span>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-white text-sm">+{p.slots} слотів</p>
                        <p className="text-[10px] text-slate-500">
                          {tooMuch ? "Перевищить ліміт 500" : `${(cost / p.slots).toFixed(0)}₵ за слот`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 text-yellow-400 font-bold text-sm">
                          <Zap className="w-3 h-3" />{cost.toLocaleString()}
                        </div>
                        {cantAfford && !tooMuch && <p className="text-[9px] text-red-400">Мало монет</p>}
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
            <p className="text-[10px] text-slate-600 mt-3 text-center">
              💡 Чим більше слотів — тим дорожче нові
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
