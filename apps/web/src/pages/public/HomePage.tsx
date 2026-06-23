import { useEffect, useState } from 'react';

import hero1 from '../../assets/uploads/slide-1.jpg';
import hero2 from '../../assets/uploads/slide-2.jpg';
import hero3 from '../../assets/uploads/slide-3.jpg';

import Navbar from '../../components/layout/Navbar';
import CustomerSignInModal from '@/components/auth/CustomerSignInModal';
import { customerApi } from '@/lib/customerApi';

const images = [hero1, hero2, hero3];

const headers = [
    'Making transportation fast and safe',
    'Door-To-Door Nationwide & Cross Border.',
    'We get it done'
];

const messages = [
    'You can depend on Perazim Autotransporters to deliver your car safely and quickly.',
    'Perazim Autotransporters can transport your vehicle anywhere in South Africa and our neighboring countries.',
    'We treat your vehicle as if it where our own, making sure not a dent or scratch affects your vehicle.',
];

export default function HomePage() {
    const [currentImage, setCurrentImage] = useState(0);
    const [currentMessage, setCurrentMessage] = useState(0);
    const [currentHeader, setCurrentHeader] = useState(0);
    const [customerSignInOpen, setCustomerSignInOpen] = useState(false);
    const [toast, setToast] = useState('');

    // Booking form state
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');
    const [pickupDate, setPickupDate] = useState('');
    const [dropoffDate, setDropoffDate] = useState('');
    const [make, setMake] = useState('');
    const [colour, setColour] = useState('');
    const [registration, setRegistration] = useState('');
    const [vin, setVin] = useState('');
    const [stock, setStock] = useState('');
    const [engine, setEngine] = useState('');
    const [vehicleCondition, setVehicleCondition] = useState('Runner');
    const [bookingBusy, setBookingBusy] = useState(false);

    useEffect(() => {
        const imageTimer = setInterval(() => {
            setCurrentImage((prev) => (prev + 1) % images.length);
        }, 5000);

        return () => clearInterval(imageTimer);
    }, []);

    useEffect(() => {
        const textTimer = setInterval(() => {
            setCurrentMessage((prev) => (prev + 1) % messages.length);
            setCurrentHeader((prev) => (prev + 1) % headers.length);
        }, 3000);

        return () => clearInterval(textTimer);
    }, []);

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
            setToast(err?.response?.data?.message ?? 'Booking failed. Please login and try again.');
            console.log("Booking failed:", err);
        } finally {
            setBookingBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-white">
            {/* NAVBAR */}
            <Navbar />

            {/* ── Toast ──────────────────────────────────────────────── */}
            {toast && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
                    <div className="flex items-center justify-between bg-teal-100 border border-teal-300 text-teal-800 px-4 py-3 rounded shadow">
                        <span className="text-sm">{toast}</span>
                        <button onClick={() => setToast('')} className="ml-4 text-teal-600 hover:text-teal-900 font-bold">✕</button>
                    </div>
                </div>
            )}

            {/* HERO */}
            <section className="relative h-screen overflow-hidden" id="home">
                <img
                    src={images[currentImage]}
                    alt="Hero"
                    className="absolute inset-0 w-full h-full object-cover transition-all duration-1000"
                />

                <div className="absolute inset-0 bg-black/50" />

                <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
                    <h1
                        key={currentHeader}
                        className="text-4xl md:text-6xl font-bold text-white mb-6">
                        {headers[currentHeader]}
                    </h1>

                    <div className="h-16 overflow-hidden">
                        <h2
                            key={currentMessage}
                            className="text-xl md:text-3xl text-white animate-pulse"
                        >
                            {messages[currentMessage]}
                        </h2>
                    </div>

                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <a
                            href="#booking"
                            className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Book Transport
                        </a>

                        <button
                            onClick={() => setCustomerSignInOpen(true)}
                            className="px-8 py-4 border border-white text-white rounded-lg hover:bg-white hover:text-black"
                        >
                            Login
                        </button>
                    </div>
                </div>
            </section>

            {/* ABOUT */}
            <section className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="shadow-lg rounded-xl p-8">
                            <h3 className="text-xl font-bold mb-3">
                                Nationwide Delivery
                            </h3>

                            <p className="text-gray-600">
                                Reliable vehicle transportation across South Africa and our neighboring countries.
                            </p>
                        </div>

                        <div className="shadow-lg rounded-xl p-8">
                            <h3 className="text-xl font-bold mb-3">
                                Live Tracking
                            </h3>

                            <p className="text-gray-600">
                                Monitor vehicles in real-time from pickup to delivery.
                            </p>
                        </div>

                        <div className="shadow-lg rounded-xl p-8">
                            <h3 className="text-xl font-bold mb-3">
                                Fleet Management
                            </h3>

                            <p className="text-gray-600">
                                Powerful tools for drivers, dispatchers and administrators.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* BOOKING FORM */}
            <section
                id="booking"
                className="bg-gray-100 py-24"
            >
                <form onSubmit={handleBooking}>
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
                            <h2 className="text-4xl font-bold mb-2">
                                Ready to book your trip?
                            </h2>

                            <p className="text-gray-500 mb-10">
                                Enter your vehicle information below.
                            </p>

                            <div className="grid md:grid-cols-2 gap-6">
                                <input required value={pickup} onChange={(e) => setPickup(e.target.value)}
                                    placeholder="Pick up location"
                                    className="border rounded-lg p-3"
                                />

                                <input required value={dropoff} onChange={(e) => setDropoff(e.target.value)}
                                    placeholder="Drop off location"
                                    className="border rounded-lg p-3"
                                />

                                <input value={pickupDate} onChange={(e) => setPickupDate(e.target.value)}
                                    type="date"
                                    className="border rounded-lg p-3"
                                />

                                <input value={dropoffDate} onChange={(e) => setDropoffDate(e.target.value)}
                                    type="date"
                                    className="border rounded-lg p-3"
                                />
                            </div>

                            <h3 className="text-2xl font-bold mt-10 mb-6">
                                Vehicle Details
                            </h3>

                            <div className="grid md:grid-cols-3 gap-6">
                                <input required value={make} onChange={(e) => setMake(e.target.value)}
                                    placeholder="Vehicle Make"
                                    className="border rounded-lg p-3"
                                />

                                <input required value={colour} onChange={(e) => setColour(e.target.value)}
                                    placeholder="Vehicle Colour"
                                    className="border rounded-lg p-3"
                                />

                                <input required value={registration} onChange={(e) => setRegistration(e.target.value)}
                                    placeholder="Vehicle Registration"
                                    className="border rounded-lg p-3"
                                />

                                <input value={vin} onChange={(e) => setVin(e.target.value)}
                                    placeholder="VIN Number"
                                    className="border rounded-lg p-3"
                                />

                                <input value={stock} onChange={(e) => setStock(e.target.value)}
                                    placeholder="Stock Number"
                                    className="border rounded-lg p-3"
                                />

                                <input value={engine} onChange={(e) => setEngine(e.target.value)}
                                    placeholder="Engine Number"
                                    className="border rounded-lg p-3"
                                />
                                <select
                                    value={vehicleCondition}
                                    onChange={(e) => setVehicleCondition(e.target.value)}
                                    className="border rounded-lg p-3 bg-white"
                                >
                                    <option value="Runner">Runner</option>
                                    <option value="Non-Runner">Non-Runner</option>
                                </select>
                            </div>

                            <div className="mt-8 text-right">
                                <button
                                    type="submit"
                                    disabled={bookingBusy}
                                    className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                    {bookingBusy ? 'Submitting…' : 'Book Now'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </section>

            {/* FOOTER */}
            <footer className="bg-slate-900 text-white py-6">
                <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-center gap-8">
                    <a href="#">FAQ</a>
                    <a href="#">Contact Us</a>
                    <a href="#">Terms of Use</a>
                    <a href="#">Privacy Policy</a>
                    <a href="/login">Admin</a>
                </div>

                <div className="text-center mt-4 text-gray-400 text-sm">
                    © {new Date().getFullYear()} Perazim Auto Transporters
                </div>
            </footer>

            <CustomerSignInModal
                open={customerSignInOpen}
                onClose={() => setCustomerSignInOpen(false)}
            />
        </div>
    );
}