import { useState, useRef, useEffect } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { ArrowLeft, Zap, Star, Clock } from "lucide-react";
import { toast } from "@/components/Toast";

const FREE_SECTORS = [
  { label: "50",      emoji: "💰", color: "#312e81", weight: 35 },
  { label: "100",     emoji: "💰", color: "#4c1d95", weight: 25 },
  { label: "250",     emoji: "💰", color: "#6b21a8", weight: 15 },
  { label: "500",     emoji: "💰", color: "#7e22ce", weight: 10 },
  { label: "Stock",   emoji: "⚫", color: "#1e293b", weight: 8  },
  { label: "Refined", emoji: "🔵", color: "#1e3a5f", weight: 5  },
  { label: "1000",    emoji: "🎰", color: "#78350f", weight: 1.5 },
  { label: "Rare",    emoji: "🟣", color: "#3b0764", weight: 0.5 },
];

const VIP_SECTORS = [
  { label: "500",     emoji: "💰", color: "#064e3b", weight: 20 },
  { label: "Rare",    emoji: "🟣", color: "#3b0764", weight: 20 },
  { label: "1000",    emoji: "💰", color: "#78350f", weight: 15 },
  { label: "Exotic",  emoji: "🌸", color: "#831843", weight: 15 },
  { label: "2000",    emoji: "🎰", color: "#92400e", weight: 10 },
  { label: "Refined", emoji: "🔵", color: "#1e3a5f", weight: 10 },
  { label: "5⭐",     emoji: "⭐", color: "#7c2d12", weight: 8  },
  { label: "Legacy",  emoji: "👑", color: "#713f12", weight: 2  },
];

type Sector = { label: string; emoji: string; color: string; weight: number };

function WheelCanvas({ sectors, spinning, onEnd }: { sectors: Sector[]; spinning: boolean; onEnd: (idx: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const animRef = useRef<number>();
  const activeRef = useRef(false);

  const draw = (rot: number) => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const S = c.width;
    const cx = S / 2, cy = S / 2, R = S / 2 - 8;
    const total = sectors.reduce((s, x) => s + x.weight, 0);

    ctx.clearRect(0, 0, S, S);

    // Outer glow
    const glow = ctx.createRadialGradient(cx, cy, R - 4, cx, cy, R + 8);
    glow.addColorStop(0, "rgba(139,92,246,0.3)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, R + 10, 0, Math.PI * 2); ctx.fill();

    // Sectors
    let angle = rot - Math.PI / 2;
    sectors.forEach((s) => {
      const span = (s.weight / total) * Math.PI * 2;
      // Fill
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, angle, angle + span);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      // Divider
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Skip text if sector too thin (< 8 degrees)
      if (span < 0.14) {
        angle += span;
        return;
      }

      // Text along radius — reads from center outward
      const mid = angle + span / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(mid);
      // Now x-axis points outward from center along sector mid

      // Determine if sector is on the right half (text reads left-to-right)
      // or left half (need to flip 180° so it doesn't read upside down)
      const normalizedMid = ((mid % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const flipped = normalizedMid > Math.PI / 2 && normalizedMid < Math.PI * 1.5;

      if (flipped) {
        ctx.rotate(Math.PI);
        // Position from inside-out (because flipped)
        ctx.textAlign = "left";
      } else {
        ctx.textAlign = "right";
      }

      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 5;

      // Emoji + label on same line, near outer edge
      const textX = flipped ? -R * 0.85 : R * 0.85;
      ctx.font = "bold 11px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${s.emoji} ${s.label}`, textX, 0);

      ctx.restore();
      angle += span;
    });

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Gold rim
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(251,191,36,0.4)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner hub
    const hub = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.12);
    hub.addColorStop(0, "#ffffff");
    hub.addColorStop(0.6, "#e5e7eb");
    hub.addColorStop(1, "#9ca3af");
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = hub;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  useEffect(() => { draw(rotRef.current); }, [sectors]);

  useEffect(() => {
    if (!spinning || activeRef.current) return;
    activeRef.current = true;
    const total = Math.PI * 2 * (7 + Math.random() * 5);
    const dur = 4500 + Math.random() * 800;
    const t0 = Date.now();
    const r0 = rotRef.current;

    const go = () => {
      const p = Math.min((Date.now() - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      rotRef.current = r0 + total * ease;
      draw(rotRef.current);
      if (p < 1) { animRef.current = requestAnimationFrame(go); }
      else {
        activeRef.current = false;
        const sectorTotal = sectors.reduce((s, x) => s + x.weight, 0);
        const finalRot = ((rotRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        let cum = 0, idx = 0;
        for (let i = 0; i < sectors.length; i++) {
          cum += (sectors[i].weight / sectorTotal) * Math.PI * 2;
          if (finalRot < cum) { idx = i; break; }
        }
        onEnd(idx);
      }
    };
    animRef.current = requestAnimationFrame(go);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [spinning]);

  return (
    <div className="relative inline-flex flex-col items-center">
      {/* Arrow pointer */}
      <div className="relative z-10 mb-[-2px]">
        <div style={{
          width: 0, height: 0,
          borderLeft: "13px solid transparent",
          borderRight: "13px solid transparent",
          borderTop: "26px solid #f59e0b",
          filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.6))",
        }} />
        <div style={{
          width: 0, height: 0,
          position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)",
          borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent",
          borderTop: "22px solid #fbbf24",
        }} />
      </div>
      <canvas ref={ref} width={300} height={300} className="rounded-full" />
      {spinning && <div className="absolute inset-0 rounded-full border-4 border-amber-400/30 animate-pulse" style={{ margin: -4 }} />}
    </div>
  );
}

export default function WheelPage() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"free" | "vip">("free");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ label: string; emoji: string } | null>(null);

  const { data: wheelStatus, isLoading: wheelLoading, refetch: refetchWheel } = trpc.wheel.status.useQuery(undefined, { enabled: isAuthenticated });
  const { data: profile, refetch: refetchProfile } = trpc.game.getProfile.useQuery(undefined, { enabled: isAuthenticated });

  const spinMut = trpc.wheel.spin.useMutation({
    onSuccess: (data) => { setResult({ label: data.rewardDescription, emoji: "🎉" }); refetchWheel(); refetchProfile(); },
    onError: (err) => { setSpinning(false); toast.error("Помилка", err.message); },
  });

  const handleSpin = () => {
    const isVip = tab === "vip";
    if (isVip && (profile?.user?.stars ?? 0) < 10) {
      toast.error("Мало Stars", "Купи Stars в магазині (10⭐ за спін)");
      navigate("/shop");
      return;
    }
    if (!isVip && (!wheelStatus?.canSpin)) return;
    if (spinning || spinMut.isPending) return;
    setSpinning(true);
    setResult(null);
    spinMut.mutate({ isVip });
  };

  const handleEnd = () => setSpinning(false);
  const sectors = tab === "vip" ? VIP_SECTORS : FREE_SECTORS;
  const canSpin = tab === "free" && (wheelStatus?.canSpin ?? false);

  // Loading state — prevent crash when wheelStatus is undefined
  if (wheelLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-slate-400 text-sm">Завантаження колеса...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-8">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-base">Колесо фортуни</h1>
          <p className="text-xs text-slate-500">Безкоштовне раз на 12 год</p>
        </div>
        <div className="flex items-center gap-1.5 bg-[#1a1a28] rounded-xl px-3 py-1.5">
          <Zap className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-yellow-400 font-bold text-sm">{(profile?.user?.coins ?? 0).toLocaleString()}</span>
        </div>
      </div>

      <div className="px-4">
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab("free")}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all ${tab === "free" ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" : "bg-[#12121a] text-slate-400"}`}>
            🎡 Безкоштовне
          </button>
          <button onClick={() => setTab("vip")}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all relative ${tab === "vip" ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-black" : "bg-[#12121a] text-slate-400"}`}>
            👑 VIP Stars
          </button>
        </div>

        {tab === "vip" && (
          <Card className="bg-gradient-to-r from-amber-900/40 to-yellow-900/40 border border-amber-500/30 rounded-2xl p-3 mb-4 flex items-center gap-3">
            <Star className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-white font-bold text-sm">VIP колесо · 10 Stars за спін</p>
              <p className="text-xs text-slate-400">Тільки Rare+ · Більші монети · Legacy шанс</p>
            </div>
          </Card>
        )}

        {tab === "free" && !wheelStatus?.canSpin && (
          <Card className="bg-[#1a1a28] border-[#2a2a3e] rounded-2xl p-3 mb-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-white font-bold text-sm">Наступне кручення</p>
              <p className="text-slate-400 text-xs">через {wheelStatus?.hoursRemaining ?? "..."} годин</p>
            </div>
          </Card>
        )}

        {result && !spinning && (
          <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-500/30 rounded-2xl p-3 mb-4 text-center">
            <p className="text-2xl mb-1">{result.emoji}</p>
            <p className="text-green-400 font-bold text-lg">{result.label}</p>
          </div>
        )}

        <div className="flex justify-center mb-4">
          <WheelCanvas sectors={sectors} spinning={spinning} onEnd={handleEnd} />
        </div>

        <Button onClick={handleSpin} disabled={spinning || (!canSpin && tab === "free")}
          className={`w-full h-14 text-base font-bold rounded-2xl mb-6 ${
            spinning ? "bg-purple-900 text-purple-300 cursor-wait" :
            tab === "vip" ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:opacity-90" :
            canSpin ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 shadow-lg shadow-purple-500/20" :
            "bg-[#1a1a28] text-slate-500 cursor-not-allowed"
          }`}>
          {spinning ? "🎡 Крутиться..." :
           tab === "vip" ? `⭐ 10 Stars — Крутити VIP` :
           canSpin ? "🎡 Крутити!" :
           `⏱ Через ${wheelStatus?.hoursRemaining ?? "..."}г`}
        </Button>

        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Можливі нагороди</p>
        <div className="grid grid-cols-2 gap-1.5">
          {sectors.map((s, i) => (
            <div key={i} className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-2.5 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                style={{ background: s.color }}>
                {s.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-semibold">
                  {s.label === "Stock" || s.label === "Refined" || s.label === "Rare" || s.label === "Exotic" || s.label === "Legacy"
                    ? s.label : s.label.includes("⭐") ? s.label : `${s.label} монет`}
                </p>
                <p className="text-[9px] text-slate-500">{s.weight}% шанс</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
