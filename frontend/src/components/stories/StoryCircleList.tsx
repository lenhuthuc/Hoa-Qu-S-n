"use client";

import { motion } from "framer-motion";

export interface StoryCircleSeller {
  sellerId: number;
  sellerName: string;
  shopName?: string;
  avatar?: string | null;
  storiesCount: number;
  hasUnseen: boolean;
}

interface StoryCircleListProps {
  sellers: StoryCircleSeller[];
  onOpenSellerStories: (sellerId: number) => void;
}

export default function StoryCircleList({ sellers, onOpenSellerStories }: StoryCircleListProps) {
  if (!sellers.length) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4 text-sm text-slate-500">
        Chưa có nhật ký nào trong 24 giờ qua.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-4">
        {sellers.map((seller, index) => (
          <motion.button
            key={seller.sellerId}
            type="button"
            onClick={() => onOpenSellerStories(seller.sellerId)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="group flex w-[84px] flex-col items-center gap-2"
          >
            <div
              className={[
                "relative rounded-full p-[3px] transition-transform group-hover:scale-[1.03]",
                seller.hasUnseen
                  ? "bg-gradient-to-tr from-emerald-500 via-lime-500 to-teal-400"
                  : "bg-slate-300",
              ].join(" ")}
            >
              <div className="h-16 w-16 overflow-hidden rounded-full bg-white p-[2px]">
                <div className="h-full w-full overflow-hidden rounded-full bg-emerald-50">
                  {seller.avatar ? (
                    <img
                      src={seller.avatar}
                      alt={seller.shopName || seller.sellerName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl">🌿</div>
                  )}
                </div>
              </div>
            </div>
            <div className="w-full text-center">
              <p className="line-clamp-2 text-xs font-semibold text-slate-700">
                {seller.shopName || seller.sellerName}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">{seller.storiesCount} nhật ký</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
