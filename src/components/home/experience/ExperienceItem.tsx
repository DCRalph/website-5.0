"use client";
import { Reveal } from "~/components/utils/Reveal";

interface Props {
  title: string;
  position: string;
  time: string;
  location: string;
  description: string;
  tech: string[];
}

export const ExperienceItem = ({
  title,
  position,
  time,
  location,
  description,
  tech,
}: Props) => {
  return (
    <div className={"mb-4 px-4 pb-8 border-b-background-light border-b-2"}>
      <div className={"flex items-center justify-between mb-4"}>
        <Reveal>
          <span className={"font-bold text-2xl"}>{title}</span>
        </Reveal>
        <Reveal>
          <span>{time}</span>
        </Reveal>
      </div>

      <div className={"flex items-center justify-between mb-4"}>
        <Reveal>
          <span className={"font-bold text-xl text-brand"}>{position}</span>
        </Reveal>
        <Reveal>
          <span>{location}</span>
        </Reveal>
      </div>
      <Reveal>
        <p className={"mb-6 font-base"}>{description}</p>
      </Reveal>
      <Reveal>
        <div className={"flex flex-wrap gap-2"}>
          {tech.map((item) => (
            <span key={item} className="chip">
              {item}
            </span>
          ))}
        </div>
      </Reveal>
    </div>
  );
};
