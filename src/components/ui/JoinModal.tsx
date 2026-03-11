'use client';

import { useState } from 'react';

interface Props {
  onClose: () => void;
  onJoined?: (wallet: string) => void;
}

export default function JoinModal({ onClose, onJoined }: Props) {
  const [wallet, setWallet] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!wallet.trim()) { setError('Enter your wallet address'); return; }
    if (!name.trim()) { setError('Pick a name for your worker'); return; }
    setError('');

    try {
      const res = await fetch('/api/workers/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: wallet.trim(), name: name.trim() }),
      });
      if (res.ok) {
        setSubmitted(true);
        onJoined?.(wallet.trim());
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Something went wrong');
      }
    } catch {
      setError('Network error. Try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#1a1408] border-2 border-[#5a4a30] rounded-lg max-w-sm w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-b from-[#2a1f10] to-[#1a1408] p-4 border-b border-[#5a4a30]">
          <h3 className="pixel-font text-[11px] text-[#f5e6c8] text-center">Join to Mine</h3>
          <p className="text-[11px] text-[#7a6b55] text-center mt-2 leading-relaxed">
            Submit your wallet to create a worker in Molt Town. Your worker earns MOLTTOWN tokens by working alongside the residents.
          </p>
        </div>

        <div className="p-4 space-y-3">
          {submitted ? (
            <div className="text-center py-4">
              <div className="text-[#f5c842] pixel-font text-[10px] mb-2">Welcome to Molt Town!</div>
              <p className="text-[11px] text-[#a89070]">Your worker has been created. Watch them mine MOLTTOWN in the town.</p>
              <button onClick={onClose} className="mt-4 btn-pixel bg-[#6b4226] text-[#f5e6c8] hover:bg-[#8a5533]">
                Close
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-[9px] text-[#7a6b55] uppercase tracking-wider font-bold block mb-1">Worker Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Archibald the Brave"
                  maxLength={30}
                  className="w-full bg-[#251c0e] border border-[#5a4a30] rounded px-3 py-2 text-[12px] text-[#e8d5b0] placeholder-[#3a2f1a] focus:border-[#c4a46c] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] text-[#7a6b55] uppercase tracking-wider font-bold block mb-1">Wallet Address</label>
                <input
                  type="text"
                  value={wallet}
                  onChange={e => setWallet(e.target.value)}
                  placeholder="Your SOL wallet address"
                  className="w-full bg-[#251c0e] border border-[#5a4a30] rounded px-3 py-2 text-[12px] text-[#e8d5b0] placeholder-[#3a2f1a] focus:border-[#c4a46c] focus:outline-none font-mono"
                />
              </div>
              {error && <p className="text-[10px] text-red-400">{error}</p>}
              <button
                onClick={handleSubmit}
                className="w-full btn-pixel bg-gradient-to-r from-[#6b4226] to-[#8a5533] text-[#f5e6c8] hover:from-[#8a5533] hover:to-[#a06838] shadow-lg"
              >
                Create Worker
              </button>
              <p className="text-[9px] text-[#5a4a30] text-center">
                Workers mine MOLTTOWN tokens automatically each tick.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
