"use server";

import { redirect } from "next/navigation";
import { authenticate, createSession, destroySession } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Enter both email and password.")}`);
  }

  const user = await authenticate(email, password);
  if (!user) {
    redirect(`/login?error=${encodeURIComponent("Invalid credentials. Try a demo account below.")}`);
  }

  await createSession(user);
  redirect(next || "/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
