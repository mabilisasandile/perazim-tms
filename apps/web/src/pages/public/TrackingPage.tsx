import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import {
  Truck, MapPin, User, Car, Hash, CheckCircle2,
  Clock, XCircle, AlertCircle, Loader2, Navigation,
  Package, Info,
} from 'lucide-react';

interface TrackingTrip {
  id: number;
  trackingCode: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  fromLocation: string;
  toLocation: string;
  startDate: string;
  endDate: string | null;
  vehicleCondition: string | null;
  customerVehicleMake: string | null;
  customerVehicleColour: string | null;
  customerVehicleRegistration: string | null;
  customerVehicleVin: string | null;
  customerVehicleEngine: string | null;
  customerVehicleStock: string | null;
  customer: { name: string; phone: string | null };
  vehicle: { name: string; registrationNo: string };
  driver: { name: string; mobile: string };
  positions: { latitude: number; longitude: number; recordedAt: string }[];
  legs: { startLocation: string; endLocation: string; status: string; order: number }[];
}

const statusConfig = {
  PENDING:     { label: 'Awaiting Pickup',  color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  IN_PROGRESS: { label: 'In Transit',       color: 'bg-blue-100 text-blue-800 border-blue-200',       icon: Truck },
  COMPLETED:   { label: 'Delivered',        color: 'bg-green-100 text-green-800 border-green-200',    icon: CheckCircle2 },
  CANCELLED:   { label: 'Cancelled',        color: 'bg-red-100 text-red-800 border-red-200',          icon: XCircle },
};

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <Icon size={16} className="text-brand-600" />
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  );
}

export default function TrackingPage() {
  const { code } = useParams<{ code: string }>();
  const [trip, setTrip] = useState<TrackingTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    axios.get(`/api/v1/trips/track/${code}`)
      .then(r => setTrip(r.data))
      .catch(() => setError('Booking not found. Please check your QR code or tracking number.'))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="animate-spin text-brand-600" size={36} />
    </div>
  );

  if (error || !trip) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center space-y-3 max-w-sm">
        <AlertCircle size={48} className="text-red-400 mx-auto" />
        <p className="text-gray-600">{error}</p>
      </div>
    </div>
  );

  const { label: statusLabel, color: statusColor, icon: StatusIcon } = statusConfig[trip.status];
  const lastPos = trip.positions[0];
  const mapsUrl = lastPos
    ? `https://www.google.com/maps?q=${lastPos.latitude},${lastPos.longitude}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-brand-700 text-white px-4 py-5">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Truck size={20} />
            <span className="font-bold text-lg">Perazim Autotransporters</span>
          </div>
          <p className="text-brand-200 text-sm">Vehicle Tracking</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Status Banner */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${statusColor}`}>
          <StatusIcon size={20} />
          <div>
            <p className="font-semibold">{statusLabel}</p>
            <p className="text-xs opacity-75">
              Booking #{trip.trackingCode.slice(0, 12).toUpperCase()}
            </p>
          </div>
        </div>

        {/* Route */}
        <Card icon={Navigation} title="Route">
          <div className="py-3 space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">From</p>
                <p className="text-sm font-medium text-gray-900">{trip.fromLocation}</p>
              </div>
            </div>
            <div className="ml-1 border-l-2 border-dashed border-gray-200 h-3" />
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">To</p>
                <p className="text-sm font-medium text-gray-900">{trip.toLocation}</p>
              </div>
            </div>
          </div>
          <InfoRow label="Start Date" value={format(new Date(trip.startDate), 'dd MMM yyyy')} />
          {trip.endDate && (
            <InfoRow label="End Date" value={format(new Date(trip.endDate), 'dd MMM yyyy')} />
          )}
        </Card>

        {/* Customer Vehicle */}
        <Card icon={Car} title="Customer Vehicle Details">
          <InfoRow label="Registration"   value={trip.customerVehicleRegistration} />
          <InfoRow label="VIN Number"     value={trip.customerVehicleVin} />
          <InfoRow label="Engine Number"  value={trip.customerVehicleEngine} />
          <InfoRow label="Stock Number"   value={trip.customerVehicleStock} />
          <InfoRow label="Make"           value={trip.customerVehicleMake} />
          <InfoRow label="Colour"         value={trip.customerVehicleColour} />
          <InfoRow label="Condition"      value={trip.vehicleCondition} />
          {!trip.customerVehicleRegistration && !trip.customerVehicleVin && !trip.customerVehicleEngine && (
            <p className="py-3 text-sm text-gray-400 text-center">No vehicle details recorded</p>
          )}
        </Card>

        {/* Customer */}
        <Card icon={User} title="Customer Information">
          <InfoRow label="Name"  value={trip.customer.name} />
          <InfoRow label="Phone" value={trip.customer.phone} />
        </Card>

        {/* Booking Info */}
        <Card icon={Hash} title="Booking Reference">
          <InfoRow label="Booking Number" value={trip.trackingCode} />
          <InfoRow label="Booking ID"     value={`#${trip.id}`} />
        </Card>

        {/* Transport Vehicle */}
        <Card icon={Truck} title="Transport Vehicle">
          <InfoRow label="Vehicle"      value={trip.vehicle.name} />
          <InfoRow label="Registration" value={trip.vehicle.registrationNo} />
          <InfoRow label="Driver"       value={trip.driver.name} />
          <InfoRow label="Driver Contact" value={trip.driver.mobile} />
        </Card>

        {/* Current Location */}
        {lastPos && (
          <Card icon={MapPin} title="Last Known Location">
            <div className="py-3 space-y-2">
              <InfoRow
                label="Recorded"
                value={format(new Date(lastPos.recordedAt), 'dd MMM yyyy HH:mm')}
              />
              <InfoRow
                label="Coordinates"
                value={`${lastPos.latitude.toFixed(5)}, ${lastPos.longitude.toFixed(5)}`}
              />
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 mt-2 w-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  <MapPin size={14} />
                  Open in Google Maps
                </a>
              )}
            </div>
          </Card>
        )}

        {/* Legs */}
        {trip.legs.length > 1 && (
          <Card icon={Package} title="Journey Legs">
            <div className="py-2 space-y-2">
              {trip.legs.map(leg => (
                <div key={leg.order} className="flex items-start gap-3 py-1">
                  <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${leg.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {leg.order}
                  </span>
                  <div>
                    <p className="text-sm text-gray-900">{leg.startLocation} → {leg.endLocation}</p>
                    <p className="text-xs text-gray-400 capitalize">{leg.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 text-xs text-gray-400 justify-center pb-4">
          <Info size={12} />
          <span>Perazim TMS — secure vehicle tracking</span>
        </div>
      </div>
    </div>
  );
}
