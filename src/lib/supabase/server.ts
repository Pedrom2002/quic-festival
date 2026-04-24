import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const isProd = process.env.NODE_ENV === "production";

function hardenOptions(opts?: CookieOptions): CookieOptions {
  return {
    ...opts,
    httpOnly: true,
    sameSite: opts?.sameSite ?? "lax",
    secure: opts?.secure ?? isProd,
    path: opts?.path ?? "/",
  };
}

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all: CookieToSet[]) => {
          try {
            all.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, hardenOptions(options)),
            );
          } catch {
            /* called from Server Component — ignore */
          }
        },
      },
    },
  );
}
