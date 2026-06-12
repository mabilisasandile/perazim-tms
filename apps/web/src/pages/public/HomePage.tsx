import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import hero1 from '../../assets/uploads/slide-1.jpg';
import hero2 from '../../assets/uploads/slide-2.jpg';
import hero3 from '../../assets/uploads/slide-3.jpg';

import Navbar from '../../components/layout/Navbar';

const images = [hero1, hero2, hero3];

const messages = [
    'Safe Vehicle Transportation Across South Africa and our neighboring countries.',
    'Track Your Shipment In Real Time',
    'Reliable Fleet Management Solutions',
    'Fast, Secure and Affordable Vehicle Delivery',
];

export default function HomePage() {
    const [currentImage, setCurrentImage] = useState(0);
    const [currentMessage, setCurrentMessage] = useState(0);

    useEffect(() => {
        const imageTimer = setInterval(() => {
            setCurrentImage((prev) => (prev + 1) % images.length);
        }, 5000);

        return () => clearInterval(imageTimer);
    }, []);

    useEffect(() => {
        const textTimer = setInterval(() => {
            setCurrentMessage((prev) => (prev + 1) % messages.length);
        }, 3000);

        return () => clearInterval(textTimer);
    }, []);

    return (
        <div className="min-h-screen bg-white">
            {/* NAVBAR */}
            <Navbar />

            {/* HERO */}
            <section className="relative h-screen overflow-hidden" id="home">
                <img
                    src={images[currentImage]}
                    alt="Hero"
                    className="absolute inset-0 w-full h-full object-cover transition-all duration-1000"
                />

                <div className="absolute inset-0 bg-black/50" />

                <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
                        Making transportation fast and safe
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

                        <Link
                            to="/login"
                            className="px-8 py-4 border border-white text-white rounded-lg hover:bg-white hover:text-black"
                        >
                            Login
                        </Link>
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
                <div className="max-w-6xl mx-auto px-6">
                    <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
                        <h2 className="text-4xl font-bold mb-2">
                            Ready to book your trip?
                        </h2>

                        <p className="text-gray-500 mb-10">
                            Enter your vehicle information below.
                        </p>

                        <div className="grid md:grid-cols-2 gap-6">
                            <input
                                placeholder="Pick up location"
                                className="border rounded-lg p-3"
                            />

                            <input
                                placeholder="Drop off location"
                                className="border rounded-lg p-3"
                            />

                            <input
                                type="date"
                                className="border rounded-lg p-3"
                            />

                            <input
                                type="date"
                                className="border rounded-lg p-3"
                            />
                        </div>

                        <h3 className="text-2xl font-bold mt-10 mb-6">
                            Vehicle Details
                        </h3>

                        <div className="grid md:grid-cols-3 gap-6">
                            <input
                                placeholder="Vehicle Make"
                                className="border rounded-lg p-3"
                            />

                            <input
                                placeholder="Vehicle Colour"
                                className="border rounded-lg p-3"
                            />

                            <input
                                placeholder="Vehicle Registration"
                                className="border rounded-lg p-3"
                            />

                            <input
                                placeholder="VIN Number"
                                className="border rounded-lg p-3"
                            />

                            <input
                                placeholder="Stock Number"
                                className="border rounded-lg p-3"
                            />

                            <input
                                placeholder="Engine Number"
                                className="border rounded-lg p-3"
                            />
                        </div>

                        <div className="mt-8 text-right">
                            <button className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                Book Now
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-slate-900 text-white py-6">
                <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-center gap-8">
                    <a href="#">FAQ</a>
                    <a href="#">Contact Us</a>
                    <a href="#">Terms of Use</a>
                    <a href="#">Privacy Policy</a>
                </div>

                <div className="text-center mt-4 text-gray-400 text-sm">
                    © {new Date().getFullYear()} Perazim Auto Transporters
                </div>
            </footer>
        </div>
    );
}