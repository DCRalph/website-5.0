"use client";

import { animate, stagger } from 'animejs';

export const DotGrid = () => {
  const GRID_WIDTH = 25;
  const GRID_HEIGHT = 20;

  const dots = [];

  const handleDotClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const from = parseInt(e.currentTarget.dataset.index ?? "0");
    animate(".dot-point", {

      scale: [
        { to: 1.35, ease: "outSine", duration: 250 },
        { to: 1, ease: "inOutQuad", duration: 500 },
      ],
      translateY: [
        { to: -15, ease: "outSine", duration: 250 },
        { to: 0, ease: "inOutQuad", duration: 500 },
      ],
      opacity: [
        { to: 0.8, ease: "outSine", duration: 250 },
        { to: 0.4, ease: "inOutQuad", duration: 500 },
      ],
      delay: stagger(100, {
        grid: [GRID_WIDTH, GRID_HEIGHT],
        from: from,
      }),
    });
  };

  let index = 0;

  for (let i = 0; i < GRID_WIDTH; i++) {
    for (let j = 0; j < GRID_HEIGHT; j++) {
      dots.push(
        <div
          onClick={handleDotClick}
          className={"dotWrapper group"}
          data-index={index}
          key={`${i}-${j}`}
        >
          <div
            className={
              "dot-point h-2 w-2 rounded-full bg-linear-to-b from-background to-text opacity-40 group-hover:from-brand group-hover:to-background group-hover:opacity-100!"
            }
            data-index={index}
          />
        </div>,
      );
      index++;
    }
  }

  return (
    <div
      style={{ gridTemplateColumns: `repeat(${GRID_WIDTH}, 1fr)` }}
      className={"absolute bottom-3 right-14 top-3 z-0 grid h-20 max-w-[75%]"}
    >
      {dots.map((dot) => dot)}
    </div>
  );
};
