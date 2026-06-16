import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Printer, X, QrCode } from 'lucide-react';
import { format } from 'date-fns';

interface QRTrip {
  id: number;
  trackingCode: string;
  status: string;
  fromLocation: string;
  toLocation: string;
  startDate: string;
  customerVehicleRegistration: string | null;
  customerVehicleVin: string | null;
  customerVehicleEngine: string | null;
  customerVehicleStock: string | null;
  customerVehicleMake: string | null;
  customer: { id: number; name: string };
}

interface Props {
  trip: QRTrip;
  onClose: () => void;
}

export default function QRCodeModal({ trip, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackingUrl = `${window.location.origin}/track/${trip.trackingCode}`;

  const handleDownload = () => {
    const canvas = document.getElementById('qr-download-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `QR-Booking-${trip.trackingCode.slice(0, 8).toUpperCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handlePrint = () => {
    const canvas = document.getElementById('qr-download-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>QR Code — Booking ${trip.trackingCode.slice(0, 12).toUpperCase()}</title>
          <style>
            body { font-family: sans-serif; padding: 32px; text-align: center; }
            h2 { font-size: 18px; margin-bottom: 4px; }
            p { font-size: 13px; color: #555; margin: 2px 0; }
            img { width: 220px; height: 220px; margin: 20px auto; display: block; }
            .divider { border-top: 1px solid #eee; margin: 16px 0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; text-align: left; max-width: 380px; margin: 0 auto; }
            .cell label { font-size: 11px; color: #888; display: block; }
            .cell span { font-size: 13px; font-weight: 600; }
          </style>
        </head>
        <body>
          <h2>Perazim Autotransporters</h2>
          <p>Vehicle Tracking QR Code</p>
          <img src="${dataUrl}" />
          <div class="divider"></div>
          <div class="grid">
            <div class="cell"><label>Booking #</label><span>${trip.trackingCode.slice(0, 12).toUpperCase()}</span></div>
            <div class="cell"><label>Customer</label><span>${trip.customer.name}</span></div>
            ${trip.customerVehicleRegistration ? `<div class="cell"><label>Registration</label><span>${trip.customerVehicleRegistration}</span></div>` : ''}
            ${trip.customerVehicleVin ? `<div class="cell"><label>VIN</label><span>${trip.customerVehicleVin}</span></div>` : ''}
            ${trip.customerVehicleEngine ? `<div class="cell"><label>Engine No</label><span>${trip.customerVehicleEngine}</span></div>` : ''}
            ${trip.customerVehicleStock ? `<div class="cell"><label>Stock No</label><span>${trip.customerVehicleStock}</span></div>` : ''}
          </div>
          <div class="divider"></div>
          <p style="font-size:11px;color:#aaa">${trackingUrl}</p>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  };

  const rows: { label: string; value: string | null | undefined }[] = [
    { label: 'Booking #',    value: trip.trackingCode.slice(0, 12).toUpperCase() },
    { label: 'Customer',     value: trip.customer.name },
    { label: 'Registration', value: trip.customerVehicleRegistration },
    { label: 'VIN',          value: trip.customerVehicleVin },
    { label: 'Engine No',    value: trip.customerVehicleEngine },
    { label: 'Stock No',     value: trip.customerVehicleStock },
    { label: 'Make',         value: trip.customerVehicleMake },
    { label: 'Route',        value: `${trip.fromLocation} → ${trip.toLocation}` },
    { label: 'Start Date',   value: format(new Date(trip.startDate), 'dd MMM yyyy') },
    { label: 'Status',       value: trip.status.replace('_', ' ') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-brand-600" />
            <h2 className="font-semibold text-gray-900 text-sm">Vehicle QR Code</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center py-6 bg-gray-50">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
            <QRCodeCanvas
              id="qr-download-canvas"
              ref={canvasRef}
              value={trackingUrl}
              size={180}
              level="M"
              imageSettings={{
                src: '',
                height: 0,
                width: 0,
                excavate: false,
              }}
            />
          </div>
          <p className="mt-3 text-xs text-gray-400 text-center max-w-[200px] break-all">{trackingUrl}</p>
        </div>

        {/* Details */}
        <div className="px-5 py-3 space-y-0 max-h-52 overflow-y-auto">
          {rows.filter(r => r.value).map(r => (
            <div key={r.label} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-500">{r.label}</span>
              <span className="text-xs font-medium text-gray-900 text-right max-w-[55%]">{r.value}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            <Download size={14} /> Download
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>
    </div>
  );
}
