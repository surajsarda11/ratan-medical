import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const nextPath = request.nextUrl.searchParams.get('next') || '/staff-booking';
  const safePath = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/staff-booking';
  const code = request.nextUrl.searchParams.get('code');
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');

  try {
    const supabase = await createClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(safePath, request.url));
    } else if (tokenHash && type === 'invite') {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' });
      if (!error) return NextResponse.redirect(new URL(safePath, request.url));
    }
  } catch {
    // Fall through to a friendly sign-in message if the invite code is invalid/expired.
  }

  return NextResponse.redirect(new URL('/login?invite=invalid', request.url));
}
