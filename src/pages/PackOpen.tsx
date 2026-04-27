import { useState, useEffect, useCallback } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router";
import { Sparkles, Zap, Star, Lock, ArrowLeft, Package } from "lucide-react";
import { toast } from "@/components/Toast";

const GRADE_COLORS: Record<string, { bg: string; border: string; text: string; emoji: string }> = {
  Stock:   { bg: "from-slate-700 to-slate-900", border: "border-slate-500", text: "text-slate-300",   emoji: "⚫" },
  Refined: { bg: "from-blue-700 to-blue-900",   border: "border-blue-500",  text: "text-blue-300",   emoji: "🔵" },
  Rare:    { bg: "from-purple-700 to-purple-900",border: "border-purple-500",text: "text-purple-300", emoji: "🟣" },
  Exotic:  { bg: "from-pink-700 to-pink-900",   border: "border-pink-500",  text: "text-pink-300",   emoji: "🌸" },
  Legacy:  { bg: "from-amber-600 to-amber-900", border: "border-amber-400", text: "text-amber-300",  emoji: "👑" },
};

const ALL_PACKS = [
  { id: "flowers",   emoji: "🌸", name: "Flowers",    cost: 250,  currency: "coins", items: 3, color: "from-pink-500 to-rose-700",    rare: 10, exotic: 2,  legacy: 0   },
  { id: "planets",   emoji: "🪐", name: "Planets",    cost: 300,  currency: "coins", items: 3, color: "from-indigo-600 to-blue-900",  rare: 10, exotic: 2,  legacy: 0   },
  { id: "starter",   emoji: "🌑", name: "Starter",    cost: 150,  currency: "coins", items: 3, color: "from-slate-600 to-slate-800",  rare: 5,  exotic: 0,  legacy: 0   },
  { id: "standard",  emoji: "💎", name: "Standard",   cost: 600,  currency: "coins", items: 5, color: "from-purple-700 to-blue-800",  rare: 15, exotic: 5,  legacy: 0   },
  { id: "premium",   emoji: "✨", name: "Premium",    cost: 2500, currency: "coins", items: 5, color: "from-pink-700 to-purple-800",  rare: 35, exotic: 20, legacy: 5   },
  { id: "elite",     emoji: "🔮", name: "Elite",      cost: 6000, currency: "coins", items: 5, color: "from-violet-700 to-pink-700",  rare: 25, exotic: 40, legacy: 10  },
  { id: "vip",       emoji: "⭐", name: "VIP",        cost: 50,   currency: "stars", items: 5, color: "from-amber-600 to-yellow-700", rare: 45, exotic: 28, legacy: 7   },
  { id: "legendary", emoji: "🔥", name: "Legendary",  cost: 200,  currency: "stars", items: 5, color: "from-orange-600 to-red-700",  rare: 35, exotic: 50, legacy: 15  },
  { id: "mythic",    emoji: "👑", name: "Mythic Drop", cost: 500, currency: "stars", items: 1, color: "from-amber-400 to-yellow-600", rare: 0,  exotic: 0,  legacy: 100 },
];

// Card deck animation component
function CardDeck({ pack, onOpen }: { pack: typeof ALL_PACKS[0]; onOpen: () => void }) {
  const [torn, setTorn] = useState(false);
  const [cardsOut, setCardsOut] = useState(false);

  const handleTap = () => {
    if (torn) return;
    setTorn(true);
    setTimeout(() => { setCardsOut(true); }, 600);
    setTimeout(() => { onOpen(); }, 1200);
  };

  return (
    <div className="flex flex-col items-center cursor-pointer select-none" onClick={handleTap}>
      <div className="relative w-52 h-72">
        {/* Tear strip at top */}
        <div className={`absolute top-0 left-0 right-0 h-8 z-20 rounded-t-2xl overflow-hidden transition-all duration-500 ${torn ? "opacity-0 -translate-y-4" : "opacity-100"}`}
          style={{ background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 4px, transparent 4px, transparent 12px)" }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-0.5 w-full bg-white/30" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="absolute w-3 h-3 rotate-45 border border-white/40 bg-transparent"
                style={{ left: `${10 + i * 12}%` }} />
            ))}
          </div>
        </div>

        {/* Card back stack */}
        {[2, 1, 0].map((offset) => (
          <div key={offset}
            className={`absolute inset-0 rounded-2xl transition-all duration-500 ${
              cardsOut && offset > 0 ? `translate-y-${offset * 4} opacity-${100 - offset * 30}` : ""
            }`}
            style={{
              transform: torn && cardsOut ? `translateY(${offset * 12}px) rotate(${(offset - 1) * 3}deg)` : `translateY(${offset * 3}px) rotate(${offset * 1}deg)`,
              zIndex: 3 - offset,
            }}>
            <div className={`w-full h-full bg-gradient-to-br ${pack.color} rounded-2xl shadow-2xl flex items-center justify-center overflow-hidden`}>
              <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,white_0px,white_1px,transparent_1px,transparent_10px)]" />
              {offset === 0 && <span className="text-6xl filter drop-shadow-lg">{pack.emoji}</span>}
            </div>
          </div>
        ))}

        {/* Count badge */}
        <div className="absolute -top-2 -right-2 z-30 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
          {pack.items}
        </div>

        {/* Tap hint */}
        {!torn && (
          <div className="absolute -bottom-8 left-0 right-0 text-center">
            <p className="text-slate-400 text-xs animate-pulse">Натисни щоб відкрити</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PackOpen() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlType = searchParams.get("type");

  const [selectedPack, setSelectedPack] = useState<string | null>(urlType);
  const [phase, setPhase] = useState<"select" | "idle" | "opening" | "revealing" | "done">(urlType ? "idle" : "select");
  const [items, setItems] = useState<any[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [currentReveal, setCurrentReveal] = useState(-1);
  const [hasLegacy, setHasLegacy] = useState(false);

  const { data: profile, refetch: refetchProfile } = trpc.game.getProfile.useQuery(undefined, { enabled: isAuthenticated });
  const coins = profile?.user?.coins ?? 0;
  const pack = ALL_PACKS.find(p => p.id === selectedPack);

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
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
  }, [currentReveal, items, hasLegacy]);

  useEffect(() => {
    if (phase === "revealing" && currentReveal >= 0 && currentReveal <= items.length) {
      const t = setTimeout(revealNext, currentReveal === 0 ? 400 : 700);
      return () => clearTimeout(t);
    }
  }, [phase, currentReveal]);

  const handleCardOpen = () => {
    if (!pack) return;
    setPhase("opening");
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("heavy");

    if (pack.currency === "stars") {
      toast.info("Незабаром!", "Stars платежі в розробці");
      setPhase("idle");
      return;
    }
    openPackMutation.mutate({ packType: pack.id as any });
  };

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
      {phase === "opening" && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="absolute w-1 h-1 bg-purple-400 rounded-full animate-ping"
              style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 1.5}s`, animationDuration: `${0.8 + Math.random() * 1.2}s` }} />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => phase === "select" || phase === "done" ? navigate("/") : reset()} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-base">{phase === "select" ? "Вибери пак" : pack ? `${pack.emoji} ${pack.name}` : "Відкриття"}</h1>
        {profile && (
          <div className="ml-auto flex items-center gap-1.5 bg-[#1a1a28] rounded-xl px-3 py-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-yellow-400 font-bold text-sm">{coins.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* ── SELECT ── */}
      {phase === "select" && (
        <div className="px-4 pb-6">
          {/* Coins packs */}
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-1">⚡ За монети</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {ALL_PACKS.filter(p => p.currency === "coins").map(p => {
              const canAfford = coins >= p.cost;
              return (
                <button key={p.id}
                  onClick={() => { if (!canAfford) { toast.error("Мало монет", `Потрібно ${p.cost.toLocaleString()}, у тебе ${coins.toLocaleString()}`); return; } setSelectedPack(p.id); setPhase("idle"); }}
                  className={`bg-[#12121a] border rounded-2xl overflow-hidden active:scale-95 transition-all text-left relative ${canAfford ? "border-[#1e1e2e] hover:border-purple-500/40" : "border-[#1e1e2e] opacity-60"}`}>
                  {!canAfford && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-2xl"><Lock className="w-5 h-5 text-slate-500" /></div>}
                  <div className={`bg-gradient-to-br ${p.color} p-3 text-center`}>
                    <span className="text-3xl">{p.emoji}</span>
                    <p className="text-white font-bold text-xs mt-1">{p.name}</p>
                    <p className="text-white/60 text-[10px]">{p.items} предм.</p>
                  </div>
                  <div className="p-2">
                    <div className="flex flex-wrap gap-0.5 mb-1.5">
                      {p.rare > 0 && <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded font-bold">R{p.rare}%</span>}
                      {p.exotic > 0 && <span className="text-[8px] bg-pink-500/20 text-pink-400 px-1 py-0.5 rounded font-bold">E{p.exotic}%</span>}
                      {p.legacy > 0 && <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded font-bold">L{p.legacy}%</span>}
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

      {/* ── IDLE - card deck ── */}
      {phase === "idle" && pack && (
        <div className="flex flex-col items-center justify-center px-4" style={{ minHeight: "80vh" }}>
          <div className="mb-12">
            <CardDeck pack={pack} onOpen={handleCardOpen} />
          </div>
          <div className="flex gap-3 w-full max-w-xs mt-4">
            <Button variant="outline" onClick={reset} className="flex-1 border-[#2a2a3e] text-slate-400 rounded-2xl">Назад</Button>
            <Button onClick={handleCardOpen} className={`flex-1 h-12 font-bold bg-gradient-to-r ${pack.color} hover:opacity-90 rounded-2xl`}>
              <Sparkles className="w-4 h-4 mr-1.5" /> Відкрити!
            </Button>
          </div>
        </div>
      )}

      {/* ── OPENING ── */}
      {phase === "opening" && pack && (
        <div className="flex flex-col items-center justify-center" style={{ minHeight: "80vh" }}>
          <div className="relative w-48 h-64 mx-auto mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl animate-ping opacity-20" />
            <div className={`w-full h-full bg-gradient-to-br ${pack.color} rounded-3xl flex items-center justify-center animate-pulse`}>
              <Sparkles className="w-20 h-20 text-white animate-spin" style={{ animationDuration: "1.5s" }} />
            </div>
          </div>
          <p className="text-pink-400 animate-pulse font-bold text-lg">Генерація предметів...</p>
        </div>
      )}

      {/* ── REVEALING / DONE ── */}
      {(phase === "revealing" || phase === "done") && items.length > 0 && (
        <div className="flex flex-col items-center justify-center px-4" style={{ minHeight: "80vh" }}>
          {hasLegacy && phase === "done" && (
            <div className="text-center mb-4 animate-bounce">
              <p className="text-amber-400 font-bold text-2xl">👑 LEGACY DROP! 👑</p>
            </div>
          )}
          <div className={`grid gap-3 mb-6 w-full max-w-sm ${items.length <= 3 ? "grid-cols-3" : "grid-cols-5"}`}>
            {items.map((item, i) => {
              if (!item) return null;
              const grade = item?.template?.grade ?? "Stock";
              const colors = GRADE_COLORS[grade] ?? GRADE_COLORS.Stock;
              const isRevealed = revealed[i];
              const isCurrent = currentReveal === i;
              return (
                <div key={item.id ?? i}
                  className={`relative aspect-[2/3] rounded-2xl border-2 transition-all duration-500 overflow-hidden
                    ${isRevealed ? `bg-gradient-to-br ${colors.bg} ${colors.border} shadow-xl` : "bg-[#1a1a2e] border-[#2a2a3e]"}
                    ${isCurrent && phase === "revealing" ? "scale-110 ring-2 ring-white/40 z-10" : ""}
                    ${grade === "Legacy" && isRevealed ? "ring-2 ring-amber-400" : ""}
                  `}>
                  {/* Card back */}
                  {!isRevealed && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`absolute inset-0 bg-gradient-to-br ${pack?.color ?? "from-purple-700 to-blue-800"} opacity-80`} />
                      <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,white_0px,white_1px,transparent_1px,transparent_8px)]" />
                      <Package className="w-6 h-6 text-white/60 relative z-10" />
                    </div>
                  )}
                  {/* Card front */}
                  {isRevealed && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-1 gap-0.5">
                      <span className="text-2xl">{colors.emoji}</span>
                      <p className="text-[7px] font-bold text-white text-center leading-tight px-1 line-clamp-2">{item?.template?.name}</p>
                      <p className={`text-[6px] font-bold ${colors.text}`}>{grade}</p>
                      <p className="text-[8px] text-yellow-400 font-bold">{(item.marketPrice ?? 0).toLocaleString()}₵</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {phase === "done" && (
            <div className="w-full max-w-sm space-y-3">
              <Card className="bg-[#12121a] border-[#1e1e2e] rounded-2xl p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Загальна вартість</p>
                <div className="flex items-center justify-center gap-1.5">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 font-bold text-2xl">
                    {items.reduce((s, i) => s + (i?.marketPrice ?? 0), 0).toLocaleString()}
                  </span>
                  <span className="text-yellow-600 text-sm">монет</span>
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
              <Button variant="ghost" onClick={() => navigate("/")} className="w-full text-slate-500 text-sm">← Головна</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
