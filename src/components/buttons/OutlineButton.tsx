import type { MouseEventHandler, ReactNode } from "react";

interface Props {
  children: string | ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export const OutlineButton = ({ children, onClick }: Props) => {
  return (
    <button onClick={onClick} className={"outlineButton relative flex cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-brand px-4 py-2 font-semibold text-brand transition-all md:text-xl hover:text-white"}>
      {children}
    </button>
  );
};
