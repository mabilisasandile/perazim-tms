import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDriverAuthStore } from '../../stores/driverAuthStore';

import hero1 from '../../assets/uploads/slide-1.jpg';
import hero2 from '../../assets/uploads/slide-2.jpg';
import hero3 from '../../assets/uploads/slide-3.jpg';

const heroImages = [hero1, hero2, hero3];

export default function DriverLoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, driver } = useDriverAuthStore();

  const [currentImage, setCurrentImage] = useState(0);
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (driver) navigate('/driver', { replace: true });
  }, [driver, navigate]);

  useEffect(() => {
    const t = setInterval(() => setCurrentImage((p) => (p + 1) % heroImages.length), 5000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/driver', { state: { justLoggedIn: true } });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        'Invalid email or password.'
      );
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Hero background */}
      <img
        src={heroImages[currentImage]}
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover transition-all duration-1000"
      />
      <div className="absolute inset-0 bg-black/30" />

      {/* Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
          <div className="flex">
            {/* Left avatar panel */}
            <div className="hidden md:flex w-48 bg-gray-50 border-r items-center justify-center py-12 flex-shrink-0">
              <svg viewBox="0 0 120 140" className="w-32 h-32 text-gray-700" fill="currentColor">
                <circle cx="55" cy="38" r="28" />
                <path d="M5 130 Q5 90 55 90 Q105 90 105 130 Z" />
                {/* Tie */}
                <polygon points="55,90 50,110 55,125 60,110" fill="white" />
                {/* Key */}
                <circle cx="95" cy="105" r="12" fill="none" stroke="currentColor" strokeWidth="4"/>
                <line x1="103" y1="113" x2="115" y2="125" stroke="currentColor" strokeWidth="4"/>
                <line x1="110" y1="120" x2="115" y2="115" stroke="currentColor" strokeWidth="3"/>
                <line x1="112" y1="124" x2="117" y2="119" stroke="currentColor" strokeWidth="3"/>
              </svg>
            </div>

            {/* Form */}
            <div className="flex-1 p-10">
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Driver Login</h1>
              <p className="text-sm text-gray-500 mb-8">Please use you account information to sign in here</p>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">{error}</p>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Link to="#" className="text-sm text-blue-600 hover:underline">Forgot Password?</Link>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-8 py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {isLoading ? 'Signing in…' : 'Log in'}
                  </button>
                </div>
              </form>

              <p className="mt-6 text-sm text-gray-500">
                Don't have an account?{' '}
                <Link to="/drivers/d_signup" className="text-blue-600 hover:underline">Create one</Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 py-4">
        <div className="flex justify-center gap-4 text-white/80 text-sm">
          <a href="#" className="hover:text-white">FAQ</a>
          <span className="text-white/40">|</span>
          <a href="#" className="hover:text-white">Contact Us</a>
          <span className="text-white/40">|</span>
          <a href="#" className="hover:text-white">Terms of Use</a>
          <span className="text-white/40">|</span>
          <a href="#" className="hover:text-white">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
