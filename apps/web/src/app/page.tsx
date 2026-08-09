import { redirect } from "next/navigation";

/**
 * Root route.
 *
 * Session state lives in localStorage, which the server can't read, so the
 * real signed-in/out decision happens client-side. Sending everyone to /login
 * keeps the entry point unambiguous; the login page bounces authenticated
 * users onward.
 */
export default function HomePage(): never {
  redirect("/login");
}
