import { useTheme } from "@/contexts/ThemeContext";
import Dropdown from "../../atomic/Dropdown/Dropdown";

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
    { value: "solarized", label: "Solarized" },
    { value: "forest", label: "Forest" },
    { value: "neonLight", label: "Neon Light" },
    { value: "neonDark", label: "Neon Dark" },
    { value: "arcticLight", label: "Arctic Light" },
    { value: "arcticDark", label: "Arctic Dark" },
  ];

  function handleThemeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newTheme = e.target.value;
    if (newTheme !== theme) {
      setTheme(newTheme);
    }
  }

  const currentTheme = themeOptions.find((option) => option.value === theme);

  return (
    <div className="w-fit max-w-full">
      <Dropdown
        options={themeOptions}
        currentValue={currentTheme ?? themeOptions[0]}
        onChange={handleThemeChange}
      ></Dropdown>
    </div>
  );
}
