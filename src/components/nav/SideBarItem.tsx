"use client";

import { motion } from "framer-motion";
import { cn } from "~/lib/utils";

type SideBarItemProps = {
  label: string;
  href: string;
  index: number;
  selectedLabel: string;
  onClick: () => void;
};

export const SideBarItem = ({
  label,
  href,
  index,
  selectedLabel,
  onClick,
}: SideBarItemProps) => {
  return (
    <motion.a
      initial={{ x: -70 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      href={href}
      onClick={onClick}
      className={cn(
        "flex w-full flex-shrink-0 items-center justify-center border-r-2 border-transparent text-lg font-light opacity-50 transition-all duration-500 [writing-mode:vertical-lr]",
        selectedLabel === label
          ? "border-brand bg-background opacity-100"
          : ""
        ,
        label === "Home" ? "h-20" : "h-24")}
    >
      {label === "Home" ? (
        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-background text-2xl font-semibold text-white [writing-mode:horizontal-tb]">
          W<span className="text-brand">.</span>
        </span>
      ) : (
        label
      )}
    </motion.a>
  );
};