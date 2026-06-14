import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCustomerAuthStore } from '../../stores/customerAuthStore';
import { customerApi } from '../../lib/customerApi';

import hero1 from '../../assets/uploads/slide-1.jpg';
import hero2 from '../../assets/uploads/slide-2.jpg';
import hero3 from '../../assets/uploads/slide-3.jpg';
import logo  from '../../assets/uploads/pera.png';

const heroImages = [hero1, hero2, hero3];

interface Booking {
  id: number;
  number: string;
  pickup: string;
  dropoff: string;
  pickupDate: string | null;
  dropoffDate: string | null;
  status: string;
  createdAt: string;
  items: { description: string; registration: string | null; vehicleCondition: string | null }[];
}

type View = 'home' | 'bookings' | 'profile';

export default function CustomerPortalPage() {
  const { customer, logout, update } = useCustomerAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [currentImage, setCurrentImage] = useState(0);
  const [view,         setView]         = useState<View>('home');
  const [toast,        setToast]        = useState('');

  // Booking form state
  const [pickup,      setPickup]      = useState('');
  const [dropoff,     setDropoff]     = useState('');
  const [pickupDate,  setPickupDate]  = useState('');
  const [dropoffDate, setDropoffDate] = useState('');
  const [make,        setMake]        = useState('');
  const [colour,      setColour]      = useState('');
  const [registration, setRegistration] = useState('');
  const [vin,         setVin]         = useState('');
  const [stock,       setStock]       = useState('');
  const [engine,           setEngine]           = useState('');
  const [vehicleCondition, setVehicleCondition] = useState('Runner');
  const [bookingBusy, setBookingBusy] = useState(false);

  // My Bookings state
  const [bookings,      setBookings]      = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  // Edit profile state
  const [editName,    setEditName]    = useState(customer?.name    ?? '');
  const [editPhone,   setEditPhone]   = useState(customer?.phone   ?? '');
  const [editAddress, setEditAddress] = useState(customer?.address ?? '');
  const [profileBusy, setProfileBusy] = useState(false);

  // Hero carousel
  useEffect(() => {
    const t = setInterval(() => setCurrentImage((p) => (p + 1) % heroImages.length), 5000);
    return () => clearInterval(t);
  }, []);

  // Show "logged in" toast on first arrival
  useEffect(() => {
    if ((location.state as any)?.justLoggedIn) {
      setToast('You got logged in successfully..');
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Sync edit fields when view changes to profile
  useEffect(() => {
    if (view === 'profile') {
      setEditName(customer?.name    ?? '');
      setEditPhone(customer?.phone  ?? '');
      setEditAddress(customer?.address ?? '');
    }
    if (view === 'bookings') loadBookings();
  }, [view]);

  const loadBookings = async () => {
    setBookingsLoading(true);
    try {
      const { data } = await customerApi.get('/customers/portal/bookings');
      setBookings(data);
    } finally {
      setBookingsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingBusy(true);
    try {
      await customerApi.post('/customers/portal/bookings', {
        pickup, dropoff, pickupDate: pickupDate || undefined, dropoffDate: dropoffDate || undefined,
        vehicleMake: make, vehicleColour: colour, vehicleRegistration: registration,
        vehicleVin: vin || undefined, vehicleStock: stock || undefined, vehicleEngine: engine || undefined,
        vehicleCondition,
      });
      setToast('Booking submitted successfully!');
      setPickup(''); setDropoff(''); setPickupDate(''); setDropoffDate('');
      setMake(''); setColour(''); setRegistration(''); setVin(''); setStock(''); setEngine('');
      setVehicleCondition('Runner');
    } catch (err: any) {
      setToast(err?.response?.data?.message ?? 'Booking failed. Please try again.');
    } finally {
      setBookingBusy(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileBusy(true);
    try {
      await update({ name: editName, phone: editPhone || undefined, address: editAddress || undefined });
      setToast('Profile updated successfully!');
    } catch {
      setToast('Failed to update profile.');
    } finally {
      setProfileBusy(false);
    }
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
            <nav className="flex items-center gap-6 text-gray-700 text-sm font-medium">
              <button
                onClick={() => setView('bookings')}
                className={`hover:text-blue-600 transition ${view === 'bookings' ? 'text-blue-600' : ''}`}
              >
                My Bookings
              </button>
              <button
                onClick={() => setView('home')}
                className={`hover:text-blue-600 transition ${view === 'home' ? 'text-blue-600' : ''}`}
              >
                Book
              </button>
              <button
                onClick={() => setView('profile')}
                className={`hover:text-blue-600 transition ${view === 'profile' ? 'text-blue-600' : ''}`}
              >
                Update Information
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
            <button onClick={() => setToast('')} className="ml-4 text-teal-600 hover:text-teal-900 font-bold">✕</button>
          </div>
        </div>
      )}

      {/* ── Hero ───────────────────────────────────────────────── */}
      {/* <section className="relative h-screen overflow-hidden">
        <img
          src={heroImages[currentImage]}
          alt="Hero"
          className="absolute inset-0 w-full h-full object-cover transition-all duration-1000"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">We get it done</h1>
          <p className="text-lg md:text-xl text-white max-w-2xl">
            We treat your vehicle as if it where our own, making sure not a dent or scratch affects your vehicle.
          </p>
        </div>
      </section> */}

      {/* ── Main Content ───────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-16">

        {/* HOME: Booking form */}
        {view === 'home' && (
          <div className="py-24 bg-white rounded-2xl shadow-xl p-8 md:p-12">
            <h2 className="text-3xl font-bold mb-1">Ready to book your trip?</h2>
            <p className="text-gray-500 mb-8 text-sm">Enter your vehicle information below to book your transportation.</p>

            <form onSubmit={handleBooking}>
              <div className="grid md:grid-cols-2 gap-5 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pick up location</label>
                  <input required value={pickup} onChange={(e) => setPickup(e.target.value)}
                    placeholder="Enter From"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Drop off location</label>
                  <input required value={dropoff} onChange={(e) => setDropoff(e.target.value)}
                    placeholder="Enter To"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pick up date</label>
                  <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Drop off date</label>
                  <input type="date" value={dropoffDate} onChange={(e) => setDropoffDate(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <h3 className="text-xl font-bold mb-4">Vehicle details</h3>
              <div className="grid md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle make<span className="text-red-500">*</span></label>
                  <input required value={make} onChange={(e) => setMake(e.target.value)}
                    placeholder="Ford Focus"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle colour<span className="text-red-500">*</span></label>
                  <input required value={colour} onChange={(e) => setColour(e.target.value)}
                    placeholder="Blue"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle registration<span className="text-red-500">*</span></label>
                  <input required value={registration} onChange={(e) => setRegistration(e.target.value)}
                    placeholder="ND456585"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle VIN number</label>
                  <input value={vin} onChange={(e) => setVin(e.target.value)}
                    placeholder="VIN"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle stock number</label>
                  <input value={stock} onChange={(e) => setStock(e.target.value)}
                    placeholder="Stock No."
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle engine number</label>
                  <input value={engine} onChange={(e) => setEngine(e.target.value)}
                    placeholder="Engine No."
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle condition<span className="text-red-500">*</span></label>
                  <select value={vehicleCondition} onChange={(e) => setVehicleCondition(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="Runner">Runner</option>
                    <option value="Non-Runner">Non-Runner</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 text-right">
                <button
                  type="submit"
                  disabled={bookingBusy}
                  className="px-8 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {bookingBusy ? 'Submitting…' : 'Book Now'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MY BOOKINGS */}
        {view === 'bookings' && (
          <div className='py-24'>
            <h2 className="text-3xl font-bold mb-6">My Bookings</h2>
            {bookingsLoading ? (
              <p className="text-gray-500">Loading…</p>
            ) : bookings.length === 0 ? (
              <p className="text-gray-500">No bookings yet.</p>
            ) : (
              <div className="space-y-4">
                {bookings.map((b) => (
                  <div key={b.id} className="bg-white rounded-xl shadow p-6 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">{b.number}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        b.status === 'DRAFT'     ? 'bg-gray-100 text-gray-600' :
                        b.status === 'SENT'      ? 'bg-blue-100 text-blue-600' :
                        b.status === 'ACCEPTED'  ? 'bg-green-100 text-green-700' :
                        b.status === 'CONVERTED' ? 'bg-teal-100 text-teal-700' :
                        'bg-red-100 text-red-600'
                      }`}>{b.status}</span>
                    </div>
                    <p className="text-sm text-gray-600">{b.pickup} → {b.dropoff}</p>
                    {b.items[0] && <p className="text-sm text-gray-500 mt-1">{b.items[0].description}</p>}
                    {b.items[0]?.vehicleCondition && (
                      <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${b.items[0].vehicleCondition === 'Non-Runner' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                        {b.items[0].vehicleCondition}
                      </span>
                    )}
                    <p className="text-xs text-gray-400 mt-2">{new Date(b.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EDIT PROFILE */}
        {view === 'profile' && (
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 max-w-lg">
            <h2 className="text-3xl font-bold mb-6">Edit My Information</h2>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input required value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input disabled value={customer?.email ?? ''}
                  className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-sm text-gray-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="pt-2">
                <button type="submit" disabled={profileBusy}
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {profileBusy ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-white py-6 mt-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-center gap-8 text-sm">
          <a href="#">FAQ</a>
          <a href="#">Contact Us</a>
          <a href="#">Terms of Use</a>
          <a href="#">Privacy Policy</a>
        </div>
        <div className="text-center mt-4 text-gray-400 text-xs">
          © {new Date().getFullYear()} Perazim Auto Transporters
        </div>
      </footer>
    </div>
  );
}
