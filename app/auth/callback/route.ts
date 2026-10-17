import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const nextPath = request.nextUrl.searchParams.get('next') || '/staff-booking';
  const safePath = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/staff-booking';
  const code = request.nextUrl.searchParams.get('code');

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(safePath, request.url));
    } catch {
      // Fall through to a friendly sign-in message if the invite code is invalid/expired.
    }
  }

  return NextResponse.redirect(new URL('/login?invite=invalid', request.url));
}
