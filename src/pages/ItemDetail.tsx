import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Sparkles, Hash, Gauge, Palette, Tag } from "lucide-react";

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Stock: { bg: "from-gray-700 to-gray-800", text: "text-gray-300", border: "border-gray-600" },
  Refined: { bg: "from-blue-700 to-blue-900", text: "text-blue-300", border: "border-blue-500" },
  Rare: { bg: "from-purple-700 to-purple-900", text: "text-purple-300", border: "border-purple-500" },
  Exotic: { bg: "from-pink-700 to-pink-900", text: "text-pink-300", border: "border-pink-500" },
  Legacy: { bg: "from-amber-600 to-amber-800", text: "text-amber-300", border: "border-amber-500" },
};

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useTelegramAuth();

  const { data: items } = trpc.game.getInventory.useQuery({}, {
    enabled: isAuthenticated,
    retry: false,
  });

  const item = items?.find((i) => i.id === Number(id));

  if (!item) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-slate-400">Предмет не знайдено</p>
      </div>
    );
  }

  const grade = item.template?.grade || "Stock";
  const colors = GRADE_COLORS[grade] || GRADE_COLORS.Stock;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/inventory")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-semibold text-lg">Деталі предмета</h1>
      </div>

      <div className="px-4">
        {/* Item Card */}
        <Card className={`bg-gradient-to-br ${colors.bg} ${colors.border} border-2 p-6 mb-6`}>
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-4 shadow-lg">
              <Sparkles className={`w-12 h-12 ${colors.text}`} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">{item.template?.name}</h2>
            <p className={`text-sm font-semibold ${colors.text}`}>{grade}</p>
            <p className="text-sm text-white/60 mt-2 max-w-xs">{item.template?.description}</p>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="bg-[#12121a] border-[#1e1e2e] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-4 h-4 text-blue-400" />
              <p className="text-xs text-slate-400">Float Value</p>
            </div>
            <p className="text-lg font-bold text-white">{item.floatVal.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-1">
              {item.floatVal <= 0.01 ? "Pristine" :
               item.floatVal <= 0.15 ? "Factory New" :
               item.floatVal <= 0.38 ? "Minimal Wear" :
               item.floatVal <= 0.50 ? "Field-Tested" : "Corrupted"}
            </p>
          </Card>

          <Card className="bg-[#12121a] border-[#1e1e2e] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Hash className="w-4 h-4 text-purple-400" />
              <p className="text-xs text-slate-400">Pattern Seed</p>
            </div>
            <p className="text-lg font-bold text-white">#{item.patternSeed}</p>
            <p className="text-xs text-slate-500 mt-1">Унікальний візерунок</p>
          </Card>

          <Card className="bg-[#12121a] border-[#1e1e2e] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-slate-400">Serial Number</p>
            </div>
            <p className="text-lg font-bold text-white">#{item.serialNum}</p>
            <p className="text-xs text-slate-500 mt-1">
              {[1, 7, 69, 420, 666, 1000].includes(item.serialNum) ? "Special number!" : "Standard"}
            </p>
          </Card>

          <Card className="bg-[#12121a] border-[#1e1e2e] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="w-4 h-4 text-green-400" />
              <p className="text-xs text-slate-400">Market Price</p>
            </div>
            <p className="text-lg font-bold text-yellow-400">{item.marketPrice.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">coins</p>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            onClick={() => {
              // Share functionality
              const tg = (window as any).Telegram?.WebApp;
              if (tg) {
                tg.showPopup({
                  title: "Поділитися",
                  message: `Подивись на мій ${item.template?.name} (${grade})!`,
                  buttons: [{ id: "ok", type: "ok" }],
                });
              }
            }}
          >
            Поділитися
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500"
            onClick={() => navigate("/market")}
          >
            На маркет
          </Button>
        </div>
      </div>
    </div>
  );
}
