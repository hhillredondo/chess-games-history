"use server";
import { signIn as _signIn, signOut as _singOut } from ".";

export async function signIn() {
  await _signIn();
}

export async function signOut() {
  await _singOut();
}
