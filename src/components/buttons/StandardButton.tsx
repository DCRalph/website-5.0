import type { MouseEventHandler, ReactNode } from "react";

interface Props {
  children: string | ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export const StandardButton = ({ children, onClick }: Props) => {
  return (
    <button onClick={onClick} className={"cursor-pointer overflow-hidden rounded-md border-none bg-brand px-4 py-2 text-xl font-semibold text-white outline-hidden transition-all hover:scale-95 hover:opacity-80"}>
      {children}
    </button>
  );
};
