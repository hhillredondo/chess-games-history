import { SessionProvider } from "next-auth/react";
import { BASE_PATH, auth } from "@/auth";

import HeaderClient from "./Header.client";

export default async function Header() {
  const session = await auth();
  if (session?.user) {
    session.user = {
      name: session.user.name,
      email: session.user.email,
    };
  }

  return (
    <SessionProvider basePath={BASE_PATH} session={session}>
      <HeaderClient userName={session?.user?.name ?? ""} />
    </SessionProvider>
  );
}
