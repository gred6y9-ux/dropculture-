import { useState } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { ArrowLeft, Zap, Search, SortAsc, ShoppingBag } from "lucide-react";

const GRADE_COLORS: Record<string, { card: string; text: string; dot: string }> = {
  Stock:   { card: "bg-[#12121a] border-slate-700/50",  text: "text-slate-300",   dot: "bg-slate-500" },
  Refined: { card: "bg-[#0d1520] border-blue-700/40",   text: "text-blue-300",    dot: "bg-blue-500" },
  Rare:    { card: "bg-[#130d20] border-purple-700/40", text: "text-purple-300",  dot: "bg-purple-500" },
  Exotic:  { card: "bg-[#1a0d18] border-pink-700/40",   text: "text-pink-300",    dot: "bg-pink-500" },
  Legacy:  { card: "bg-[#1a1200] border-amber-600/50",  text: "text-amber-300",   dot: "bg-amber-500" },
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

export default function Inventory() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string | null>(null);
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"active" | "listed" | "all">("active");

  const { data: items, isLoading } = trpc.game.getInventory.useQuery({}, {
    enabled: isAuthenticated, retry: false,
  });

  const gradeCounts = items?.reduce((acc, item) => {
    const g = (item as any).template?.grade ?? "Stock";
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  const totalValue = items?.reduce((s, i) => s + ((i as any).marketPrice ?? 0), 0) ?? 0;

  let displayed = [...(items ?? [])];
  // View filter: hide listed items by default
  if (view === "active") displayed = displayed.filter(i => !(i as any).isListed);
  else if (view === "listed") displayed = displayed.filter(i => (i as any).isListed);
  if (filter) displayed = displayed.filter(i => (i as any).template?.grade === filter);
  if (search) displayed = displayed.filter(i => (i as any).template?.name?.toLowerCase().includes(search.toLowerCase()));
  if (sort === "value_desc") displayed.sort((a, b) => ((b as any).marketPrice ?? 0) - ((a as any).marketPrice ?? 0));
  else if (sort === "value_asc") displayed.sort((a, b) => ((a as any).marketPrice ?? 0) - ((b as any).marketPrice ?? 0));
  else if (sort === "grade") displayed.sort((a, b) => (GRADE_ORDER[(b as any).template?.grade] ?? 0) - (GRADE_ORDER[(a as any).template?.grade] ?? 0));
  else displayed.sort((a, b) => ((b as any).id ?? 0) - ((a as any).id ?? 0));

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-6">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-base">Інвентар</h1>
          <p className="text-xs text-slate-500">{items?.length ?? 0} предметів</p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-yellow-400 font-bold text-sm">
          <Zap className="w-3.5 h-3.5" />{totalValue.toLocaleString()}
        </div>
      </div>

      {/* Search */}
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

      {/* View tabs: Active / Listed / All */}
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

      {/* Grade filters */}
      <div className="px-4 mb-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button onClick={() => setFilter(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${!filter ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
            Всі ({items?.length ?? 0})
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

      {/* Sort */}
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

      {/* Items */}
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
              return (
                <Card key={item.id} onClick={() => navigate(`/item/${item.id}`)}
                  className={`${colors.card} border p-2.5 cursor-pointer hover:scale-105 active:scale-95 transition-all duration-150 relative`}>
                  {/* Listed badge */}
                  {item.isListed && (
                    <div className="absolute top-1 right-1 bg-purple-600 rounded-md px-1 py-0.5 z-10 flex items-center gap-0.5">
                      <ShoppingBag className="w-2 h-2 text-white" />
                      <span className="text-[7px] text-white font-bold">SELL</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-lg">{GRADE_EMOJI[grade]}</span>
                    <div className={`${colors.dot} w-1.5 h-1.5 rounded-full`} />
                  </div>
                  <p className="text-xs font-bold text-white leading-tight mb-0.5 line-clamp-1">{item.template?.name}</p>
                  {/* Serial number — make duplicates distinct */}
                  <p className="text-[8px] text-slate-500 mb-0.5">#{item.serialNum?.toString().padStart(4, "0")}</p>
                  <p className={`text-[9px] font-semibold ${colors.text} mb-1`}>{grade}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[8px] text-slate-500">F {item.floatVal?.toFixed(2)}</p>
                    <p className="text-[9px] text-yellow-400 font-bold">{(item.marketPrice ?? 0).toLocaleString()}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
