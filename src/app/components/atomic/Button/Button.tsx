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
        "rounded-xl border-solid border-2 border-[var(--foreground)] p-2 font-mono bg-[var(--background)] text-[var(--foreground)]"
      }
      {...omit("className", otherProps)}
    >
      {text}
    </button>
  );
}
