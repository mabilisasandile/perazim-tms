import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, AlertCircle, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import PlacesAutocompleteInput from '../../components/maps/PlacesAutocompleteInput';

interface SelectOption { id: number; name: string; }
interface VehicleOption { id: number; name: string; registrationNo: string; }

// One vehicle line under the shared booking — each becomes its own Trip,
// grouped under a single Booking / booking number.
const vehicleEntrySchema = z.object({
  vehicleId: z.coerce.number().int().positive('Perazim truck is required'),
  driverId: z.coerce.number().int().positive('Perazim driver is required'),
  trailerId: z.preprocess(v => (!v || v === '' || Number(v) === 0) ? null : Number(v), z.number().int().positive().optional().nullable()),
  fromLocation: z.string().min(1, 'Pickup location is required'),
  toLocation: z.string().min(1, 'Drop off location is required'),
  startDate: z.string().min(1, 'Trip start date is required'),
  endDate: z.string().optional(),
  amount: z.coerce.number().min(0).optional(),
  customerVehicleMake: z.string().min(1, 'Vehicle make & model is required'),
  customerVehicleColour: z.string().min(1, 'Vehicle colour is required'),
  customerVehicleRegistration: z.string().min(1, 'Vehicle registration is required'),
  customerVehicleVin: z.string().optional(),
  customerVehicleStock: z.string().optional(),
  customerVehicleEngine: z.string().optional(),
  vehicleCondition: z.enum(['Runner', 'Non-Runner']).optional(),
});

const schema = z.object({
  customerId: z.coerce.number().int().positive('Customer is required'),
  notes: z.string().optional(),
  sendConfirmationEmail: z.boolean().optional(),
  vehicles: z.array(vehicleEntrySchema).min(1, 'Add at least one vehicle'),
});
type FormData = z.infer<typeof schema>;

const emptyVehicle = {
  vehicleId: undefined as unknown as number,
  driverId: undefined as unknown as number,
  trailerId: null,
  fromLocation: '',
  toLocation: '',
  startDate: '',
  endDate: '',
  amount: undefined,
  customerVehicleMake: '',
  customerVehicleColour: '',
  customerVehicleRegistration: '',
  customerVehicleVin: '',
  customerVehicleStock: '',
  customerVehicleEngine: '',
  vehicleCondition: undefined,
};

export default function AddMultiVehicleBookingPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState('');
  const [createdBookingNumber, setCreatedBookingNumber] = useState('');

  const { data: customers = [] } = useQuery<SelectOption[]>({
    queryKey: ['customers-select'],
    queryFn: () => api.get('/customers').then(r => r.data.map((c: any) => ({ id: c.id, name: c.name }))),
  });
  const { data: vehicles = [] } = useQuery<VehicleOption[]>({
    queryKey: ['vehicles-select'],
    queryFn: () => api.get('/vehicles').then(r => r.data.filter((v: any) => v.isActive)),
  });
  const { data: drivers = [] } = useQuery<SelectOption[]>({
    queryKey: ['drivers-select'],
    queryFn: () => api.get('/drivers').then(r => r.data.filter((d: any) => d.isActive)),
  });
  const { data: trailers = [] } = useQuery<SelectOption[]>({
    queryKey: ['trailers-select'],
    queryFn: () => api.get('/trailers').then(r => r.data.filter((t: any) => t.isActive).map((t: any) => ({ id: t.id, name: t.registrationNo }))),
  });

  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { sendConfirmationEmail: true, vehicles: [emptyVehicle] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'vehicles' });
  const vehiclesValue = watch('vehicles');

  const createBooking = useMutation({
    mutationFn: (data: FormData) => api.post('/bookings', data).then(r => r.data),
    onSuccess: (booking) => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      setCreatedBookingNumber(booking.bookingNumber);
    },
    onError: (err: any) => {
      setSubmitError(err?.response?.data?.error || 'Failed to create booking. Please check the form and try again.');
    },
  });

  const onSubmit = (data: FormData) => {
    setSubmitError('');
    createBooking.mutate(data);
  };

  if (createdBookingNumber) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center bg-white rounded-xl border p-8">
        <CheckCircle2 className="mx-auto text-green-600 mb-3" size={48} />
        <h1 className="text-xl font-semibold text-gray-800">Booking created</h1>
        <p className="text-gray-500 mt-2">
          Booking number <span className="font-mono font-semibold text-gray-800">{createdBookingNumber}</span> has been created
          with all vehicles grouped under it.
        </p>
        <div className="flex justify-center gap-3 mt-6">
          <Link to="/app/bookings" className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50">
            Back to bookings
          </Link>
          <button
            onClick={() => navigate(0)}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
          >
            Create another booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="mb-6">
        <p className="text-xs text-gray-400 mb-1">
          <Link to="/app/dashboard" className="hover:underline">Dashboard</Link> / <Link to="/app/bookings" className="hover:underline">Bookings</Link> / New multi-vehicle booking
        </p>
        <h1 className="text-xl font-semibold text-gray-800">New Booking — Multiple Vehicles</h1>
        <p className="text-sm text-gray-500 mt-1">
          Book several vehicles for one customer under a single booking number. Each vehicle becomes its own trip.
        </p>
      </div>

      {submitError && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <section className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Customer</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select {...register('customerId')} className="w-full rounded-lg border-gray-300 text-sm">
                <option value="">Select customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.customerId && <p className="text-xs text-red-600 mt-1">{errors.customerId.message}</p>}
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" {...register('sendConfirmationEmail')} defaultChecked className="rounded border-gray-300" />
                Send confirmation email for each vehicle
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea {...register('notes')} rows={2} className="w-full rounded-lg border-gray-300 text-sm" />
            </div>
          </div>
        </section>

        {fields.map((field, index) => (
          <section key={field.id} className="bg-white rounded-xl border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Vehicle {index + 1}
              </h2>
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Remove this vehicle"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle make & model</label>
                <input {...register(`vehicles.${index}.customerVehicleMake`)} className="w-full rounded-lg border-gray-300 text-sm" />
                {errors.vehicles?.[index]?.customerVehicleMake && (
                  <p className="text-xs text-red-600 mt-1">{errors.vehicles[index]?.customerVehicleMake?.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Colour</label>
                <input {...register(`vehicles.${index}.customerVehicleColour`)} className="w-full rounded-lg border-gray-300 text-sm" />
                {errors.vehicles?.[index]?.customerVehicleColour && (
                  <p className="text-xs text-red-600 mt-1">{errors.vehicles[index]?.customerVehicleColour?.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration</label>
                <input {...register(`vehicles.${index}.customerVehicleRegistration`)} className="w-full rounded-lg border-gray-300 text-sm" />
                {errors.vehicles?.[index]?.customerVehicleRegistration && (
                  <p className="text-xs text-red-600 mt-1">{errors.vehicles[index]?.customerVehicleRegistration?.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VIN</label>
                <input {...register(`vehicles.${index}.customerVehicleVin`)} className="w-full rounded-lg border-gray-300 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock number</label>
                <input {...register(`vehicles.${index}.customerVehicleStock`)} className="w-full rounded-lg border-gray-300 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Engine number</label>
                <input {...register(`vehicles.${index}.customerVehicleEngine`)} className="w-full rounded-lg border-gray-300 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                <select {...register(`vehicles.${index}.vehicleCondition`)} className="w-full rounded-lg border-gray-300 text-sm">
                  <option value="">Select…</option>
                  <option value="Runner">Runner</option>
                  <option value="Non-Runner">Non-Runner</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (ex. VAT)</label>
                <input type="number" step="0.01" {...register(`vehicles.${index}.amount`)} className="w-full rounded-lg border-gray-300 text-sm" />
              </div>
            </div>

            <hr />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Perazim truck</label>
                <select {...register(`vehicles.${index}.vehicleId`)} className="w-full rounded-lg border-gray-300 text-sm">
                  <option value="">Select truck…</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registrationNo})</option>)}
                </select>
                {errors.vehicles?.[index]?.vehicleId && (
                  <p className="text-xs text-red-600 mt-1">{errors.vehicles[index]?.vehicleId?.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
                <select {...register(`vehicles.${index}.driverId`)} className="w-full rounded-lg border-gray-300 text-sm">
                  <option value="">Select driver…</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {errors.vehicles?.[index]?.driverId && (
                  <p className="text-xs text-red-600 mt-1">{errors.vehicles[index]?.driverId?.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trailer (optional)</label>
                <select {...register(`vehicles.${index}.trailerId`)} className="w-full rounded-lg border-gray-300 text-sm">
                  <option value="">None</option>
                  {trailers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup location</label>
                <PlacesAutocompleteInput
                  value={vehiclesValue?.[index]?.fromLocation ?? ''}
                  onChange={val => setValue(`vehicles.${index}.fromLocation`, val, { shouldValidate: true })}
                  onPlaceSelect={name => setValue(`vehicles.${index}.fromLocation`, name, { shouldValidate: true })}
                  placeholder="Enter a location"
                  className="w-full rounded-lg border-gray-300 text-sm"
                />
                {errors.vehicles?.[index]?.fromLocation && (
                  <p className="text-xs text-red-600 mt-1">{errors.vehicles[index]?.fromLocation?.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Drop off location</label>
                <PlacesAutocompleteInput
                  value={vehiclesValue?.[index]?.toLocation ?? ''}
                  onChange={val => setValue(`vehicles.${index}.toLocation`, val, { shouldValidate: true })}
                  onPlaceSelect={name => setValue(`vehicles.${index}.toLocation`, name, { shouldValidate: true })}
                  placeholder="Enter a location"
                  className="w-full rounded-lg border-gray-300 text-sm"
                />
                {errors.vehicles?.[index]?.toLocation && (
                  <p className="text-xs text-red-600 mt-1">{errors.vehicles[index]?.toLocation?.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                <input type="datetime-local" {...register(`vehicles.${index}.startDate`)} className="w-full rounded-lg border-gray-300 text-sm" />
                {errors.vehicles?.[index]?.startDate && (
                  <p className="text-xs text-red-600 mt-1">{errors.vehicles[index]?.startDate?.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End date (optional)</label>
                <input type="datetime-local" {...register(`vehicles.${index}.endDate`)} className="w-full rounded-lg border-gray-300 text-sm" />
              </div>
            </div>
          </section>
        ))}

        <button
          type="button"
          onClick={() => append({ ...emptyVehicle })}
          className="flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          <Plus size={16} /> Add another vehicle to this booking
        </button>

        <div className="flex justify-end gap-3 pt-2">
          <Link to="/app/bookings" className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || createBooking.isPending}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium"
          >
            {(isSubmitting || createBooking.isPending) && <Loader2 size={16} className="animate-spin" />}
            Create booking ({fields.length} vehicle{fields.length > 1 ? 's' : ''})
          </button>
        </div>
      </form>
    </div>
  );
}
