import { useState, useEffect, useCallback, useRef } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Zap, Star, Lock } from "lucide-react";
import { toast } from "@/components/Toast";

const GRADE = {
  Stock:   { bg: "from-slate-700 to-slate-900", border: "border-slate-500/60", text: "text-slate-300",   glow: "",                          emoji: "⚫" },
  Refined: { bg: "from-blue-700 to-blue-900",   border: "border-blue-500/60",  text: "text-blue-200",   glow: "shadow-blue-500/30",         emoji: "🔵" },
  Rare:    { bg: "from-purple-700 to-purple-900",border:"border-purple-500/60", text: "text-purple-200", glow: "shadow-purple-500/40",       emoji: "🟣" },
  Exotic:  { bg: "from-pink-700 to-pink-900",   border: "border-pink-500/60",  text: "text-pink-200",   glow: "shadow-pink-500/40",         emoji: "🌸" },
  Legacy:  { bg: "from-amber-600 to-amber-800", border: "border-amber-400/80", text: "text-amber-200",  glow: "shadow-amber-500/60",        emoji: "👑" },
} as Record<string, { bg: string; border: string; text: string; glow: string; emoji: string }>;

// Pack visual definitions
const PACKS = [
  { id: "flowers",   name: "Flowers",    cost: 250,  cur: "coins", items: 5,
    bg: "from-pink-400 via-rose-500 to-pink-600", accent: "#f43f5e", shine: "#fda4af",
    pattern: "🌸", rare: 10, exotic: 2, legacy: 0 },
  { id: "planets",   name: "Planets",    cost: 300,  cur: "coins", items: 5,
    bg: "from-indigo-500 via-blue-600 to-violet-700", accent: "#4f46e5", shine: "#a5b4fc",
    pattern: "🪐", rare: 10, exotic: 2, legacy: 0 },
  { id: "starter",   name: "Starter",    cost: 150,  cur: "coins", items: 5,
    bg: "from-slate-500 via-slate-600 to-slate-700", accent: "#64748b", shine: "#94a3b8",
    pattern: "🌑", rare: 5,  exotic: 0, legacy: 0 },
  { id: "standard",  name: "Standard",   cost: 600,  cur: "coins", items: 5,
    bg: "from-blue-500 via-purple-600 to-indigo-700", accent: "#7c3aed", shine: "#c4b5fd",
    pattern: "💎", rare: 15, exotic: 5, legacy: 0 },
  { id: "premium",   name: "Premium",    cost: 2500, cur: "coins", items: 5,
    bg: "from-pink-500 via-fuchsia-600 to-purple-700", accent: "#a855f7", shine: "#f0abfc",
    pattern: "✨", rare: 35, exotic: 20, legacy: 5 },
  { id: "elite",     name: "Elite",      cost: 6000, cur: "coins", items: 5,
    bg: "from-violet-600 via-purple-700 to-pink-700", accent: "#8b5cf6", shine: "#ddd6fe",
    pattern: "🔮", rare: 25, exotic: 40, legacy: 10 },
  { id: "vip",       name: "VIP",        cost: 50,   cur: "stars", items: 5,
    bg: "from-amber-400 via-yellow-500 to-orange-500", accent: "#f59e0b", shine: "#fde68a",
    pattern: "⭐", rare: 45, exotic: 28, legacy: 7 },
  { id: "legendary", name: "Legendary",  cost: 200,  cur: "stars", items: 5,
    bg: "from-orange-500 via-red-600 to-rose-700", accent: "#ef4444", shine: "#fca5a5",
    pattern: "🔥", rare: 35, exotic: 50, legacy: 15 },
  { id: "mythic",    name: "Mythic Drop",cost: 500,  cur: "stars", items: 1,
    bg: "from-amber-300 via-yellow-400 to-amber-500", accent: "#f59e0b", shine: "#fef08a",
    pattern: "👑", rare: 0,  exotic: 0,  legacy: 100 },
];

// Canvas-based pack visual (looks like real card pack)
function PackVisual({ pack, onClick, shaking }: { pack: typeof PACKS[0]; onClick: () => void; shaking: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const W = c.width, H = c.height;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, pack.shine);
    grad.addColorStop(0.4, pack.accent);
    grad.addColorStop(1, "#000000");
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, W, H, 20);
    ctx.fill();

    // Diagonal lines pattern
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = -H; i < W + H; i += 18) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
    }

    // Gold top strip (tear line)
    const stripGrad = ctx.createLinearGradient(0, 0, W, 0);
    stripGrad.addColorStop(0, "#92400e");
    stripGrad.addColorStop(0.3, "#fde68a");
    stripGrad.addColorStop(0.7, "#fbbf24");
    stripGrad.addColorStop(1, "#92400e");
    ctx.fillStyle = stripGrad;
    roundRect(ctx, 0, 0, W, 36, [20, 20, 0, 0]);
    ctx.fill();

    // Tear perforations
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    for (let x = 16; x < W - 16; x += 14) {
      ctx.beginPath();
      ctx.arc(x, 30, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText("✂  ВІДРИВНИЙ КРАЙ  ✂", W / 2, 22);

    // Pack name banner
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, H - 52, W, 52);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 18px Arial`;
    ctx.textAlign = "center";
    ctx.fillText(pack.name.toUpperCase(), W / 2, H - 28);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px Arial";
    ctx.fillText(`${pack.items} карток`, W / 2, H - 12);

    // Center emoji/icon
    ctx.font = "52px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(pack.pattern, W / 2, H / 2 + 14);

    // Shine overlay
    const shineGrad = ctx.createLinearGradient(0, 0, W, H);
    shineGrad.addColorStop(0, "rgba(255,255,255,0.15)");
    shineGrad.addColorStop(0.5, "rgba(255,255,255,0.0)");
    shineGrad.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = shineGrad;
    roundRect(ctx, 0, 0, W, H, 20);
    ctx.fill();

    // Border
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, 0.75, 0.75, W - 1.5, H - 1.5, 20);
    ctx.stroke();
  }, [pack]);

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
    const radii = typeof r === "number" ? [r, r, r, r] : r;
    ctx.beginPath();
    ctx.moveTo(x + radii[0], y);
    ctx.lineTo(x + w - radii[1], y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radii[1]);
    ctx.lineTo(x + w, y + h - radii[2]);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radii[2], y + h);
    ctx.lineTo(x + radii[3], y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radii[3]);
    ctx.lineTo(x, y + radii[0]);
    ctx.quadraticCurveTo(x, y, x + radii[0], y);
    ctx.closePath();
  }

  return (
    <div onClick={onClick}
      className={`relative cursor-pointer select-none transition-all duration-150 active:scale-95 ${shaking ? "animate-bounce" : "hover:scale-105"}`}>
      {/* Stack shadows */}
      <canvas width={200} height={280} className="absolute top-3 left-2 rounded-2xl opacity-40 blur-sm"
        style={{ background: pack.accent }} />
      <canvas width={200} height={280} className="absolute top-1.5 left-1 rounded-2xl opacity-60"
        style={{ background: pack.accent }} />
      {/* Main pack */}
      <canvas ref={canvasRef} width={200} height={280} className="relative rounded-2xl shadow-2xl" />
      {/* Count badge */}
      <div className="absolute -top-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center font-bold text-base shadow-lg z-10"
        style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "#000" }}>
        {pack.items}
      </div>
    </div>
  );
}

export default function PackOpen() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlType = searchParams.get("type");

  const [selectedId, setSelectedId] = useState<string | null>(urlType);
  const [phase, setPhase] = useState<"select" | "idle" | "shaking" | "opening" | "revealing" | "done">(urlType ? "idle" : "select");
  const [items, setItems] = useState<any[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [currentReveal, setCurrentReveal] = useState(-1);
  const [hasLegacy, setHasLegacy] = useState(false);

  const { data: profile, refetch: refetchProfile } = trpc.game.getProfile.useQuery(undefined, { enabled: isAuthenticated });
  const coins = profile?.user?.coins ?? 0;
  const pack = PACKS.find(p => p.id === selectedId);

  const openPack = trpc.game.openPack.useMutation({
    onSuccess: (data) => {
      const newItems = (data.items || []).filter(Boolean);
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
    if (tg?.HapticFeedback) {
      const grade = items[currentReveal]?.template?.grade;
      tg.HapticFeedback.impactOccurred(grade === "Legacy" || grade === "Exotic" ? "heavy" : "light");
    }
  }, [currentReveal, items, hasLegacy]);

  useEffect(() => {
    if (phase === "revealing" && currentReveal >= 0 && currentReveal <= items.length) {
      const t = setTimeout(revealNext, currentReveal === 0 ? 500 : 750);
      return () => clearTimeout(t);
    }
  }, [phase, currentReveal]);

  const handleOpen = () => {
    if (!pack) return;
    if (pack.cur === "stars") { toast.info("Незабаром!", "Stars платежі в розробці"); return; }
    if (coins < pack.cost) { toast.error("Мало монет", `Потрібно ${pack.cost.toLocaleString()}₵`); return; }
    setPhase("shaking");
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("heavy");
    setTimeout(() => {
      setPhase("opening");
      openPack.mutate({ packType: pack.id as any });
    }, 1200);
  };

  const reset = () => {
    setPhase("select"); setItems([]); setRevealed([]);
    setCurrentReveal(-1); setHasLegacy(false); setSelectedId(null);
  };

  return (
    <div className={`min-h-screen text-white transition-all duration-1000 ${hasLegacy && phase === "done" ? "bg-[#1a1100]" : "bg-[#0a0a0f]"}`}>

      {/* Particles */}
      {(phase === "opening" || phase === "revealing") && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute rounded-full animate-ping opacity-30"
              style={{ width: Math.random() * 4 + 1, height: Math.random() * 4 + 1,
                left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                background: hasLegacy ? "#f59e0b" : "#a855f7",
                animationDelay: `${Math.random() * 2}s`, animationDuration: `${0.8 + Math.random()}s` }} />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3 relative z-10">
        <Button variant="ghost" size="icon"
          onClick={() => phase === "done" || phase === "select" ? navigate("/") : reset()}
          className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-base flex-1">
          {phase === "select" ? "Вибери пак" : pack ? `${pack.pattern} ${pack.name}` : "Відкриття"}
        </h1>
        <div className="flex items-center gap-1.5 bg-[#1a1a28] rounded-xl px-3 py-1.5">
          <Zap className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-yellow-400 font-bold text-sm">{coins.toLocaleString()}</span>
        </div>
      </div>

      {/* ── SELECT ── */}
      {phase === "select" && (
        <div className="px-4 pb-8 relative z-10">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">⚡ За монети</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {PACKS.filter(p => p.cur === "coins").map(p => {
              const can = coins >= p.cost;
              return (
                <button key={p.id} onClick={() => { if (!can) { toast.error("Мало монет", `Потрібно ${p.cost.toLocaleString()}₵`); return; } setSelectedId(p.id); setPhase("idle"); }}
                  className={`rounded-2xl overflow-hidden active:scale-95 transition-all relative text-left ${can ? "" : "opacity-60"}`}>
                  {!can && <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center rounded-2xl"><Lock className="w-5 h-5 text-slate-400" /></div>}
                  <div className={`bg-gradient-to-br ${p.bg} p-3 text-center relative overflow-hidden`}>
                    <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,white_0px,white_1px,transparent_1px,transparent_10px)]" />
                    <span className="text-3xl relative z-10">{p.pattern}</span>
                    <p className="text-white font-bold text-xs mt-1 relative z-10">{p.name}</p>
                    <p className="text-white/60 text-[10px] relative z-10">{p.items} карток</p>
                  </div>
                  <div className="bg-[#12121a] border-x border-b border-[#1e1e2e] rounded-b-2xl p-2">
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {p.rare > 0 && <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-bold">R {p.rare}%</span>}
                      {p.exotic > 0 && <span className="text-[8px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded font-bold">E {p.exotic}%</span>}
                      {p.legacy > 0 && <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">L {p.legacy}%</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span className={`font-bold text-xs ${can ? "text-yellow-400" : "text-slate-500"}`}>{p.cost.toLocaleString()}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">⭐ VIP Stars</p>
          <div className="space-y-2">
            {PACKS.filter(p => p.cur === "stars").map(p => (
              <button key={p.id} onClick={() => toast.info("Незабаром!", "Stars платежі в розробці")}
                className="w-full bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-3 flex items-center gap-3 hover:border-amber-500/30 active:scale-95 transition-all opacity-80">
                <span className="text-2xl">{p.pattern}</span>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">{p.name}</p>
                  <div className="flex gap-1 mt-0.5">
                    {p.exotic > 0 && <span className="text-[9px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-md font-bold">E {p.exotic}%</span>}
                    {p.legacy > 0 && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-md font-bold">L {p.legacy}%</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                  <Star className="w-3.5 h-3.5" />{p.cost}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── IDLE ── */}
      {phase === "idle" && pack && (
        <div className="flex flex-col items-center justify-center px-4 relative z-10" style={{ minHeight: "80vh" }}>
          <PackVisual pack={pack} onClick={handleOpen} shaking={false} />
          <p className="text-slate-400 text-sm mt-10 animate-pulse">Натисни на пак щоб відкрити</p>
          <div className="flex gap-3 mt-6 w-full max-w-xs">
            <Button variant="outline" onClick={reset} className="flex-1 border-[#2a2a3e] text-slate-400 rounded-2xl">← Назад</Button>
            <Button onClick={handleOpen}
              className={`flex-1 h-12 font-bold bg-gradient-to-r ${pack.bg} hover:opacity-90 rounded-2xl text-white shadow-lg`}>
              Відкрити!
            </Button>
          </div>
        </div>
      )}

      {/* ── SHAKING ── */}
      {phase === "shaking" && pack && (
        <div className="flex flex-col items-center justify-center" style={{ minHeight: "80vh" }}>
          <PackVisual pack={pack} onClick={() => {}} shaking={true} />
          <p className="text-purple-400 font-bold text-lg mt-10 animate-pulse">Розкриваємо...</p>
        </div>
      )}

      {/* ── OPENING ── */}
      {phase === "opening" && pack && (
        <div className="flex flex-col items-center justify-center" style={{ minHeight: "80vh" }}>
          <div className="relative w-[200px] h-[280px]">
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${pack.bg} animate-pulse opacity-60 blur-xl`} />
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${pack.bg} animate-ping opacity-30`} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-7xl animate-spin" style={{ animationDuration: "1s" }}>{pack.pattern}</span>
            </div>
          </div>
          <p className="text-white font-bold text-lg mt-10 animate-pulse">Генерація карток...</p>
        </div>
      )}

      {/* ── REVEALING / DONE ── */}
      {(phase === "revealing" || phase === "done") && items.length > 0 && (
        <div className="flex flex-col items-center justify-center px-4 relative z-10" style={{ minHeight: "80vh" }}>
          {hasLegacy && phase === "done" && (
            <div className="text-center mb-5">
              <p className="text-amber-400 font-bold text-2xl animate-bounce">👑 LEGACY DROP! 👑</p>
            </div>
          )}

          {/* Cards grid */}
          <div className={`grid gap-2 w-full max-w-sm ${items.length <= 3 ? "grid-cols-3" : items.length === 4 ? "grid-cols-4" : "grid-cols-5"}`}>
            {items.map((item, i) => {
              if (!item) return null;
              const grade = item?.template?.grade ?? "Stock";
              const g = GRADE[grade] ?? GRADE.Stock;
              const isRev = revealed[i];
              const isCur = currentReveal === i && phase === "revealing";
              return (
                <div key={item.id ?? i}
                  className={`relative aspect-[2/3] rounded-xl border-2 overflow-hidden transition-all duration-500
                    ${isRev ? `bg-gradient-to-br ${g.bg} ${g.border} shadow-xl ${g.glow}` : "border-[#2a2a3e]"}
                    ${isCur ? "scale-110 ring-2 ring-white/40 z-10" : ""}
                    ${grade === "Legacy" && isRev ? "ring-2 ring-amber-400 scale-105" : ""}
                  `}>
                  {/* Card back */}
                  {!isRev && (
                    <div className="absolute inset-0">
                      <div className={`absolute inset-0 bg-gradient-to-br ${pack?.bg ?? "from-purple-700 to-blue-800"} opacity-90`} />
                      <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,white_0px,white_1px,transparent_1px,transparent_8px)]" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl opacity-40">{pack?.pattern}</span>
                      </div>
                    </div>
                  )}
                  {/* Card front */}
                  {isRev && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-1 gap-0.5">
                      <span className="text-xl leading-none">{g.emoji}</span>
                      <p className="text-[7px] font-bold text-white text-center leading-tight px-0.5 line-clamp-2">{item?.template?.name}</p>
                      <p className={`text-[6px] font-bold ${g.text} uppercase`}>{grade}</p>
                      <p className="text-[8px] text-yellow-400 font-bold">{(item.marketPrice ?? 0).toLocaleString()}₵</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {phase === "done" && (
            <div className="w-full max-w-sm mt-5 space-y-3">
              <Card className="bg-[#12121a] border-[#1e1e2e] rounded-2xl p-3 text-center">
                <p className="text-xs text-slate-400">Загальна вартість</p>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 font-bold text-2xl">{items.reduce((s, i) => s + (i?.marketPrice ?? 0), 0).toLocaleString()}</span>
                  <span className="text-yellow-600 text-sm">₵</span>
                </div>
              </Card>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => navigate("/inventory")} className="border-[#2a2a3e] text-slate-300 rounded-2xl">📦 Інвентар</Button>
                <Button onClick={reset} className={`bg-gradient-to-r ${pack?.bg ?? "from-purple-600 to-blue-600"} text-white font-bold rounded-2xl hover:opacity-90`}>Ще раз!</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
