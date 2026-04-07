import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsInstallable(false);
      toast.success('Aplicativo instalado com sucesso!');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
       toast.info('O aplicativo já está instalado ou seu navegador não suporta a instalação rápida.');
       return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
    } else {
      toast.info('Instalação cancelada pelo usuário.');
    }
  };

  if (isInstalled) return null;

  return (
    <Button 
      onClick={handleInstallClick}
      variant="outline" 
      size="sm"
      className="fixed top-4 right-4 z-50 bg-background/80 backdrop-blur-sm border-primary/20 hover:bg-primary/10 transition-all flex items-center gap-2 shadow-lg"
    >
      <Download className="w-4 h-4 text-primary animate-bounce" />
      <span className="hidden sm:inline font-medium text-sm">Instalar App</span>
    </Button>
  );
}

