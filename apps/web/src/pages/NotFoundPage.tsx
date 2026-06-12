import { Link } from 'react-router-dom';
import { AlertTriangle, Home, LogIn } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <div className="flex justify-center mb-6">
          <AlertTriangle
            size={80}
            className="text-amber-500"
          />
        </div>

        <h1 className="text-7xl font-bold text-slate-800">
          404
        </h1>

        <h2 className="mt-4 text-3xl font-semibold text-slate-700">
          Page Not Found
        </h2>

        <p className="mt-4 text-slate-500">
          The page you are looking for does not exist,
          may have been moved, or the URL is incorrect.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <Home size={18} />
            Back Home
          </Link>

          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-slate-300 hover:bg-slate-100"
          >
            <LogIn size={18} />
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}