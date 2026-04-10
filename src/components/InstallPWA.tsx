import React, { useEffect, useState } from 'react';
import { Download, X, Sparkles, Smartphone } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Delay visibility to not annoy the user immediately
      const timer = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsVisible(false);

    if (outcome === 'accepted') {
      toast({
        title: "Installation de l'App",
        description: "Nguma s'installe sur votre écran d'accueil.",
      });
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!isVisible || sessionStorage.getItem('pwa-prompt-dismissed') === 'true') {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[100] md:left-auto md:right-8 md:bottom-8 md:w-[400px] animate-in slide-in-from-bottom-10 duration-700 ease-out">
      <div className="relative overflow-hidden bg-zinc-950/90 dark:bg-zinc-950/95 border border-white/10 p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl flex flex-col gap-6 group">
        {/* Decorative elements */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-colors duration-700" />
        
        <div className="flex justify-between items-start relative z-10">
          <div className="flex gap-4 items-center">
            <div className="bg-gradient-to-br from-primary to-indigo-600 p-3 rounded-2xl shadow-premium rotate-3 group-hover:rotate-0 transition-transform duration-500">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-white tracking-tight flex items-center gap-2">
                Nguma sur Mobile
                <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
              </h3>
              <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                Installez l'application pour un accès direct et sécurisé à vos actifs.
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="p-1 text-zinc-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex gap-3 relative z-10">
          <Button 
            onClick={handleInstallClick} 
            className="flex-1 rounded-2xl bg-white text-zinc-950 hover:bg-zinc-200 font-black uppercase tracking-widest text-[10px] h-12 shadow-xl active:scale-95 transition-all"
          >
            Installer l'App
          </Button>
          <Button 
            variant="ghost" 
            onClick={handleClose} 
            className="rounded-2xl text-white/60 hover:text-white hover:bg-white/5 font-bold uppercase tracking-widest text-[10px] h-12"
          >
            Plus tard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InstallPWA;
