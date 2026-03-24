import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, SwitchCamera, Loader2 } from "lucide-react";

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  disabled?: boolean;
}

export function CameraCapture({ open, onClose, onCapture, disabled }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    setLoading(true);
    setError(null);
    stopStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.error("📸 [CAMERA] Erro ao abrir câmera:", err);
      setError(
        err.name === "NotAllowedError"
          ? "Permissão de câmera negada. Permita o acesso nas configurações do navegador."
          : err.name === "NotFoundError"
            ? "Nenhuma câmera encontrada neste dispositivo."
            : "Não foi possível abrir a câmera. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }, [stopStream]);

  useEffect(() => {
    if (open) {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("UNSUPPORTED");
        return;
      }
      startCamera(facingMode);
    } else {
      stopStream();
    }

    return () => stopStream();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwitchCamera = async () => {
    const newFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newFacing);
    await startCamera(newFacing);
  };

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setCapturing(true);

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");

      ctx.drawImage(video, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError("Falha ao capturar a foto. Tente novamente.");
            setCapturing(false);
            return;
          }

          const file = new File([blob], `photo-${Date.now()}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

          console.log(`📸 [CAMERA] Foto capturada in-memory: ${(file.size / 1024).toFixed(0)}KB`);
          stopStream();
          onCapture(file);
          onClose();
          setCapturing(false);
        },
        "image/jpeg",
        0.85
      );
    } catch (err) {
      console.error("📸 [CAMERA] Erro ao capturar:", err);
      setError("Erro ao processar a foto. Tente novamente.");
      setCapturing(false);
    }
  }, [onCapture, onClose, stopStream]);

  const handleClose = () => {
    stopStream();
    onClose();
  };

  if (!open) return null;

  // Fallback: se getUserMedia não está disponível, usa input file sem capture
  if (error === "UNSUPPORTED") {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground text-center mb-4">
          Câmera in-app não disponível neste navegador. Use o seletor de arquivo.
        </p>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="mb-4"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onCapture(file);
              onClose();
            }
          }}
        />
        <Button variant="outline" onClick={handleClose}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="text-white hover:bg-white/20"
        >
          <X className="h-6 w-6" />
        </Button>
        <span className="text-white text-sm font-medium">Tirar Foto</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSwitchCamera}
          className="text-white hover:bg-white/20"
          disabled={loading}
        >
          <SwitchCamera className="h-5 w-5" />
        </Button>
      </div>

      {/* Video preview */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Loader2 className="h-10 w-10 text-white animate-spin" />
          </div>
        )}

        {error && error !== "UNSUPPORTED" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-6">
            <p className="text-white text-center mb-4">{error}</p>
            <Button variant="secondary" onClick={() => startCamera(facingMode)}>
              Tentar novamente
            </Button>
          </div>
        )}

        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
      </div>

      {/* Capture button */}
      <div className="flex items-center justify-center p-6 pb-8 bg-black/80">
        <button
          onClick={handleCapture}
          disabled={loading || !!error || capturing || disabled}
          className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform"
        >
          {capturing ? (
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-white" />
          )}
        </button>
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
