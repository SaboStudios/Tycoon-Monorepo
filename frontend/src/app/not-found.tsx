import Link from 'next/link';
import { Home, Search, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/lib/metadata';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full bg-[#010F10] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Animated 404 */}
        <div className="relative">
          <h1 className="text-9xl font-orbitron font-bold text-[#00F0FF] tracking-wider">
            404
          </h1>
          <div className="absolute inset-0 text-9xl font-orbitron font-bold text-[#00F0FF]/20 blur-xl">
            404
          </div>
        </div>

        {/* Message */}
        <div className="space-y-4">
          <h2 className="text-3xl font-orbitron text-[#F0F7F7]">
            Page Not Found
          </h2>
          <p className="text-[#869298] text-lg max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved.
            Let's get you back on track.
          </p>
        </div>

        {/* Visual element */}
        <div className="flex justify-center gap-4 py-8">
          <div className="w-3 h-3 rounded-full bg-[#00F0FF]/30 animate-pulse" />
          <div className="w-3 h-3 rounded-full bg-[#00F0FF]/60 animate-pulse delay-100" />
          <div className="w-3 h-3 rounded-full bg-[#00F0FF] animate-pulse delay-200" />
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/">
            <Button className="bg-[#00F0FF] text-[#010F10] hover:bg-[#00F0FF]/80 font-orbitron px-8 py-6 text-lg">
              <Home className="w-5 h-5 mr-2" />
              Back to Home
            </Button>
          </Link>
          <Link href="/game-settings">
            <Button
              variant="outline"
              className="border-[#003B3E] text-[#00F0FF] hover:bg-[#00F0FF]/10 font-orbitron px-8 py-6 text-lg"
            >
              <Search className="w-5 h-5 mr-2" />
              Find a Game
            </Button>
          </Link>
        </div>

        {/* Support link */}
        <div className="pt-8 border-t border-[#003B3E]">
          <p className="text-[#869298] text-sm mb-4">
            Still can't find what you're looking for?
          </p>
          <Link
            href="/support"
            className="inline-flex items-center gap-2 text-[#00F0FF] hover:underline"
          >
            <Headphones className="w-4 h-4" />
            Contact Support
          </Link>
        </div>

        {/* Site info */}
        <footer className="pt-8 text-[#869298] text-sm">
          <p>{siteConfig.name}</p>
        </footer>
      </div>
    </div>
  );
}
