import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

interface CardNavItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
}

interface CardNavProps {
  items: CardNavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  basePath?: string;
}

export function CardNav({ items, activeId, onSelect, basePath }: CardNavProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => {
        const Icon = item.icon;
        const isActive = activeId === item.id;
        const href = item.href || (basePath ? `${basePath}/${item.id}` : null);
        const isLink = !!href;

        const content = (
          <>
            <div className="relative flex items-start gap-3">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl ${
                  isActive ? "bg-white/16 text-white" : "bg-primary/20 text-primary"
                }`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold tracking-tight card-nav-text">{item.title}</p>
                <p
                  className={`mt-1 text-xs leading-5 ${
                    isActive ? "text-white/90 card-nav-text" : "text-muted-foreground"
                  }`}
                >
                  {item.description}
                </p>
              </div>
            </div>
          </>
        );

        const commonClasses = `group relative overflow-hidden rounded-[28px] border px-6 py-6 text-left transition-all card-nav-text block w-full ${
          isActive
            ? "border-primary/70 bg-primary/90 shadow-[0_24px_60px_rgba(0,165,80,0.32)]"
            : "border-border/70 bg-card/80 shadow-[0_14px_34px_rgba(15,23,42,0.08)] hover:border-primary/60 hover:bg-card"
        }`;

        const gradient = (
          <div
            className={`absolute inset-0 opacity-75 transition-opacity ${
              isActive
                ? "bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_45%)]"
                : "bg-[radial-gradient(circle_at_top_right,rgba(0,165,80,0.16),transparent_40%)] group-hover:opacity-100"
            }`}
          />
        );

        return isLink ? (
          <Link href={href!} className={commonClasses} key={item.id}>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.06 }}
              whileHover={{ y: -6, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {gradient}
              {content}
            </motion.div>
          </Link>
        ) : (
          <motion.button
            key={item.id}
            type="button"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.06 }}
            whileHover={{ y: -6, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onSelect?.(item.id!)}
            className={commonClasses}
          >
            {gradient}
            {content}
          </motion.button>
        );
      })}
    </div>
  );
}
