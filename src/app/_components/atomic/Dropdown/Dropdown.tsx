import { omit } from "@/app/utils";

export interface IDropdownProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: IDropdownOption[];
  currentValue: IDropdownOption;
}

export interface IDropdownOption {
  value: string;
  label: string;
}

export default function Dropdown(props: Readonly<IDropdownProps>) {
  const { options, currentValue, ...otherProps } = props;

  return (
    <div className="relative inline-flex w-fit max-w-full min-w-[9.5rem]">
      <select
        className={
          "w-full min-w-0 appearance-none cursor-pointer rounded-md border-2 border-solid border-[var(--foreground)] bg-[var(--background)] py-2 pl-3 pr-9 font-mono text-sm text-[var(--foreground)] outline-none transition-opacity hover:opacity-90 focus-visible:outline-none"
        }
        value={currentValue.value}
        {...omit("className", otherProps)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute right-2.5 top-1/2 inline-block -translate-y-1/2 text-[12px] leading-none text-[var(--foreground)] opacity-80"
        aria-hidden
      >
        ▼
      </span>
    </div>
  );
}
