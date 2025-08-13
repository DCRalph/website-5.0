"use client";
import { Reveal } from "./Reveal";

interface Props {
  title: string;
  dir?: "l" | "r";
}

export const SectionHeader = ({ title, dir = "r" }: Props) => {
  return (
    <div
      className={"flex items-center gap-8 mb-8"}
      style={{ flexDirection: dir === "r" ? "row" : "row-reverse" }}
    >
      <div className={"w-full opacity-5 h-2 rounded-full bg-text"} />
      <h3>
        <Reveal>
          <span className={"text-4xl md:text-5xl font-bold"}>
            {title}
            <span className="text-brand">.</span>
          </span>
        </Reveal>
      </h3>
    </div>
  );
};
