import type { Metadata } from 'next';
import { RemotePageClient } from './RemotePageClient';

interface PageProps {
  params: Promise<{ roomCode: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { roomCode } = await params;
  return {
    title: `Remote — ROOM ${roomCode.toUpperCase()} — OKEKARAOKE`,
    description: `Control OKEKARAOKE room ${roomCode.toUpperCase()} from your phone`,
  };
}

export default async function RemotePage({ params }: PageProps) {
  const { roomCode } = await params;
  return <RemotePageClient roomCode={roomCode.toUpperCase()} />;
}
