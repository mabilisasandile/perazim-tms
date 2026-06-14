import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDriverAuthStore } from '../../stores/driverAuthStore';
import { driverApi } from '../../lib/driverApi';

import hero1 from '../../assets/uploads/slide-1.jpg';
import hero2 from '../../assets/uploads/slide-2.jpg';
import hero3 from '../../assets/uploads/slide-3.jpg';
import logo  from '../../assets/uploads/pera.png';

const heroImages = [hero1, hero2, hero3];

interface Trip {
  id: number;
  trackingCode: string;
  status: string;
  fromLocation: string;
  toLocation: string;
  startDate: string;
  customer: { name: string; phone: string | null } | null;
  vehicle: { name: string; registrationNo: string } | null;
}

type View = 'home' | 'trips';

export default function DriverPortalPage() {
  const { driver, logout } = useDriverAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [currentImage, setCurrentImage] = useState(0);
  const [view,         setView]         = useState<View>('home');
  const [toast,        setToast]        = useState('');
  const [trips,        setTrips]        = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setCurrentImage((p) => (p + 1) % heroImages.length), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if ((location.state as any)?.justLoggedIn) {
      setToast('You got logged in successfully.');
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (view === 'trips') loadTrips();
  }, [view]);

  const loadTrips = async () => {
    setTripsLoading(true);
    try {
      const { data } = await driverApi.get('/drivers/portal/trips');
      setTrips(data);
    } finally {
      setTripsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/drivers/d_login');
  };

  const statusColor: Record<string, string> = {
    PENDING:     'bg-yellow-100 text-yellow-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    COMPLETED:   'bg-green-100 text-green-700',
    CANCELLED:   'bg-red-100 text-red-600',
  };

  return (
    <div className="min-h-screen bg-white">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            <button onClick={() => setView('home')}>
              <img src={logo} alt="Perazim" className="h-12 object-contain" />
            </button>
            <span className="text-sm text-gray-500 hidden sm:block">
              Welcome, <strong>{driver?.name}</strong>
            </span>
            <nav className="flex items-center gap-6 text-sm font-medium text-gray-700">
              <button
                onClick={() => setView('trips')}
                className={`hover:text-blue-600 transition ${view === 'trips' ? 'text-blue-600' : ''}`}
              >
                My Trips
              </button>
              <button onClick={handleLogout} className="hover:text-red-600 transition">
                Logout
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* ── Toast ──────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <div className="flex items-center justify-between bg-teal-100 border border-teal-300 text-teal-800 px-4 py-3 rounded shadow">
            <span className="text-sm">{toast}</span>
            <button onClick={() => setToast('')} className="ml-4 font-bold text-teal-600 hover:text-teal-900">✕</button>
          </div>
        </div>
      )}

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative h-screen overflow-hidden">
        <img
          src={heroImages[currentImage]}
          alt="Hero"
          className="absolute inset-0 w-full h-full object-cover transition-all duration-1000"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Welcome back, {driver?.name?.split(' ')[0]}
          </h1>
          <p className="text-lg md:text-xl text-white max-w-2xl">
            Safe and reliable vehicle transportation across South Africa and neighboring countries.
          </p>
          <button
            onClick={() => setView('trips')}
            className="mt-8 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            View My Trips
          </button>
        </div>
      </section>

      {/* ── Main Content ───────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-16">

        {/* HOME: profile summary */}
        {view === 'home' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl shadow-lg p-8 border">
              <h2 className="text-xl font-bold mb-4 text-gray-900">My Profile</h2>
              <dl className="space-y-3 text-sm">
                {([
                  ['Name',       driver?.name],
                  ['Email',      driver?.email],
                  ['Mobile',     driver?.mobile],
                  ['License No', driver?.licenseNo],
                  ['Experience', driver?.totalExperience ?? '—'],
                ] as [string, string | undefined][]).map(([label, val]) => (
                  <div key={label} className="flex justify-between border-b pb-2 last:border-0">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-800">{val}</span>
                  </div>
                ))}
              </dl>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-8 border">
              <h2 className="text-xl font-bold mb-4 text-gray-900">Account Status</h2>
              <div className="mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${driver?.isActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {driver?.isActive ? 'Active' : 'Pending Validation'}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {driver?.isActive
                  ? 'Your account is active. View assigned trips from the "My Trips" section.'
                  : 'Your account is awaiting admin validation. You will be notified once approved.'}
              </p>
            </div>
          </div>
        )}

        {/* MY TRIPS */}
        {view === 'trips' && (
          <div>
            <h2 className="text-3xl font-bold mb-6">My Trips</h2>
            {tripsLoading ? (
              <p className="text-gray-500">Loading…</p>
            ) : trips.length === 0 ? (
              <p className="text-gray-500">No trips assigned yet.</p>
            ) : (
              <div className="space-y-4">
                {trips.map((trip) => (
                  <div key={trip.id} className="bg-white rounded-xl shadow p-6 border">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{trip.fromLocation} → {trip.toLocation}</p>
                        <p className="text-xs text-gray-400 mt-0.5">#{trip.trackingCode}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[trip.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {trip.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                      {trip.vehicle && (
                        <p><span className="text-gray-400">Vehicle: </span>{trip.vehicle.name} ({trip.vehicle.registrationNo})</p>
                      )}
                      {trip.customer && (
                        <p><span className="text-gray-400">Customer: </span>{trip.customer.name}</p>
                      )}
                      <p><span className="text-gray-400">Start: </span>{new Date(trip.startDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-white py-6 mt-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-center gap-6 text-sm">
          <a href="#">FAQ</a>
          <span className="text-gray-600">|</span>
          <a href="#">Contact Us</a>
          <span className="text-gray-600">|</span>
          <a href="#">Terms of Use</a>
          <span className="text-gray-600">|</span>
          <a href="#">Privacy Policy</a>
        </div>
        <div className="text-center mt-4 text-gray-400 text-xs">
          © {new Date().getFullYear()} Perazim Auto Transporters
        </div>
      </footer>
    </div>
  );
}
