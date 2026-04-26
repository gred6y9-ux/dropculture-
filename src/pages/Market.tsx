import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { ArrowLeft, TrendingUp, Sparkles } from "lucide-react";

const GRADE_COLORS: Record<string, string> = {
  Stock: "from-gray-600 to-gray-700 border-gray-500",
  Refined: "from-blue-600 to-blue-800 border-blue-500",
  Rare: "from-purple-600 to-purple-800 border-purple-500",
  Exotic: "from-pink-600 to-pink-800 border-pink-500",
  Legacy: "from-amber-500 to-amber-700 border-amber-400",
};

export default function Market() {
  const { isAuthenticated, user } = useTelegramAuth();
  const navigate = useNavigate();

  const { data: listings, isLoading } = trpc.market.getListings.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-20">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-semibold text-lg">Маркетплейс</h1>
        <span className="text-sm text-slate-400 ml-auto">
          {user?.coins?.toLocaleString() ?? 0} coins
        </span>
      </div>

      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <h2 className="font-semibold">Активні лоти</h2>
        </div>
      </div>

      <div className="px-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400">Завантаження...</p>
          </div>
        ) : listings && listings.length > 0 ? (
          <div className="space-y-3">
            {listings.map((listing: any) => {
              const grade = listing.item?.template?.grade || "Stock";
              const colors = GRADE_COLORS[grade] || GRADE_COLORS.Stock;

              return (
                <Card
                  key={listing.id}
                  className={`bg-gradient-to-r ${colors} border p-4`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{listing.item?.template?.name}</p>
                        <p className="text-xs text-white/70">
                          {grade} · Float: {listing.item?.floatVal?.toFixed(2)} · #{listing.item?.serialNum}
                        </p>
                        <p className="text-xs text-white/50">
                          Продавець: @{listing.seller?.username ?? "unknown"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-yellow-400">{listing.price.toLocaleString()}</p>
                      <p className="text-xs text-white/60">{listing.currency}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400 mb-3">Наразі немає активних лотів</p>
            <p className="text-sm text-slate-500">Станьте першим продавцем!</p>
          </div>
        )}
      </div>
    </div>
  );
}
