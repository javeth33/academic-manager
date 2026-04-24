import { QRCodeCanvas } from 'qrcode.react';

interface StudentQRProps {
  matricula?: string;
}

export default function StudentQR({ matricula }: StudentQRProps) {
  if (!matricula) {
    return <p>No hay matrícula registrada para generar el QR.</p>;
  }

  return <QRCodeCanvas value={matricula} size={180} />;
}