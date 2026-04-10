'use client';

import { useEffect } from 'react';

export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Sattvic] Home page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#FFFDF8' }}>
      <div className="max-w-lg w-full rounded-2xl p-6 shadow-sm" style={{ border: '1px solid #F0E8D8', background: 'white' }}>
        <div className="text-3xl mb-3">⚠️</div>
        <h2 className="text-lg font-bold mb-2" style={{ color: '#2C2416' }}>Something went wrong</h2>

        {/* Show the actual error so we can debug it */}
        <div className="mb-4 p-3 rounded-xl text-xs font-mono break-all"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
          <div className="font-bold mb-1">{error?.name}: {error?.message}</div>
          {error?.stack && (
            <pre className="whitespace-pre-wrap text-xs mt-2 opacity-75">{error.stack}</pre>
          )}
          {error?.digest && <div className="mt-1 opacity-50">Digest: {error.digest}</div>}
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Please copy the red error text above and send it so we can fix this.
        </p>

        <div className="flex gap-3">
          <button onClick={reset}
            className="flex-1 py-2.5 text-sm font-semibold text-white rounded-full"
            style={{ background: '#E8793A' }}>
            Try again
          </button>
          <a href="/home"
            className="flex-1 py-2.5 text-sm font-semibold text-center border rounded-full"
            style={{ border: '1.5px solid #E8793A', color: '#E8793A' }}>
            Reload page
          </a>
        </div>
      </div>
    </div>
  );
}
