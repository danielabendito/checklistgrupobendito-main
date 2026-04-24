import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PartyPopper, Gift, Trophy, Star } from "lucide-react";
import confetti from 'canvas-confetti';

interface RewardCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  reward: {
    title: string;
    message: string;
    photo_url: string | null;
    type: string;
  };
}

export const RewardCelebration = ({ isOpen, onClose, reward }: RewardCelebrationProps) => {
  useEffect(() => {
    if (isOpen) {
      // Disparar confetes
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
    }
  }, [isOpen]);

  const getIcon = () => {
    switch (reward.type) {
      case 'streak_5': return <Trophy className="h-12 w-12 text-amber-500" />;
      case 'total_15': return <Star className="h-12 w-12 text-slate-400" />;
      case 'total_25': return <PartyPopper className="h-12 w-12 text-yellow-500" />;
      default: return <Gift className="h-12 w-12 text-primary" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none bg-transparent shadow-none focus-visible:ring-0">
        <div className="relative animate-in zoom-in duration-500">
          {/* Background Glow */}
          <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 via-yellow-500/20 to-primary/20 blur-3xl rounded-full" />
          
          <div className="relative bg-white rounded-3xl overflow-hidden shadow-2xl border-4 border-yellow-400/30">
            <div className="bg-gradient-to-b from-yellow-400/20 to-white p-8 text-center space-y-6">
              
              <div className="flex justify-center animate-bounce">
                <div className="bg-white p-4 rounded-full shadow-lg ring-4 ring-yellow-400/20">
                  {getIcon()}
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">SURPRESA! 🎁</h2>
                <p className="text-lg font-bold text-yellow-600 uppercase tracking-widest">Você conquistou um prêmio!</p>
              </div>

              {reward.photo_url && (
                <div className="relative aspect-video rounded-2xl overflow-hidden shadow-inner border-2 border-slate-100 bg-slate-50">
                  <img 
                    src={reward.photo_url} 
                    alt="Seu prêmio" 
                    className="w-full h-full object-cover animate-in fade-in zoom-in duration-1000 delay-300"
                  />
                </div>
              )}

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 italic text-slate-700 leading-relaxed shadow-sm">
                  "{reward.message}"
                </div>
                
                <div className="p-3 bg-primary/10 rounded-xl inline-block px-6">
                   <p className="font-black text-primary text-xl">{reward.title}</p>
                </div>
              </div>

              <Button 
                onClick={onClose}
                size="lg"
                className="w-full h-16 text-xl font-black rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                VAMOS COM TUDO! 🚀
              </Button>

              <p className="text-xs text-slate-400 font-medium">Mostre esta tela para o seu gerente para resgatar!</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
