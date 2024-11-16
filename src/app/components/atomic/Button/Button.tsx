import { omit } from "@/app/utils";

export interface IButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text: string;
}

export default function Button(props: Readonly<IButtonProps>) {
  const { text, ...otherProps } = props;

  return (
    <button
      className={
        "w-24 rounded-xl border-solid border-2 border-foreground bg-background p-2 font-mono text-foreground"
      }
      {...omit("className", otherProps)}
    >
      {text}
    </button>
  );
}
