import { useState } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { ArrowLeft, Filter, Sparkles } from "lucide-react";

const GRADE_COLORS: Record<string, string> = {
  Stock: "from-gray-600 to-gray-700 border-gray-500",
  Refined: "from-blue-600 to-blue-800 border-blue-500",
  Rare: "from-purple-600 to-purple-800 border-purple-500",
  Exotic: "from-pink-600 to-pink-800 border-pink-500",
  Legacy: "from-amber-500 to-amber-700 border-amber-400",
};

const GRADE_TEXT: Record<string, string> = {
  Stock: "text-gray-300",
  Refined: "text-blue-300",
  Rare: "text-purple-300",
  Exotic: "text-pink-300",
  Legacy: "text-amber-300",
};

export default function Inventory() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string | null>(null);

  const { data: items, isLoading } = trpc.game.getInventory.useQuery({}, {
    enabled: isAuthenticated,
    retry: false,
  });

  const filteredItems = filter
    ? items?.filter((item) => item.template?.grade === filter)
    : items;

  const gradeCounts = items?.reduce((acc, item) => {
    const grade = item.template?.grade || "Stock";
    acc[grade] = (acc[grade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-20">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-semibold text-lg">Інвентар</h1>
        <span className="text-sm text-slate-400 ml-auto">{items?.length ?? 0} шт</span>
      </div>

      {/* Filters */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Button
            size="sm"
            variant={filter === null ? "default" : "outline"}
            onClick={() => setFilter(null)}
            className={filter === null ? "bg-purple-600 text-white" : "border-[#2a2a3e] text-slate-400"}
          >
            <Filter className="w-3 h-3 mr-1" />
            Всі
          </Button>
          {["Stock", "Refined", "Rare", "Exotic", "Legacy"].map((grade) => (
            <Button
              key={grade}
              size="sm"
              variant={filter === grade ? "default" : "outline"}
              onClick={() => setFilter(filter === grade ? null : grade)}
              className={filter === grade ? "bg-purple-600 text-white" : "border-[#2a2a3e] text-slate-400"}
            >
              {grade} ({gradeCounts?.[grade] ?? 0})
            </Button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      <div className="px-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400">Завантаження...</p>
          </div>
        ) : filteredItems && filteredItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map((item) => {
              const grade = item.template?.grade || "Stock";
              const colors = GRADE_COLORS[grade] || GRADE_COLORS.Stock;
              const textColor = GRADE_TEXT[grade] || "text-gray-300";

              return (
                <Card
                  key={item.id}
                  onClick={() => navigate(`/item/${item.id}`)}
                  className={`bg-gradient-to-br ${colors} border p-3 cursor-pointer hover:scale-[1.02] transition-transform`}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-2">
                      <Sparkles className={`w-6 h-6 ${textColor}`} />
                    </div>
                    <p className="text-sm font-semibold text-white truncate w-full">{item.template?.name}</p>
                    <p className={`text-xs ${textColor}`}>{grade}</p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-white/70">
                      <span>Float: {item.floatVal.toFixed(2)}</span>
                      <span className="mx-1">|</span>
                      <span>#{item.serialNum}</span>
                    </div>
                    <p className="text-xs text-yellow-400 mt-1 font-semibold">
                      {item.marketPrice.toLocaleString()} coins
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400 mb-3">Інвентар порожній</p>
            <Button
              onClick={() => navigate("/pack-open")}
              className="bg-gradient-to-r from-purple-500 to-blue-500"
            >
              Відкрити пак
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
