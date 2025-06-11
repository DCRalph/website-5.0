import { MouseEventHandler, ReactNode } from "react";

interface Props {
  children: string | ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export const StandardButton = ({ children, onClick }: Props) => {
  return (
    <button onClick={onClick} className={"standardButton"}>
      {children}
    </button>
  );
};
