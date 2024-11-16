"use client";

import Button from "../../atomic/Button/Button";
import { signOut } from "@/auth/helpers";

export default function HeaderClient() {
  return (
    <div className="flex flex-row w-full justify-between align-items-center p-8">
      <div />
      <code>
        <h1 className="text-xl">My Chess Stats</h1>
      </code>
      <Button
        className="p-4"
        text={"Logout"}
        onClick={async () => {
          console.log("Sign out");
          await signOut();
        }}
      />
    </div>
  );
}
