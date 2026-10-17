'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeviceLandingRedirect() {
  const router = useRouter();

  useEffect(() => {
    const width = window.innerWidth;
    const tabletWidth = width >= 700 && width <= 1280;
    const touchDevice = window.matchMedia('(pointer: coarse)').matches || /iPad|Android/i.test(navigator.userAgent);
    router.replace(tabletWidth && touchDevice ? '/bookings/new' : '/dashboard');
  }, [router]);

  return (
    <div className="device-landing-loading" role="status" aria-live="polite">
      Opening your workspace…
    </div>
  );
}
