import NextAuth, { User, NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const BASE_PATH = "/api/auth";

const authOptions: NextAuthConfig = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: {
          label: "Username",
          type: "text",
          placeholder: "Enter username",
        },
        password: {
          label: "Password",
          type: "text",
          placeholder: "Enter password",
        },
      },
      async authorize(credentials): Promise<User | null> {
        // Hardcoded User(s)
        const users = [
          {
            id: "dev-user",
            userName: "dev",
            name: "Dev User",
            password: "Password123++",
            email: "dev@devmail.com",
          },
        ];

        const user = users.find(
          (user) =>
            user.userName === credentials.username &&
            user.password === credentials.password
        );

        if (!user) {
          return null;
        }

        const { id, name, email } = user;

        return { id, name, email };
      },
    }),
  ],
  basePath: BASE_PATH,
  secret: process.env.NEXTAUTH_SECRET,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
