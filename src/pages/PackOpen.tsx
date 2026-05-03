import { useState, useEffect, useCallback, useRef } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Zap, Star, Lock } from "lucide-react";
import { toast } from "@/components/Toast";

const GRADE: Record<string, { bg: string; front: string; border: string; text: string; emoji: string; glow: string }> = {
  Stock:   { bg: "from-slate-700 to-slate-900",   front: "#1e293b", border: "border-slate-500/60",  text: "text-slate-200",   emoji: "⚫", glow: "" },
  Refined: { bg: "from-blue-700 to-blue-900",     front: "#1e3a5f", border: "border-blue-500/60",   text: "text-blue-100",    emoji: "🔵", glow: "0 0 20px rgba(59,130,246,0.5)" },
  Rare:    { bg: "from-purple-700 to-purple-900", front: "#3b0764", border: "border-purple-500/60", text: "text-purple-100",  emoji: "🟣", glow: "0 0 25px rgba(139,92,246,0.6)" },
  Exotic:  { bg: "from-pink-700 to-pink-900",     front: "#831843", border: "border-pink-500/60",   text: "text-pink-100",    emoji: "🌸", glow: "0 0 30px rgba(236,72,153,0.6)" },
  Legacy:  { bg: "from-amber-600 to-amber-900",   front: "#78350f", border: "border-amber-400/80",  text: "text-amber-100",   emoji: "👑", glow: "0 0 40px rgba(245,158,11,0.7)" },
};

const PACKS = [
  { id: "flowers",  name: "Flowers",    cost: 250,  cur: "coins", items: 5, pattern: "🌸", accent: "#f43f5e", shine: "#fda4af", dark: "#881337",
    gradient: ["#f43f5e","#be185d","#9d174d"], image: "/packs/flowers-pack.jpeg" },
  { id: "planets",  name: "Planets",    cost: 300,  cur: "coins", items: 5, pattern: "🪐", accent: "#4f46e5", shine: "#818cf8", dark: "#1e1b4b",
    gradient: ["#4f46e5","#4338ca","#312e81"] },
  { id: "starter",  name: "Starter",    cost: 150,  cur: "coins", items: 5, pattern: "🌑", accent: "#64748b", shine: "#94a3b8", dark: "#0f172a",
    gradient: ["#475569","#334155","#1e293b"] },
  { id: "standard", name: "Standard",   cost: 600,  cur: "coins", items: 5, pattern: "💎", accent: "#7c3aed", shine: "#a78bfa", dark: "#2e1065",
    gradient: ["#7c3aed","#6d28d9","#4c1d95"] },
  { id: "premium",  name: "Premium",    cost: 2500, cur: "coins", items: 5, pattern: "✨", accent: "#db2777", shine: "#f9a8d4", dark: "#500724",
    gradient: ["#db2777","#9333ea","#7e22ce"] },
  { id: "elite",    name: "Elite",      cost: 6000, cur: "coins", items: 5, pattern: "🔮", accent: "#8b5cf6", shine: "#ddd6fe", dark: "#1e1b4b",
    gradient: ["#8b5cf6","#7c3aed","#ec4899"] },
  { id: "vip",      name: "VIP",        cost: 50,   cur: "stars", items: 5, pattern: "⭐", accent: "#f59e0b", shine: "#fde68a", dark: "#78350f",
    gradient: ["#f59e0b","#d97706","#b45309"] },
  { id: "legendary",name: "Legendary",  cost: 200,  cur: "stars", items: 5, pattern: "🔥", accent: "#ef4444", shine: "#fca5a5", dark: "#7f1d1d",
    gradient: ["#ef4444","#dc2626","#b91c1c"] },
  { id: "mythic",   name: "Mythic Drop",cost: 500,  cur: "stars", items: 1, pattern: "👑", accent: "#f59e0b", shine: "#fef08a", dark: "#78350f",
    gradient: ["#f59e0b","#eab308","#ca8a04"] },
];
type Pack = typeof PACKS[0];

// ─── Canvas Pack Visual ───────────────────────────────────────────
function PackCanvas({ pack, torn }: { pack: Pack & { image?: string }; torn: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  const doDraw = (c: HTMLCanvasElement, img?: HTMLImageElement) => {
    const ctx = c.getContext("2d")!;
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);

    // Rounded rect helper
    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    };

    // Clip to rounded rect
    rr(0, 0, W, H, 16);
    ctx.save(); ctx.clip();

    if (img) {
      // Draw image covering full canvas
      ctx.drawImage(img, 0, 0, W, H);
      // Subtle dark overlay for readability
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, W, H);
    } else {
      // Body gradient fallback
      const g = ctx.createLinearGradient(0, 0, W, H);
      pack.gradient.forEach((col: string, i: number) => g.addColorStop(i / (pack.gradient.length - 1), col));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // Diagonal shimmer lines
      ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1;
      for (let i = -H; i < W + H; i += 16) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
      }
    }

    ctx.restore();

    ctx.restore();

    // Rounded rect helper for overlays (after restore)
    const rr2 = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    };

    if (!torn) {
      // Gold tear strip
      const stripH = 38;
      rr2(0, 0, W, stripH, 16);
      const sg = ctx.createLinearGradient(0, 0, W, 0);
      sg.addColorStop(0, "#92400e"); sg.addColorStop(0.25, "#fde68a"); sg.addColorStop(0.5, "#fbbf24"); sg.addColorStop(0.75, "#fde68a"); sg.addColorStop(1, "#92400e");
      ctx.fillStyle = sg; ctx.fill();
      // Perforations
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      for (let x = 14; x < W - 14; x += 13) { ctx.beginPath(); ctx.arc(x, stripH - 5, 3, 0, Math.PI * 2); ctx.fill(); }
      // Strip text
      ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = "bold 9px Arial"; ctx.textAlign = "center";
      ctx.fillText("✂  ВІДРИВНИЙ КРАЙ  ✂", W / 2, 19);
    } else {
      // Torn jagged top
      ctx.fillStyle = pack.gradient[0];
      ctx.beginPath(); ctx.moveTo(0, 0);
      for (let x = 0; x <= W; x += 8) { ctx.lineTo(x, Math.random() * 14); }
      ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();
    }

    // Only show emoji if no image
    if (!img) {
      ctx.font = "52px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 8;
      ctx.fillText(pack.pattern, W / 2, H / 2 + (torn ? 0 : 8));
      ctx.shadowBlur = 0;
    }

    // Bottom banner
    const bannerY = H - 50;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    rr2(0, bannerY, W, 50, 0); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 15px Arial"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
    ctx.fillText(pack.name.toUpperCase(), W / 2, bannerY + 18);
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "10px Arial";
    ctx.fillText(`${pack.items} карток`, W / 2, bannerY + 36);

    // Shine overlay
    const sh = ctx.createLinearGradient(0, 0, W * 0.6, H * 0.4);
    sh.addColorStop(0, "rgba(255,255,255,0.12)"); sh.addColorStop(1, "rgba(0,0,0,0)");
    rr2(0, 0, W, H, 16); ctx.fillStyle = sh; ctx.fill();

    // Border
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1.5;
    rr2(0.75, 0.75, W - 1.5, H - 1.5, 16); ctx.stroke();
  };

  useEffect(() => {
    const c = ref.current; if (!c) return;
    if ((pack as any).image) {
      const img = new Image();
      img.onload = () => doDraw(c, img);
      img.onerror = () => doDraw(c);
      img.src = (pack as any).image;
    } else {
      doDraw(c);
    }
  }, [pack, torn]);

  return <canvas ref={ref} width={200} height={280} className="rounded-2xl shadow-2xl" />;
}

// ─── Flip Card Component ──────────────────────────────────────────
function FlipCard({ item, pack, flipped, delay, isNew }: { item: any; pack: Pack; flipped: boolean; delay: number; isNew: boolean }) {
  const grade = item?.template?.grade ?? "Stock";
  const g = GRADE[grade] ?? GRADE.Stock;

  return (
    <div
      className="relative"
      style={{
        perspective: "600px",
        animationDelay: `${delay}ms`,
      }}>
      <div
        className="relative w-full transition-all duration-700"
        style={{
          aspectRatio: "2/3",
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(0deg)" : "rotateY(180deg)",
          transitionDelay: `${delay}ms`,
        }}>
        {/* Back face (pack color) */}
        <div className="absolute inset-0 rounded-xl overflow-hidden border-2 border-white/10"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <div className={`w-full h-full bg-gradient-to-br`}
            style={{ background: `linear-gradient(135deg, ${pack.gradient[0]}, ${pack.gradient[pack.gradient.length - 1]})` }}>
            <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,white_0px,white_1px,transparent_1px,transparent_10px)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl opacity-40">{pack.pattern}</span>
            </div>
          </div>
        </div>

        {/* Front face */}
        <div className={`absolute inset-0 rounded-xl border-2 ${g.border} overflow-hidden`}
          style={{
            backfaceVisibility: "hidden",
            background: `linear-gradient(160deg, ${g.front}ee, ${g.front}99)`,
            boxShadow: flipped && grade !== "Stock" ? g.glow : "none",
          }}>
          <div className="absolute inset-0 opacity-5 bg-[repeating-linear-gradient(45deg,white_0px,white_1px,transparent_1px,transparent_8px)]" />
          {/* Grade shine for Rare+ */}
          {(grade === "Legacy" || grade === "Exotic") && flipped && (
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent animate-pulse" />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 p-1.5">
            <span className="text-2xl leading-none">{g.emoji}</span>
            <p className="text-[7px] font-bold text-white text-center leading-tight line-clamp-2 px-1">{item?.template?.name}</p>
            <p className={`text-[6px] font-bold uppercase ${g.text}`}>{grade}</p>
            <div className="w-full h-px bg-white/10 my-0.5" />
            <p className="text-[7px] text-slate-300">Float {(item?.floatVal ?? 0).toFixed(2)}</p>
            <p className="text-[8px] text-yellow-400 font-bold">{(item?.marketPrice ?? 0).toLocaleString()}₵</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tear Animation ──────────────────────────────────────────────
function TearAnimation({ pack, onDone }: { pack: Pack; onDone: () => void }) {
  const [stage, setStage] = useState<"intact" | "shaking" | "tear" | "done">("intact");
  const [topY, setTopY] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage("shaking"), 100);
    const t2 = setTimeout(() => { setStage("tear"); setTopY(-120); }, 900);
    const t3 = setTimeout(() => { setStage("done"); onDone(); }, 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ height: 360 }}>
      {/* Stack shadows */}
      <div className="absolute" style={{ transform: "rotate(3deg) translateY(6px)", opacity: 0.5 }}>
        <canvas width={200} height={280} className="rounded-2xl"
          style={{ background: `linear-gradient(135deg, ${pack.gradient[0]}, ${pack.gradient[pack.gradient.length - 1]})` }} />
      </div>
      <div className="absolute" style={{ transform: "rotate(-2deg) translateY(3px)", opacity: 0.7 }}>
        <canvas width={200} height={280} className="rounded-2xl"
          style={{ background: `linear-gradient(135deg, ${pack.gradient[0]}, ${pack.gradient[pack.gradient.length - 1]})` }} />
      </div>

      {/* Main pack with clip for tear effect */}
      <div className={`relative transition-all duration-200 ${stage === "shaking" ? "animate-bounce" : ""}`}>
        {/* Top strip that flies off */}
        <div className="relative overflow-hidden rounded-t-2xl" style={{
          height: 40,
          transform: `translateY(${topY}px)`,
          transition: "transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          opacity: stage === "done" ? 0 : 1,
          rotate: stage === "tear" ? "-8deg" : "0deg",
        }}>
          <PackCanvas pack={pack} torn={false} />
        </div>

        {/* Main body */}
        <div className="relative overflow-hidden rounded-b-2xl" style={{ marginTop: -40 }}>
          <div style={{ transform: `translateY(${stage === "tear" ? -topY : 0}px)`, transition: "transform 0.5s ease" }}>
            <PackCanvas pack={pack} torn={stage === "tear" || stage === "done"} />
          </div>
        </div>

        {/* Count */}
        <div className="absolute -top-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center font-bold text-base shadow-lg z-10"
          style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "#000" }}>
          {pack.items}
        </div>
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
  const [phase, setPhase] = useState<"select" | "idle" | "tear" | "fly" | "revealing" | "done">(urlType ? "idle" : "select");
  const [items, setItems] = useState<any[]>([]);
  const [flipped, setFlipped] = useState<boolean[]>([]);
  const [hasLegacy, setHasLegacy] = useState(false);
  const [flyIn, setFlyIn] = useState(false);

  const { data: profile, refetch: refetchProfile } = trpc.game.getProfile.useQuery(undefined, { enabled: isAuthenticated });
  const coins = profile?.user?.coins ?? 0;
  const pack = PACKS.find(p => p.id === selectedId);

  const openPack = trpc.game.openPack.useMutation({
    onSuccess: (data) => {
      const newItems = (data.items || []).filter(Boolean);
      setItems(newItems);
      setFlipped(new Array(newItems.length).fill(false));
      setHasLegacy(newItems.some((i: any) => i?.template?.grade === "Legacy"));
      refetchProfile();
      // Cards fly in one by one after tear
      setTimeout(() => {
        setPhase("fly");
        setFlyIn(true);
      }, 200);
    },
    onError: (err) => { toast.error("Помилка", err.message); setPhase("idle"); },
  });

  // After fly-in, flip cards one by one
  useEffect(() => {
    if (phase !== "revealing") return;
    const flip = (idx: number) => {
      if (idx >= items.length) return;
      setTimeout(() => {
        setFlipped(prev => { const n = [...prev]; n[idx] = true; return n; });
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.HapticFeedback) {
          const grade = items[idx]?.template?.grade;
          tg.HapticFeedback.impactOccurred(grade === "Legacy" || grade === "Exotic" ? "heavy" : "light");
        }
        if (idx + 1 < items.length) flip(idx + 1);
        else setTimeout(() => setPhase("done"), 600);
      }, idx === 0 ? 200 : 350);
    };
    flip(0);
  }, [phase]);

  const handleOpen = () => {
    if (!pack) return;
    // Double-click guard: prevent if already opening or pending
    if (phase !== "idle" || openPack.isPending) return;
    if (pack.cur === "stars") {
      // Redirect to shop for Stars purchase
      const productId = `pack_${pack.id}`;
      toast.info("Перехід в магазин", `Купи ${pack.name} за Stars`);
      navigate(`/shop`);
      return;
    }
    if (coins < pack.cost) { toast.error("Мало монет", `Потрібно ${pack.cost.toLocaleString()}₵`); return; }
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("heavy");
    setPhase("tear");
    openPack.mutate({ packType: pack.id as any });
  };

  const reset = () => {
    setPhase("select"); setItems([]); setFlipped([]);
    setHasLegacy(false); setSelectedId(null); setFlyIn(false);
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <p className="text-slate-400">Потрібна авторизація</p>
    </div>
  );

  return (
    <div className={`min-h-screen text-white overflow-hidden transition-colors duration-1000 ${hasLegacy && phase === "done" ? "bg-[#1a1100]" : "bg-[#0a0a0f]"}`}>

      {/* Legacy burst */}
      {hasLegacy && phase === "done" && (
        <div className="fixed inset-0 pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="absolute animate-ping rounded-full"
              style={{
                width: Math.random() * 6 + 2, height: Math.random() * 6 + 2,
                left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                background: "#f59e0b", opacity: Math.random() * 0.6 + 0.2,
                animationDelay: `${Math.random() * 3}s`, animationDuration: `${1 + Math.random()}s`,
              }} />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3 relative z-10">
        <Button variant="ghost" size="icon"
          onClick={() => {
            // Smart navigation: if user came directly with type in URL, go home
            // Otherwise go back to pack selector
            if (phase === "select") return navigate("/");
            if (phase === "done") return navigate("/");
            if (urlType && phase === "idle") return navigate("/");
            // From idle without urlType — back to select
            // From tear/fly/revealing — reset to clean state (don't lose pack)
            reset();
          }}
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
        <div className="px-4 pb-8 overflow-y-auto" style={{ maxHeight: "calc(100vh - 80px)" }}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">⚡ За монети</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {PACKS.filter(p => p.cur === "coins").map(p => {
              const can = coins >= p.cost;
              return (
                <div key={p.id} className="relative">
                  {!can && <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center rounded-2xl"><Lock className="w-5 h-5 text-slate-400" /></div>}
                  <button onClick={() => { if (!can) { toast.error("Мало монет", `Потрібно ${p.cost.toLocaleString()}₵`); return; } setSelectedId(p.id); setPhase("idle"); }}
                    className="w-full active:scale-95 transition-transform">
                    <div className="rounded-2xl overflow-hidden border border-white/10">
                      <PackCanvas pack={p} torn={false} />
                    </div>
                    <div className="bg-[#12121a] rounded-b-2xl px-2 pb-2 mt-[-8px] pt-2 border-x border-b border-[#1e1e2e]">
                      <div className="flex flex-wrap gap-1 mb-1">
                        {p.id !== "starter" && p.id !== "flowers" && p.id !== "planets" && (
                          <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-bold">R+</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-yellow-400" />
                        <span className={`font-bold text-xs ${can ? "text-yellow-400" : "text-slate-500"}`}>{p.cost.toLocaleString()}</span>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">⭐ VIP Stars</p>
          <div className="space-y-2">
            {PACKS.filter(p => p.cur === "stars").map(p => (
              <button key={p.id} onClick={() => navigate("/shop")}
                className="w-full bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-3 flex items-center gap-3 hover:border-amber-500/30 active:scale-95 transition-all opacity-80">
                <span className="text-2xl">{p.pattern}</span>
                <div className="flex-1"><p className="text-white font-bold text-sm">{p.name}</p></div>
                <div className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                  <Star className="w-3.5 h-3.5" />{p.cost}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── IDLE (pack preview) ── */}
      {phase === "idle" && pack && (
        <div className="flex flex-col items-center justify-center px-4 relative z-10" style={{ minHeight: "80vh" }}>
          {/* Pack stack */}
          <div className="relative mb-8" onClick={handleOpen} style={{ cursor: "pointer" }}>
            <div className="absolute" style={{ transform: "rotate(4deg) translateY(8px) translateX(6px)", opacity: 0.45 }}>
              <PackCanvas pack={pack} torn={false} />
            </div>
            <div className="absolute" style={{ transform: "rotate(-3deg) translateY(4px) translateX(-4px)", opacity: 0.65 }}>
              <PackCanvas pack={pack} torn={false} />
            </div>
            <div className="relative hover:scale-105 transition-transform active:scale-95">
              <PackCanvas pack={pack} torn={false} />
              <div className="absolute -top-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center font-bold text-base shadow-lg z-10"
                style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "#000" }}>
                {pack.items}
              </div>
            </div>
          </div>
          <p className="text-slate-400 text-sm animate-pulse mb-6">Натисни на пак щоб відкрити</p>
          <div className="flex gap-3 w-full max-w-xs">
            <Button variant="outline" onClick={reset} className="flex-1 border-[#2a2a3e] text-slate-400 rounded-2xl">← Назад</Button>
            <Button onClick={handleOpen}
              disabled={openPack.isPending || phase !== "idle"}
              className="flex-1 h-12 font-bold text-white rounded-2xl hover:opacity-90 disabled:opacity-50 disabled:cursor-wait"
              style={{ background: `linear-gradient(135deg, ${pack.gradient[0]}, ${pack.gradient[pack.gradient.length - 1]})` }}>
              {openPack.isPending ? "Відкривається..." : "Відкрити!"}
            </Button>
          </div>
        </div>
      )}

      {/* ── TEAR ANIMATION ── */}
      {phase === "tear" && pack && (
        <div className="flex flex-col items-center justify-center" style={{ minHeight: "80vh" }}>
          <TearAnimation pack={pack} onDone={() => {
            if (items.length > 0) setPhase("fly");
          }} />
          {items.length === 0 && <p className="text-purple-400 animate-pulse font-semibold mt-4">Генерація карток...</p>}
        </div>
      )}

      {/* ── FLY IN + REVEAL ── */}
      {(phase === "fly" || phase === "revealing" || phase === "done") && items.length > 0 && (
        <div className="flex flex-col items-center justify-center px-4 relative z-10" style={{ minHeight: "80vh" }}>
          {hasLegacy && phase === "done" && (
            <div className="text-center mb-4">
              <p className="text-amber-400 font-bold text-2xl animate-bounce">👑 LEGACY DROP! 👑</p>
            </div>
          )}

          {/* Cards */}
          <div className={`grid gap-2.5 w-full max-w-sm mb-6 ${
            items.length === 1 ? "grid-cols-1 max-w-[160px]" :
            items.length <= 3 ? "grid-cols-3" :
            items.length === 4 ? "grid-cols-4" : "grid-cols-5"
          }`}>
            {items.map((item, i) => (
              <div key={item?.id ?? i}
                className="transition-all duration-500"
                style={{
                  opacity: flyIn ? 1 : 0,
                  transform: flyIn ? "translateY(0) scale(1)" : "translateY(60px) scale(0.7)",
                  transitionDelay: `${i * 80}ms`,
                }}>
                <FlipCard
                  item={item}
                  pack={pack!}
                  flipped={flipped[i] ?? false}
                  delay={0}
                  isNew={true}
                />
              </div>
            ))}
          </div>

          {/* Flip all button (before done) */}
          {phase === "fly" && (
            <Button onClick={() => setPhase("revealing")}
              className="w-full max-w-sm h-12 font-bold text-white rounded-2xl mb-3"
              style={{ background: `linear-gradient(135deg, ${pack?.gradient[0]}, ${pack?.gradient[pack.gradient.length - 1]})` }}>
              ✨ Відкрити картки!
            </Button>
          )}

          {/* Results */}
          {phase === "done" && (
            <div className="w-full max-w-sm space-y-3">
              <Card className="bg-[#12121a] border-[#1e1e2e] rounded-2xl p-3 text-center">
                <p className="text-xs text-slate-400">Загальна вартість</p>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 font-bold text-2xl">
                    {items.reduce((s, i) => s + (i?.marketPrice ?? 0), 0).toLocaleString()}
                  </span>
                  <span className="text-yellow-600 text-sm">₵</span>
                </div>
              </Card>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => navigate("/inventory")} className="border-[#2a2a3e] text-slate-300 rounded-2xl">📦 Інвентар</Button>
                <Button onClick={reset} className="text-white font-bold rounded-2xl hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${pack?.gradient[0]}, ${pack?.gradient[pack!.gradient.length - 1]})` }}>
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
