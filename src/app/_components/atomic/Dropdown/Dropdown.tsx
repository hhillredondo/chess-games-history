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
    <select
      className={
        "w-full border-solid border-2 border-[var(--foreground)] py-2 px-6 font-mono bg-[var(--background)] text-[var(--foreground)]"
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
  );
}
