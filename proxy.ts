import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  let redirectTo: string | null = null;
  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    // Supabase auth can throw on network/configuration failures. Do not let a
    // temporary auth failure turn even the public login page into a 500.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: membership, error: membershipError } = await supabase
        .from('staff_memberships')
        .select('is_active')
        .eq('member_user_id', user.id)
        .maybeSingle();

      // Until the optional migration is applied this lookup fails; in that case
      // keep the existing owner experience unchanged.
      if (!membershipError && membership) {
        if (!membership.is_active) {
          await supabase.auth.signOut();
          redirectTo = '/login?access=disabled';
        } else {
          const pathname = request.nextUrl.pathname;
          const staffAllowed = pathname === '/staff-booking'
            || pathname.startsWith('/staff-booking/')
            || pathname === '/auth/callback'
            || pathname.startsWith('/auth/callback/')
            || pathname === '/set-password'
            || pathname.startsWith('/set-password/');

          if (pathname === '/' || pathname === '/login') {
            redirectTo = '/staff-booking';
          } else if (!staffAllowed) {
            redirectTo = '/staff-booking';
          }
        }
      }
    }
  } catch (error) {
    console.error(
      'Supabase session check failed in proxy:',
      error instanceof Error ? error.message : 'Unknown authentication error',
    );
  }

  if (redirectTo) {
    const redirectResponse = NextResponse.redirect(new URL(redirectTo, request.url));
    // Preserve refreshed/sign-out cookies when replacing the normal response
    // with a staff-mode redirect.
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
