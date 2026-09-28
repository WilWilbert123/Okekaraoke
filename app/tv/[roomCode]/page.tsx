import type { Metadata } from 'next';
import { TVPageClient } from './TVPageClient';

interface PageProps {
  params: Promise<{ roomCode: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { roomCode } = await params;
  return {
    title: `ROOM ${roomCode.toUpperCase()} — OKEKARAOKE`,
    description: `OKEKARAOKE room ${roomCode.toUpperCase()} - Karaoke TV screen`,
  };
}

export default async function TVPage({ params }: PageProps) {
  const { roomCode } = await params;
  return <TVPageClient roomCode={roomCode.toUpperCase()} />;
}
