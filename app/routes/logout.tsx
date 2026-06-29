import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { clearSessionCookie } from "~/lib/auth.server";

export async function action({}: Route.ActionArgs) {
  throw redirect("/login", {
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}

export async function loader() {
  throw redirect("/");
}
