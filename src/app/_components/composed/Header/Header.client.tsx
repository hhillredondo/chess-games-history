"use client";

import { signOut } from "@/auth/helpers";
import Button from "../../atomic/Button/Button";
import ThemeSwitcher from "../ThemeSwitcher/ThemeSwitcher.client";

export interface IHeaderClientProps {
  userName: string;
}

export default function HeaderClient(props: Readonly<IHeaderClientProps>) {
  const { userName } = props;
  return (
    <div className="flex flex-row w-full justify-between items-center p-8 border-solid border-b-2	border-[var(--foreground)]">
      <ThemeSwitcher />
      <code>
        <h1 className="text-xl">My Chess Stats</h1>
      </code>
      <div className="space-x-4">
        <code>{userName}</code>
        <Button
          text={"Logout"}
          onClick={async () => {
            await signOut();
          }}
        />
      </div>
    </div>
  );
}
