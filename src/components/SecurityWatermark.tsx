import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateTimeString } from "@/lib/utils";

interface SecurityWatermarkProps {
  checklistId?: string;
  checklistName?: string;
}

export const SecurityWatermark = ({ checklistId, checklistName }: SecurityWatermarkProps) => {
  const [userName, setUserName] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("");
  const [timestamp] = useState<string>(getLocalDateTimeString());

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, store_id")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserName(profile.nome || user.email || "Usuário");

        if (profile.store_id) {
          const { data: store } = await supabase
            .from("stores")
            .select("nome")
            .eq("id", profile.store_id)
            .single();

          if (store) {
            setStoreName(store.nome);
          }
        }
      }
    } catch (error) {
      console.error("Error loading watermark data:", error);
    }
  };

  const formatTimestamp = (ts: string) => {
    const [date, time] = ts.split('T');
    const [year, month, day] = date.split('-');
    const [hour, minute] = time.split(':');
    return `${day}/${month}/${year} ${hour}:${minute}`;
  };

  const watermarkText = [
    userName,
    storeName,
    formatTimestamp(timestamp),
    checklistId ? `ID: ${checklistId.slice(0, 8)}` : "",
    checklistName || ""
  ].filter(Boolean).join(" • ");

  return (
    <div className="fixed inset-0 pointer-events-none z-50 select-none">
      {/* Diagonal watermarks - ultra discreet */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-gray-400/[0.025] font-light text-[8px] whitespace-nowrap"
            style={{
              top: `${(i % 3) * 33 + 15}%`,
              left: `${Math.floor(i / 3) * 50 + 10}%`,
              transform: 'rotate(-45deg)',
              transformOrigin: 'center',
              mixBlendMode: 'overlay',
            }}
          >
            {watermarkText}
          </div>
        ))}
      </div>

      {/* Horizontal watermarks - top and bottom */}
      <div className="absolute top-2 left-0 right-0 text-center text-[7px] text-gray-500/[0.02] font-light">
        {watermarkText}
      </div>
      <div className="absolute bottom-2 left-0 right-0 text-center text-[7px] text-gray-500/[0.02] font-light">
        {watermarkText}
      </div>

      {/* Vertical watermarks - sides */}
      <div 
        className="absolute left-4 top-1/2 text-[7px] text-gray-500/[0.02] font-light whitespace-nowrap"
        style={{ transform: 'translateY(-50%) rotate(-90deg)', transformOrigin: 'center', mixBlendMode: 'overlay' }}
      >
        {watermarkText}
      </div>
      <div 
        className="absolute right-4 top-1/2 text-[7px] text-gray-500/[0.02] font-light whitespace-nowrap"
        style={{ transform: 'translateY(-50%) rotate(90deg)', transformOrigin: 'center', mixBlendMode: 'overlay' }}
      >
        {watermarkText}
      </div>

      {/* Center watermark - ghost */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400/[0.015] font-light text-[9px] whitespace-nowrap rotate-[-30deg]"
        style={{ mixBlendMode: 'overlay' }}
      >
        {watermarkText}
      </div>
    </div>
  );
};
