import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '../src/context/AuthContext';
import { WatchlistProvider } from '../src/context/WatchlistContext';
import { VideoPlayer } from '../src/components/player/VideoPlayer';
import '../src/index.css';

// Deterministic media state; exercise the real player and native browser gestures.
Object.defineProperty(HTMLMediaElement.prototype, 'duration', { get: () => 120 });
HTMLMediaElement.prototype.play = async function () {
  this.dataset.playCalls = String(Number(this.dataset.playCalls || 0) + 1);
};
HTMLMediaElement.prototype.pause = function () {
  this.dataset.pauseCalls = String(Number(this.dataset.pauseCalls || 0) + 1);
};
HTMLMediaElement.prototype.load = function () {};
Object.defineProperty(HTMLMediaElement.prototype, 'src', { get: () => '', set: () => {} });
const source = { provider: 'test', type: 'mp4', url: 'https://example.test/video.mp4', quality: '720p' };
createRoot(document.getElementById('root')!).render(
  <AuthProvider><WatchlistProvider>
    <VideoPlayer media={{ id: 1, title: 'Pointer regression' }} initialSource={source} onClose={() => {}} />
  </WatchlistProvider></AuthProvider>,
);
