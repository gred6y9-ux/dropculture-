import { useState, useRef, useEffect } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { ArrowLeft, Zap, Star, Clock } from "lucide-react";
import { toast } from "@/components/Toast";

// ─── FREE WHEEL ──────────────────────────────────────────────────
const FREE_SECTORS = [
  { label: "50₵",     color: "#4f46e5", textColor: "#c7d2fe", weight: 35 },
  { label: "Stock 🎁", color: "#334155", textColor: "#cbd5e1", weight: 8  },
  { label: "100₵",    color: "#7c3aed", textColor: "#ddd6fe", weight: 25 },
  { label: "Refined ✨", color: "#1d4ed8", textColor: "#bfdbfe", weight: 5 },
  { label: "250₵",    color: "#6d28d9", textColor: "#ede9fe", weight: 15 },
  { label: "Stock 🎁", color: "#334155", textColor: "#cbd5e1", weight: 5  },
  { label: "500₵",    color: "#9333ea", textColor: "#f3e8ff", weight: 5  },
  { label: "1000₵ 🎰", color: "#b45309", textColor: "#fde68a", weight: 1.5 },
  { label: "250₵",    color: "#6d28d9", textColor: "#ede9fe", weight: 10 },
  { label: "Rare 🟣",  color: "#5b21b6", textColor: "#e9d5ff", weight: 0.5 },
];

// ─── VIP WHEEL ───────────────────────────────────────────────────
const VIP_SECTORS = [
  { label: "500₵",       color: "#0f766e", textColor: "#99f6e4", weight: 20 },
  { label: "Rare 🟣",    color: "#5b21b6", textColor: "#e9d5ff", weight: 20 },
  { label: "1000₵",      color: "#b45309", textColor: "#fde68a", weight: 15 },
  { label: "Exotic 🌸",  color: "#9d174d", textColor: "#fbcfe8", weight: 15 },
  { label: "2000₵ 🎰",   color: "#92400e", textColor: "#fef08a", weight: 10 },
  { label: "Refined ✨",  color: "#1d4ed8", textColor: "#bfdbfe", weight: 10 },
  { label: "5 Stars ⭐",  color: "#7c2d12", textColor: "#fed7aa", weight: 8  },
  { label: "Legacy 👑",  color: "#713f12", textColor: "#fef9c3", weight: 2  },
];

function drawWheel(canvas: HTMLCanvasElement, sectors: typeof FREE_SECTORS, rotation: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, r = Math.min(cx, cy) - 6;
  const total = sectors.reduce((s, x) => s + x.weight, 0);

  ctx.clearRect(0, 0, W, H);

  // Shadow
  ctx.save();
  ctx.shadowColor = "rgba(139, 92, 246, 0.4)";
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.fillStyle = "transparent";
  ctx.fill();
  ctx.restore();

  let startAngle = rotation - Math.PI / 2;
  for (const s of sectors) {
    const angle = (s.weight / total) * Math.PI * 2;
    const endAngle = startAngle + angle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.strokeStyle = "#0a0a0f";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    const mid = startAngle + angle / 2;
    const tx = cx + (r * 0.66) * Math.cos(mid);
    const ty = cy + (r * 0.66) * Math.sin(mid);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(mid + Math.PI / 2);
    ctx.fillStyle = s.textColor;
    ctx.font = `bold 10px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.label, 0, 0);
    ctx.restore();
    startAngle = endAngle;
  }

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Gold ring
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Center
  const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.13);
  centerGrad.addColorStop(0, "#ffffff");
  centerGrad.addColorStop(1, "#d1d5db");
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = centerGrad;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.13, 0, Math.PI * 2);
  ctx.strokeStyle = "#0a0a0f";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function WheelCanvas({ sectors, isSpinning, onSpinEnd }: { sectors: typeof FREE_SECTORS; isSpinning: boolean; onSpinEnd: (idx: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const animRef = useRef<number>();
  const spinningRef = useRef(false);

  useEffect(() => {
    if (canvasRef.current) drawWheel(canvasRef.current, sectors, rotRef.current);
  }, [sectors]);

  useEffect(() => {
    if (isSpinning && !spinningRef.current) {
      spinningRef.current = true;
      const totalRot = Math.PI * 2 * (7 + Math.random() * 5);
      const duration = 4500 + Math.random() * 1000;
      const start = Date.now();
      const startRot = rotRef.current;

      const animate = () => {
        const elapsed = Date.now() - start;
        const t = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - t, 4);
        rotRef.current = startRot + totalRot * ease;
        if (canvasRef.current) drawWheel(canvasRef.current, sectors, rotRef.current);
        if (t < 1) {
          animRef.current = requestAnimationFrame(animate);
        } else {
          spinningRef.current = false;
          const finalAngle = ((rotRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const total = sectors.reduce((s, x) => s + x.weight, 0);
          let cum = 0, idx = 0;
          for (let i = 0; i < sectors.length; i++) {
            cum += (sectors[i].weight / total) * Math.PI * 2;
            if (finalAngle < cum) { idx = i; break; }
          }
          onSpinEnd(idx);
        }
      };
      animRef.current = requestAnimationFrame(animate);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isSpinning]);

  return (
    <div className="relative flex flex-col items-center">
      {/* Arrow */}
      <div className="relative z-10 mb-1">
        <div className="w-0 h-0" style={{ borderLeft: "12px solid transparent", borderRight: "12px solid transparent", borderTop: "24px solid #f59e0b", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }} />
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={300} height={300} />
        {isSpinning && (
          <div className="absolute inset-[-4px] rounded-full border-2 border-amber-400/60 animate-pulse" />
        )}
      </div>
    </div>
  );
}

export default function WheelPage() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"free" | "vip">("free");
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const { data: wheelStatus, refetch: refetchWheel } = trpc.wheel.status.useQuery(undefined, { enabled: isAuthenticated });
  const { data: profile, refetch: refetchProfile } = trpc.game.getProfile.useQuery(undefined, { enabled: isAuthenticated });

  const spinMutation = trpc.wheel.spin.useMutation({
    onSuccess: (data) => { setResult(data.rewardDescription); refetchWheel(); refetchProfile(); },
    onError: (err) => { setIsSpinning(false); setResult(null); toast.error("Помилка", err.message); },
  });

  const handleSpin = () => {
    if (tab === "vip") { toast.info("Незабаром!", "VIP колесо за Stars в розробці"); return; }
    if (!wheelStatus?.canSpin || isSpinning) return;
    setIsSpinning(true);
    setResult(null);
    spinMutation.mutate();
  };

  const handleSpinEnd = () => { setIsSpinning(false); };

  const canSpin = tab === "vip" ? false : (wheelStatus?.canSpin ?? false);
  const sectors = tab === "vip" ? VIP_SECTORS : FREE_SECTORS;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-8">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-base">Колесо фортуни</h1>
          <p className="text-xs text-slate-500">Раз на 12 годин · безкоштовно</p>
        </div>
        <div className="flex items-center gap-1.5 bg-[#1a1a28] rounded-xl px-3 py-1.5">
          <Zap className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-yellow-400 font-bold text-sm">{(profile?.user?.coins ?? 0).toLocaleString()}</span>
        </div>
      </div>

      <div className="px-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab("free")}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all ${tab === "free" ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
            🎡 Безкоштовне
          </button>
          <button onClick={() => setTab("vip")}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all relative ${tab === "vip" ? "bg-amber-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
            👑 VIP
            <span className="absolute -top-1.5 -right-1 bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">STARS</span>
          </button>
        </div>

        {/* VIP notice */}
        {tab === "vip" && (
          <Card className="bg-gradient-to-r from-amber-900/40 to-yellow-900/40 border border-amber-500/30 rounded-2xl p-3 mb-4 flex items-center gap-3">
            <Star className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-white font-bold text-sm">VIP колесо · 10 Stars за кручення</p>
              <p className="text-xs text-slate-400">Тільки Rare+ нагороди та більші монети</p>
            </div>
          </Card>
        )}

        {/* Cooldown notice */}
        {tab === "free" && !wheelStatus?.canSpin && (
          <Card className="bg-[#1a1a28] border-[#2a2a3e] rounded-2xl p-3 mb-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-purple-400 flex-shrink-0" />
            <div>
              <p className="text-white font-bold text-sm">Наступне кручення</p>
              <p className="text-slate-400 text-xs">через {wheelStatus?.hoursRemaining ?? "..."} годин</p>
            </div>
          </Card>
        )}

        {/* Result */}
        {result && (
          <div className="bg-green-900/40 border border-green-500/30 rounded-2xl p-3 mb-4 text-center">
            <p className="text-2xl mb-1">🎉</p>
            <p className="text-green-400 font-bold">{result}</p>
          </div>
        )}

        {/* Wheel */}
        <div className="flex justify-center my-4">
          <WheelCanvas key={tab} sectors={sectors} isSpinning={isSpinning} onSpinEnd={handleSpinEnd} />
        </div>

        {/* Spin button */}
        <Button onClick={handleSpin} disabled={isSpinning || (!canSpin && tab === "free")}
          className={`w-full h-14 text-base font-bold rounded-2xl mb-4 transition-all ${
            isSpinning ? "bg-purple-800 text-purple-300" :
            tab === "vip" ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-black" :
            canSpin ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 shadow-lg shadow-purple-500/20" :
            "bg-[#1a1a28] text-slate-500 cursor-not-allowed"
          }`}>
          {isSpinning ? "🎡 Крутиться..." :
           tab === "vip" ? "⭐ 10 Stars — Незабаром" :
           canSpin ? "🎡 Крутити!" :
           `⏱ Через ${wheelStatus?.hoursRemaining ?? "..."} год`}
        </Button>

        {/* Prizes */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Можливі нагороди</p>
          <div className="grid grid-cols-2 gap-1.5">
            {sectors.map((s, i) => (
              <div key={i} className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-2 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <p className="text-xs text-white font-semibold flex-1 truncate">{s.label}</p>
                <p className="text-[9px] text-slate-500">{s.weight}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
