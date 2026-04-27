import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerProps {
  onScan: (decodedText: string) => void;
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const runningRef = useRef(false);
  const lastScanRef = useRef("");

  // Evitamos crypto.randomUUID porque puede fallar en celular por HTTP
  const readerIdRef = useRef(
    `qr-reader-${Date.now()}-${Math.floor(Math.random() * 100000)}`
  );

  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const startScanner = async () => {
      try {
        setCameraError("");

        const scanner = new Html5Qrcode(readerIdRef.current);
        scannerRef.current = scanner;

        try {
          await scanner.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 220, height: 220 },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              if (decodedText === lastScanRef.current) return;

              lastScanRef.current = decodedText;
              onScan(decodedText);

              setTimeout(() => {
                lastScanRef.current = "";
              }, 2000);
            },
            () => { }
          );
        } catch {
          await scanner.start(
            { facingMode: "user" },
            {
              fps: 10,
              qrbox: { width: 220, height: 220 },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              if (decodedText === lastScanRef.current) return;

              lastScanRef.current = decodedText;
              onScan(decodedText);

              setTimeout(() => {
                lastScanRef.current = "";
              }, 2000);
            },
            () => { }
          );
        }

        if (!cancelled) {
          runningRef.current = true;
        } else {
          await scanner.stop();
          scanner.clear();
        }
      } catch (error) {
        console.error("Error al iniciar cámara:", error);

       
      }
    };

    startScanner();

    return () => {
      cancelled = true;

      const scanner = scannerRef.current;

      if (scanner && runningRef.current) {
        scanner
          .stop()
          .then(() => {
            runningRef.current = false;
            scanner.clear();
          })
          .catch(() => { });
      }
    };
  }, [onScan]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        id={readerIdRef.current}
        className="w-[300px] min-h-[300px] rounded-xl overflow-hidden border border-blue-100 bg-black"
      />

      <p className="text-xs text-slate-500 text-center">
        Coloca el código QR dentro del recuadro.
      </p>
    </div>
  );
}