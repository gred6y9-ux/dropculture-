import { useRef, useState, useEffect } from "react";

const SECTORS = [
  { label: "50 ₵",    color: "#6366f1", weight: 35 },
  { label: "Stock 🎁", color: "#475569", weight: 8  },
  { label: "100 ₵",   color: "#8b5cf6", weight: 25 },
  { label: "Refined!", color: "#3b82f6", weight: 5  },
  { label: "250 ₵",   color: "#a855f7", weight: 15 },
  { label: "Stock 🎁", color: "#475569", weight: 8  },
  { label: "500 ₵",   color: "#d946ef", weight: 10 },
  { label: "1000 🎰", color: "#f59e0b", weight: 1.5 },
  { label: "250 ₵",   color: "#a855f7", weight: 15 },
  { label: "Rare 🟣", color: "#7c3aed", weight: 0.5 },
  { label: "100 ₵",   color: "#8b5cf6", weight: 25 },
  { label: "50 ₵",    color: "#6366f1", weight: 35  },
];

const TOTAL = SECTORS.reduce((s, x) => s + x.weight, 0);

function drawWheel(canvas: HTMLCanvasElement, rotation: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const r = Math.min(cx, cy) - 4;

  ctx.clearRect(0, 0, W, H);

  let startAngle = rotation;
  for (const sector of SECTORS) {
    const angle = (sector.weight / TOTAL) * Math.PI * 2;
    const endAngle = startAngle + angle;

    // Sector
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = sector.color;
    ctx.fill();
    ctx.strokeStyle = "#0a0a0f";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    const mid = startAngle + angle / 2;
    const tx = cx + (r * 0.65) * Math.cos(mid);
    const ty = cy + (r * 0.65) * Math.sin(mid);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(mid + Math.PI / 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${W < 300 ? 9 : 11}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText(sector.label, 0, 0);
    ctx.restore();

    startAngle = endAngle;
  }

  // Center circle
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = "#0a0a0f";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#ffffff22";
  ctx.lineWidth = 3;
  ctx.stroke();
}

interface Props {
  isSpinning: boolean;
  onSpinEnd: (sectorIndex: number) => void;
  disabled?: boolean;
}

export function SpinWheel({ isSpinning, onSpinEnd, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const animRef = useRef<number>();
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    drawWheel(canvasRef.current, rotRef.current);
  }, []);

  useEffect(() => {
    if (isSpinning && !spinning) {
      startSpin();
    }
  }, [isSpinning]);

  function startSpin() {
    if (spinning) return;
    setSpinning(true);

    const totalRotation = Math.PI * 2 * (6 + Math.random() * 4); // 6-10 full turns
    const duration = 4000 + Math.random() * 1000;
    const start = Date.now();
    const startRot = rotRef.current;

    function easeOut(t: number) {
      return 1 - Math.pow(1 - t, 3);
    }

    function animate() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const currentRotation = startRot + totalRotation * easeOut(progress);
      rotRef.current = currentRotation;

      if (canvasRef.current) drawWheel(canvasRef.current, currentRotation);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        // Determine which sector landed
        const finalAngle = ((currentRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        // Pointer is at top (270deg = 3*PI/2), arrow points to top = -PI/2
        const pointerAngle = (Math.PI * 2 - finalAngle + Math.PI * 2 * 1.5) % (Math.PI * 2);
        let cumulative = 0;
        let idx = 0;
        for (let i = 0; i < SECTORS.length; i++) {
          cumulative += (SECTORS[i].weight / TOTAL) * Math.PI * 2;
          if (pointerAngle < cumulative) { idx = i; break; }
        }
        onSpinEnd(idx);
      }
    }

    animRef.current = requestAnimationFrame(animate);
  }

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  return (
    <div className="relative flex flex-col items-center">
      {/* Arrow pointer at top */}
      <div className="w-0 h-0 z-10 mb-[-8px]"
        style={{ borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "20px solid #f59e0b" }} />
      <div className="relative">
        <canvas ref={canvasRef} width={280} height={280} className="rounded-full" />
        {spinning && (
          <div className="absolute inset-0 rounded-full border-4 border-amber-400/50 animate-ping" />
        )}
      </div>
    </div>
  );
}
