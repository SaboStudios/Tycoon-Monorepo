'use client';

import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';

export function ScrollToTopBtn() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-6 right-6 z-40 flex items-center justify-center w-10 h-10 rounded-full bg-tycoon-accent text-tycoon-bg transition-opacity duration-300 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tycoon-accent focus-visible:ring-offset-2 focus-visible:ring-offset-tycoon-bg ${
        isVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      aria-label="Scroll to top"
    >
      <ChevronUp size={20} />
    </button>
  );
}
