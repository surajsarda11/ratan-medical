'use client';

import { useEffect, useState } from 'react';

type Tone = 'success' | 'warning' | 'error';

export default function FeedbackToast({ title, message, tone = 'success', trigger }: { title: string; message: string; tone?: Tone; trigger?: unknown }) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 6500);
    return () => window.clearTimeout(timer);
  }, [message, trigger]);

  if (!message || !visible) return null;
  const icon = tone === 'success' ? '✓' : tone === 'warning' ? '!' : '×';
  return (
    <div className={'action-toast action-toast-' + tone} role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}>
      <div className="action-toast-icon" aria-hidden="true">{icon}</div>
      <div className="action-toast-copy"><strong>{title}</strong><span>{message}</span></div>
      <button type="button" className="action-toast-close" onClick={() => setVisible(false)} aria-label="Dismiss notification">×</button>
    </div>
  );
}
