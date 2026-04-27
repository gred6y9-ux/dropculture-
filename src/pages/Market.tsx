import { useState } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { ArrowLeft, TrendingUp, Zap, Star, Filter, RefreshCw } from "lucide-react";

const GRADE_COLORS: Record<string, { card: string; badge: string; dot: string }> = {
  Stock:   { card: "bg-[#12121a] border-slate-700/50",  badge: "bg-slate-700 text-slate-300",    dot: "bg-slate-400" },
  Refined: { card: "bg-[#0d1520] border-blue-700/40",   badge: "bg-blue-900/50 text-blue-300",   dot: "bg-blue-400" },
  Rare:    { card: "bg-[#130d20] border-purple-700/40", badge: "bg-purple-900/50 text-purple-300", dot: "bg-purple-400" },
  Exotic:  { card: "bg-[#1a0d18] border-pink-700/40",   badge: "bg-pink-900/50 text-pink-300",   dot: "bg-pink-400" },
  Legacy:  { card: "bg-[#1a1200] border-amber-600/50",  badge: "bg-amber-900/50 text-amber-300", dot: "bg-amber-400" },
};

const GRADE_EMOJI: Record<string, string> = {
  Stock: "⚫", Refined: "🔵", Rare: "🟣", Exotic: "🌸", Legacy: "👑",
};

export default function Market() {
  const { isAuthenticated, user } = useTelegramAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"listings" | "mylistings">("listings");
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const [currency, setCurrency] = useState<"all" | "coins" | "stars">("all");

  const { data: listings, isLoading, refetch } = trpc.market.getListings.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const buyItem = trpc.market.buyItem.useMutation({
    onSuccess: () => { refetch(); alert("✅ Куплено!"); },
    onError: (err) => alert("❌ " + err.message),
  });

  let displayed = listings ?? [];
  if (gradeFilter) displayed = displayed.filter((l: any) => l.item?.template?.grade === gradeFilter);
  if (currency !== "all") displayed = displayed.filter((l: any) => l.currency === currency);

  const myListings = displayed.filter((l: any) => l.sellerId === (user as any)?.id);
  const otherListings = displayed.filter((l: any) => l.sellerId !== (user as any)?.id);
  const showListings = activeTab === "mylistings" ? myListings : otherListings;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-6">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-base">Маркетплейс</h1>
          <p className="text-xs text-slate-500">{listings?.length ?? 0} лотів</p>
        </div>
        <button onClick={() => refetch()} className="ml-auto text-slate-400 hover:text-white p-2">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Balance */}
      <div className="px-4 mb-4">
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 font-bold">{(user as any)?.coins?.toLocaleString() ?? 0}</span>
            <span className="text-slate-500 text-xs">монет</span>
          </div>
          <div className="w-px h-4 bg-[#1e1e2e]" />
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-purple-400" />
            <span className="text-purple-400 font-bold">{(user as any)?.stars ?? 0}</span>
            <span className="text-slate-500 text-xs">stars</span>
          </div>
          <Button onClick={() => navigate("/inventory")} size="sm"
            className="bg-purple-600 hover:bg-purple-700 rounded-xl text-xs">
            Продати
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-4 mb-3 gap-2">
        {(["listings", "mylistings"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === tab ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
            {tab === "listings" ? `🛒 Всі лоти (${otherListings.length})` : `📦 Мої (${myListings.length})`}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="px-4 mb-3 space-y-2">
        {/* Grade filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button onClick={() => setGradeFilter(null)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold ${!gradeFilter ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
            Всі
          </button>
          {["Legacy", "Exotic", "Rare", "Refined", "Stock"].map(g => (
            <button key={g} onClick={() => setGradeFilter(f => f === g ? null : g)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${gradeFilter === g ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
              {GRADE_EMOJI[g]} {g}
            </button>
          ))}
        </div>
        {/* Currency filter */}
        <div className="flex gap-1.5">
          {(["all", "coins", "stars"] as const).map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${currency === c ? "bg-[#1e1e2e] text-white" : "text-slate-500"}`}>
              {c === "all" ? "Всі" : c === "coins" ? "⚡ Coins" : "⭐ Stars"}
            </button>
          ))}
        </div>
      </div>

      {/* Listings */}
      <div className="px-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : showListings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🏪</p>
            <p className="text-slate-400 font-semibold">
              {activeTab === "mylistings" ? "У тебе немає активних лотів" : "Поки немає лотів"}
            </p>
            <p className="text-slate-600 text-sm mt-1">
              {activeTab === "mylistings" ? "Відкрий інвентар і виставь предмет" : "Будь першим трейдером!"}
            </p>
            <Button onClick={() => navigate("/inventory")} className="mt-4 bg-purple-600 hover:bg-purple-700 rounded-xl">
              Виставити предмет
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {showListings.map((listing: any) => {
              const grade = listing.item?.template?.grade ?? "Stock";
              const colors = GRADE_COLORS[grade] ?? GRADE_COLORS.Stock;
              const isOwn = listing.sellerId === (user as any)?.id;

              return (
                <Card key={listing.id} className={`${colors.card} border p-3`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1e1e2e] rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                      {GRADE_EMOJI[grade]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-sm font-bold text-white truncate">{listing.item?.template?.name}</p>
                        <span className={`${colors.badge} text-[9px] font-bold px-1.5 py-0.5 rounded-lg flex-shrink-0`}>{grade}</span>
                      </div>
                      <div className="flex gap-2 text-[10px] text-slate-500">
                        <span>Float {listing.item?.floatVal?.toFixed(2)}</span>
                        <span>#{listing.item?.serialNum}</span>
                        <span>Seed {listing.item?.patternSeed}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 font-bold text-sm mb-1">
                        {listing.currency === "coins" ? (
                          <><Zap className="w-3.5 h-3.5 text-yellow-400" /><span className="text-yellow-400">{listing.price.toLocaleString()}</span></>
                        ) : (
                          <><Star className="w-3.5 h-3.5 text-purple-400" /><span className="text-purple-400">{listing.price}</span></>
                        )}
                      </div>
                      {!isOwn ? (
                        <Button size="sm" onClick={() => {
                          if (!confirm(`Купити за ${listing.price} ${listing.currency === "coins" ? "монет" : "Stars"}?`)) return;
                          buyItem.mutate({ listingId: listing.id });
                        }}
                          disabled={buyItem.isPending}
                          className="text-[10px] h-6 px-2 bg-green-600 hover:bg-green-700 rounded-lg">
                          Купити
                        </Button>
                      ) : (
                        <span className="text-[10px] text-slate-500 bg-[#1e1e2e] px-2 py-0.5 rounded-lg">Мій</span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Coming soon banner */}
      <div className="px-4 mt-6">
        <Card className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-purple-500/20 p-4 text-center">
          <TrendingUp className="w-6 h-6 text-purple-400 mx-auto mb-2" />
          <p className="text-white font-bold text-sm">P2P Stars торгівля — незабаром</p>
          <p className="text-slate-500 text-xs mt-1">Продавай Legacy предмети за реальні Stars</p>
        </Card>
      </div>
    </div>
  );
}
