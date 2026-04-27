import { useState, useEffect, useCallback } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router";
import { Package, ArrowLeft, Sparkles, Zap, Star, Lock } from "lucide-react";
import { toast } from "@/components/Toast";

const GRADE_COLORS: Record<string, { bg: string; border: string; text: string; emoji: string }> = {
  Stock:   { bg: "from-slate-700 to-slate-900", border: "border-slate-500", text: "text-slate-300",   emoji: "⚫" },
  Refined: { bg: "from-blue-700 to-blue-900",   border: "border-blue-500",  text: "text-blue-300",   emoji: "🔵" },
  Rare:    { bg: "from-purple-700 to-purple-900",border: "border-purple-500",text: "text-purple-300", emoji: "🟣" },
  Exotic:  { bg: "from-pink-700 to-pink-900",   border: "border-pink-500",  text: "text-pink-300",   emoji: "🌸" },
  Legacy:  { bg: "from-amber-600 to-amber-900", border: "border-amber-400", text: "text-amber-300",  emoji: "👑" },
};

const ALL_PACKS = [
  { id: "starter",   emoji: "🌑", name: "Starter",    cost: 150,  currency: "coins", items: 3, color: "from-slate-600 to-slate-800", rare: 5,  exotic: 0,  legacy: 0   },
  { id: "standard",  emoji: "💎", name: "Standard",   cost: 600,  currency: "coins", items: 5, color: "from-purple-700 to-blue-800", rare: 15, exotic: 5,  legacy: 0   },
  { id: "premium",   emoji: "✨", name: "Premium",    cost: 2500, currency: "coins", items: 5, color: "from-pink-700 to-purple-800", rare: 35, exotic: 20, legacy: 5   },
  { id: "elite",     emoji: "🔮", name: "Elite",      cost: 6000, currency: "coins", items: 5, color: "from-violet-700 to-pink-700", rare: 25, exotic: 40, legacy: 10  },
  // Free test collections
  { id: "flowers",   emoji: "🌸", name: "Flowers",    cost: 0,    currency: "free",  items: 3, color: "from-pink-500 to-rose-700",  rare: 10, exotic: 2,  legacy: 0   },
  { id: "planets",   emoji: "🪐", name: "Planets",    cost: 0,    currency: "free",  items: 3, color: "from-indigo-600 to-blue-900",rare: 10, exotic: 2,  legacy: 0   },
  // Stars packs
  { id: "vip",       emoji: "⭐", name: "VIP",        cost: 50,   currency: "stars", items: 5, color: "from-amber-600 to-yellow-700",rare: 45, exotic: 28, legacy: 7   },
  { id: "legendary", emoji: "🔥", name: "Legendary",  cost: 200,  currency: "stars", items: 5, color: "from-orange-600 to-red-700", rare: 35, exotic: 50, legacy: 15  },
  { id: "mythic",    emoji: "👑", name: "Mythic Drop", cost: 500,  currency: "stars", items: 1, color: "from-amber-400 to-yellow-600",rare: 0, exotic: 0, legacy: 100 },
];

export default function PackOpen() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlType = searchParams.get("type");

  const [selectedPack, setSelectedPack] = useState<string | null>(urlType);
  const [phase, setPhase] = useState<"select" | "idle" | "shaking" | "opening" | "revealing" | "done">(urlType ? "idle" : "select");
  const [items, setItems] = useState<any[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [currentReveal, setCurrentReveal] = useState(-1);
  const [hasLegacy, setHasLegacy] = useState(false);

  const { data: profile, refetch: refetchProfile } = trpc.game.getProfile.useQuery(undefined, { enabled: isAuthenticated });
  const coins = profile?.user?.coins ?? 0;

  const openPackMutation = trpc.game.openPack.useMutation({
    onSuccess: (data) => {
      const newItems = data.items.filter(Boolean);
      setItems(newItems);
      setRevealed(new Array(newItems.length).fill(false));
      setHasLegacy(newItems.some((i: any) => i?.template?.grade === "Legacy"));
      setPhase("revealing");
      setCurrentReveal(0);
      refetchProfile();
    },
    onError: (err) => { toast.error("Помилка", err.message); setPhase("idle"); },
  });

  const getDailyMutation = trpc.game.getDailyPack.useMutation({
    onSuccess: (data) => {
      const newItems = data.items.filter(Boolean);
      setItems(newItems);
      setRevealed(new Array(newItems.length).fill(false));
      setHasLegacy(newItems.some((i: any) => i?.template?.grade === "Legacy"));
      setPhase("revealing");
      setCurrentReveal(0);
      refetchProfile();
    },
    onError: (err) => { toast.error("Помилка", err.message); setPhase("idle"); },
  });

  const pack = ALL_PACKS.find(p => p.id === selectedPack);

  const handleOpen = useCallback(() => {
    if (!pack || phase !== "idle") return;
    setPhase("shaking");
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("medium");
    setTimeout(() => {
      setPhase("opening");
      if (pack.currency === "free") {
        getDailyMutation.mutate();
      } else if (pack.currency === "coins") {
        openPackMutation.mutate({ packType: pack.id as any });
      } else {
        toast.info("Незабаром!", "Stars платежі в розробці");
        setPhase("idle");
      }
    }, 1000);
  }, [phase, pack]);

  const revealNext = useCallback(() => {
    if (currentReveal >= items.length) {
      setRevealed(prev => prev.map(() => true));
      setPhase("done");
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred(hasLegacy ? "success" : "warning");
      return;
    }
    setRevealed(prev => { const n = [...prev]; n[currentReveal] = true; return n; });
    setCurrentReveal(c => c + 1);
  }, [currentReveal, items, hasLegacy]);

  useEffect(() => {
    if (phase === "revealing" && currentReveal >= 0 && currentReveal <= items.length) {
      const t = setTimeout(revealNext, currentReveal === 0 ? 400 : 600);
      return () => clearTimeout(t);
    }
  }, [phase, currentReveal]);

  const reset = () => {
    setPhase("select"); setItems([]); setRevealed([]);
    setCurrentReveal(-1); setHasLegacy(false); setSelectedPack(null);
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <p className="text-slate-400">Потрібна авторизація</p>
    </div>
  );

  return (
    <div className={`min-h-screen text-white relative overflow-hidden transition-colors duration-1000 ${hasLegacy && phase === "done" ? "bg-[#1a1200]" : "bg-[#0a0a0f]"}`}>

      {/* Particles on open */}
      {phase === "opening" && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="absolute w-1 h-1 bg-purple-400 rounded-full animate-ping"
              style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 1.5}s`, animationDuration: `${0.8 + Math.random() * 1.2}s` }} />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => phase === "select" ? navigate("/") : reset()} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-base">
          {phase === "select" ? "Вибери пак" : pack ? `${pack.emoji} ${pack.name}` : "Відкриття"}
        </h1>
        {profile && (
          <div className="ml-auto flex items-center gap-1.5 bg-[#1a1a28] rounded-xl px-3 py-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-yellow-400 font-bold text-sm">{coins.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* ── SELECT PACK ── */}
      {phase === "select" && (
        <div className="px-4 pb-6">
          {/* Free packs */}
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-2">🆓 Безкоштовні колекції</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {ALL_PACKS.filter(p => p.currency === "free").map(p => (
              <button key={p.id} onClick={() => { setSelectedPack(p.id); setPhase("idle"); }}
                className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl overflow-hidden hover:border-purple-500/40 active:scale-95 transition-all text-left">
                <div className={`bg-gradient-to-br ${p.color} p-4 text-center`}>
                  <span className="text-3xl">{p.emoji}</span>
                  <p className="text-white font-bold text-xs mt-1">{p.name}</p>
                  <p className="text-white/60 text-[10px]">{p.items} предмети</p>
                </div>
                <div className="p-2">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {p.rare > 0 && <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-md font-bold">R {p.rare}%</span>}
                    {p.exotic > 0 && <span className="text-[9px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-md font-bold">E {p.exotic}%</span>}
                  </div>
                  <p className="text-green-400 font-bold text-xs">БЕЗКОШТОВНО</p>
                </div>
              </button>
            ))}
          </div>

          {/* Coins packs */}
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">⚡ За монети</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {ALL_PACKS.filter(p => p.currency === "coins").map(p => {
              const canAfford = coins >= p.cost;
              return (
                <button key={p.id} onClick={() => { if (!canAfford) { toast.error("Мало монет", `Потрібно ${p.cost.toLocaleString()}, у тебе ${coins.toLocaleString()}`); return; } setSelectedPack(p.id); setPhase("idle"); }}
                  className={`bg-[#12121a] border rounded-2xl overflow-hidden active:scale-95 transition-all text-left relative ${canAfford ? "border-[#1e1e2e] hover:border-purple-500/40" : "border-[#1e1e2e] opacity-60"}`}>
                  {!canAfford && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 rounded-2xl">
                      <Lock className="w-6 h-6 text-slate-400" />
                    </div>
                  )}
                  <div className={`bg-gradient-to-br ${p.color} p-4 text-center`}>
                    <span className="text-3xl">{p.emoji}</span>
                    <p className="text-white font-bold text-xs mt-1">{p.name}</p>
                    <p className="text-white/60 text-[10px]">{p.items} предметів</p>
                  </div>
                  <div className="p-2">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {p.rare > 0 && <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-md font-bold">R {p.rare}%</span>}
                      {p.exotic > 0 && <span className="text-[9px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-md font-bold">E {p.exotic}%</span>}
                      {p.legacy > 0 && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-md font-bold">L {p.legacy}%</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span className={`font-bold text-xs ${canAfford ? "text-yellow-400" : "text-slate-500"}`}>{p.cost.toLocaleString()}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Stars packs */}
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">⭐ VIP за Stars</p>
          <div className="space-y-2">
            {ALL_PACKS.filter(p => p.currency === "stars").map(p => (
              <button key={p.id} onClick={() => toast.info("Незабаром!", "Stars платежі в розробці")}
                className="w-full bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-3 flex items-center gap-3 hover:border-purple-500/30 active:scale-95 transition-all text-left opacity-80">
                <span className="text-2xl">{p.emoji}</span>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">{p.name}</p>
                  <div className="flex gap-1 mt-0.5">
                    {p.exotic > 0 && <span className="text-[9px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-md font-bold">E {p.exotic}%</span>}
                    {p.legacy > 0 && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-md font-bold">L {p.legacy}%</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-purple-400 font-bold text-sm">
                  <Star className="w-3.5 h-3.5" />{p.cost}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── IDLE - ready to open ── */}
      {phase === "idle" && pack && (
        <div className="flex flex-col items-center justify-center px-4" style={{ minHeight: "80vh" }}>
          <div onClick={handleOpen} className="relative w-48 h-64 mx-auto mb-8 cursor-pointer group">
            <div className={`absolute inset-0 bg-gradient-to-br ${pack.color} rounded-3xl shadow-2xl flex items-center justify-center group-hover:scale-105 group-active:scale-95 transition-all duration-200 overflow-hidden`}>
              <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,white_0px,white_1px,transparent_1px,transparent_8px)]" />
              <span className="text-6xl filter drop-shadow-lg">{pack.emoji}</span>
            </div>
            <div className="absolute -top-3 -right-3 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-sm font-bold shadow-lg animate-bounce">
              {pack.items}
            </div>
          </div>
          <div className="text-center mb-6">
            <p className="text-white font-bold text-lg mb-1">{pack.name}</p>
            {pack.currency === "free" ? (
              <p className="text-green-400 text-sm font-bold">Безкоштовно</p>
            ) : (
              <div className="flex items-center gap-1 justify-center">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 font-bold">{pack.cost.toLocaleString()} монет</span>
              </div>
            )}
          </div>
          <div className="flex gap-3 w-full max-w-xs">
            <Button variant="outline" onClick={() => { setPhase("select"); setSelectedPack(null); }}
              className="flex-1 border-[#2a2a3e] text-slate-400 rounded-2xl">Назад</Button>
            <Button onClick={handleOpen}
              className={`flex-1 h-12 text-base font-bold bg-gradient-to-r ${pack.color} hover:opacity-90 rounded-2xl shadow-lg`}>
              <Sparkles className="w-4 h-4 mr-1.5" /> Відкрити!
            </Button>
          </div>
        </div>
      )}

      {/* ── SHAKING ── */}
      {phase === "shaking" && pack && (
        <div className="flex flex-col items-center justify-center" style={{ minHeight: "80vh" }}>
          <div className="w-48 h-64 mx-auto mb-8 animate-bounce">
            <div className={`w-full h-full bg-gradient-to-br ${pack.color} rounded-3xl shadow-2xl flex items-center justify-center`}>
              <span className="text-6xl animate-spin" style={{ animationDuration: "0.4s" }}>{pack.emoji}</span>
            </div>
          </div>
          <p className="text-purple-400 animate-pulse font-semibold">Розкриваємо...</p>
        </div>
      )}

      {/* ── OPENING ── */}
      {phase === "opening" && pack && (
        <div className="flex flex-col items-center justify-center" style={{ minHeight: "80vh" }}>
          <div className="relative w-48 h-64 mx-auto mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl animate-ping opacity-30" />
            <div className={`w-full h-full bg-gradient-to-br ${pack.color} rounded-3xl shadow-2xl flex items-center justify-center animate-pulse`}>
              <Sparkles className="w-20 h-20 text-white animate-spin" style={{ animationDuration: "1.5s" }} />
            </div>
          </div>
          <p className="text-pink-400 animate-pulse font-semibold">Генерація предметів...</p>
        </div>
      )}

      {/* ── REVEALING / DONE ── */}
      {(phase === "revealing" || phase === "done") && items.length > 0 && (
        <div className="flex flex-col items-center justify-center px-4" style={{ minHeight: "80vh" }}>
          {hasLegacy && phase === "done" && (
            <div className="text-center mb-4">
              <p className="text-amber-400 font-bold text-xl animate-pulse">👑 LEGACY DROP! 👑</p>
            </div>
          )}
          <div className={`grid gap-2 mb-6 w-full max-w-sm ${items.length <= 3 ? "grid-cols-3" : "grid-cols-5"}`}>
            {items.map((item, i) => {
              if (!item) return null;
              const grade = item?.template?.grade ?? "Stock";
              const colors = GRADE_COLORS[grade] ?? GRADE_COLORS.Stock;
              const isRevealed = revealed[i];
              const isCurrent = currentReveal === i && phase === "revealing";
              return (
                <div key={item.id ?? i}
                  className={`relative aspect-[2/3] rounded-xl border-2 transition-all duration-500 overflow-hidden
                    ${isRevealed ? `bg-gradient-to-br ${colors.bg} ${colors.border} shadow-lg` : "bg-[#1a1a2e] border-[#2a2a3e]"}
                    ${isCurrent ? "scale-110 ring-2 ring-white/50 z-10" : ""}
                    ${grade === "Legacy" && isRevealed ? "ring-2 ring-amber-400 scale-105" : ""}
                  `}>
                  {!isRevealed ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold">?</div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-1 gap-0.5">
                      <span className="text-xl">{colors.emoji}</span>
                      <p className="text-[7px] font-bold text-white text-center leading-tight px-0.5 truncate w-full">{item?.template?.name}</p>
                      <p className={`text-[6px] font-bold ${colors.text}`}>{grade}</p>
                      <p className="text-[9px] text-yellow-400 font-bold">{(item.marketPrice ?? 0).toLocaleString()}₵</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {phase === "done" && (
            <div className="w-full max-w-sm space-y-3">
              <Card className="bg-[#12121a] border-[#1e1e2e] rounded-2xl p-3 text-center">
                <p className="text-xs text-slate-400 mb-0.5">Загальна вартість</p>
                <div className="flex items-center justify-center gap-1">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 font-bold text-xl">
                    {items.reduce((s, i) => s + (i?.marketPrice ?? 0), 0).toLocaleString()}
                  </span>
                </div>
              </Card>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => navigate("/inventory")}
                  className="border-[#2a2a3e] text-slate-300 rounded-2xl">📦 Інвентар</Button>
                <Button onClick={reset}
                  className={`bg-gradient-to-r ${pack?.color ?? "from-purple-600 to-blue-600"} hover:opacity-90 rounded-2xl font-bold`}>
                  Ще раз!
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
