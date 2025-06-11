import { MouseEventHandler, ReactNode } from "react";

interface Props {
  children: string | ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export const OutlineButton = ({ children, onClick }: Props) => {
  return (
    <button onClick={onClick} className={"outlineButton"}>
      {children}
    </button>
  );
};
