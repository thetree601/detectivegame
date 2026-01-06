'use client';

import { useState } from 'react';
import StartScreen from '@/components/StartScreen';
import GameScreen from '@/components/GameScreen';

export default function Home() {
  const [gameStarted, setGameStarted] = useState(false);
  const caseId = 1;

  if (!gameStarted) {
    return <StartScreen caseId={caseId} onStartGame={() => setGameStarted(true)} />;
  }

  return <GameScreen caseId={caseId} />;
}