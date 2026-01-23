import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Upload, 
  X, 
  Receipt, 
  Car, 
  Plus, 
  MapPin,
  FileText,
  DollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import ModernDatePicker from '../components/ModernDatePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const AddExpense = ({ embed = false, initialType = 'receipt', onClose = null }) => {
  const navigate = useNavigate();
  const [claimType, setClaimType] = useState(initialType || 'receipt');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Common fields
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    currency: 'GBP',
    tax: 0,
    totalAmount: 0,
    category: 'Travel',
    tags: '',
    notes: '',
    // Receipt-specific
    supplier: '',
    receiptValue: 0,
    // Mileage-specific
    mileage: {
      distance: 0,
      unit: 'miles',
      ratePerUnit: 0.45,
      destinations: [{ address: '', latitude: null, longitude: null, order: 0 }],
      routePoints: []
    }
  });

  const [attachments, setAttachments] = useState([]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleMileageChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      mileage: { ...prev.mileage, [field]: value }
    }));
  };

  const handleDestinationChange = (index, field, value) => {
    const newDestinations = [...formData.mileage.destinations];
    newDestinations[index] = { ...newDestinations[index], [field]: value };
    setFormData(prev => ({
      ...prev,
      mileage: { ...prev.mileage, destinations: newDestinations }
    }));
  };

  // MapLibre route picker state
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const addRoutePoint = (lat, lng) => {
    const newPoints = [...(formData.mileage.routePoints || []), { latitude: lat, longitude: lng }];
    setFormData(prev => ({ ...prev, mileage: { ...prev.mileage, routePoints: newPoints } }));
    computeDistanceFromRoute(newPoints);
  };

  const removeRoutePoint = (index) => {
    const newPoints = (formData.mileage.routePoints || []).filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, mileage: { ...prev.mileage, routePoints: newPoints } }));
    computeDistanceFromRoute(newPoints);
  };

  const computeDistanceFromRoute = (points) => {
    if (!points || points.length < 2) {
      setFormData(prev => ({ ...prev, mileage: { ...prev.mileage, distance: 0 } }));
      return 0;
    }
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000;
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const dLat = toRad(b.latitude - a.latitude);
      const dLon = toRad(b.longitude - a.longitude);
      const lat1 = toRad(a.latitude);
      const lat2 = toRad(b.latitude);
      const sinDlat = Math.sin(dLat / 2);
      const sinDlon = Math.sin(dLon / 2);
      const aa = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
      const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
      total += R * c;
    }
    // total is meters - convert to miles or km based on unit
    let distanceValue = total / 1609.344; // miles
    if (formData.mileage.unit === 'km') distanceValue = total / 1000;
    setFormData(prev => ({ ...prev, mileage: { ...prev.mileage, distance: Number(distanceValue.toFixed(2)) } }));
    return total;
  };

  useEffect(() => {
    if (claimType !== 'mileage') return;
    if (!mapContainer.current) return;

    try {
      if (mapRef.current) {
        // clear existing markers
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];
      }

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256
            }
          },
          layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm-tiles' }]
        },
        center: [0, 0],
        zoom: 2
      });

      map.addControl(new maplibregl.NavigationControl());

      map.on('click', (e) => {
        const { lat, lng } = e.lngLat.wrap ? { lat: e.lngLat.lat, lng: e.lngLat.lng } : { lat: e.lngLat.lat, lng: e.lngLat.lng };
        const marker = new maplibregl.Marker().setLngLat([lng, lat]).addTo(map);
        markersRef.current.push(marker);
        addRoutePoint(lat, lng);
      });

      mapRef.current = map;

      return () => {
        try { map.remove(); } catch (e) { }
        mapRef.current = null;
        markersRef.current = [];
      };
    } catch (err) {
      console.error('Map init error', err);
    }
  }, [claimType]);

  const addDestination = () => {
    if (formData.mileage.destinations.length < 10) {
      setFormData(prev => ({
        ...prev,
        mileage: {
          ...prev.mileage,
          destinations: [
            ...prev.mileage.destinations,
            { address: '', latitude: null, longitude: null, order: prev.mileage.destinations.length }
          ]
        }
      }));
    }
  };

  const removeDestination = (index) => {
    if (formData.mileage.destinations.length > 1) {
      const newDestinations = formData.mileage.destinations.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        mileage: { ...prev.mileage, destinations: newDestinations }
      }));
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (attachments.length + files.length > 5) {
      alert('Maximum 5 attachments allowed per expense claim');
      return;
    }
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const calculateMileageTotal = () => {
    const { distance, ratePerUnit } = formData.mileage;
    const subtotal = distance * ratePerUnit;
    return subtotal + (formData.tax || 0);
  };

  const calculateReceiptTotal = () => {
    return (formData.receiptValue || 0) + (formData.tax || 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Calculate total amount based on claim type
      const totalAmount = claimType === 'mileage' ? calculateMileageTotal() : calculateReceiptTotal();

      // Prepare expense data
      const expenseData = {
        claimType,
        date: formData.date,
        currency: formData.currency,
        tax: formData.tax,
        totalAmount,
        category: formData.category,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
        notes: formData.notes
      };

      if (claimType === 'receipt') {
        expenseData.supplier = formData.supplier;
        expenseData.receiptValue = formData.receiptValue;
      } else {
        expenseData.mileage = {
          distance: formData.mileage.distance,
          unit: formData.mileage.unit,
          ratePerUnit: formData.mileage.ratePerUnit,
          destinations: formData.mileage.destinations,
          routePoints: formData.mileage.routePoints
        };
      }

      // Create expense
      const response = await axios.post('/api/expenses', expenseData);
      const expenseId = response.data._id;

      // Upload attachments
      if (attachments.length > 0) {
        for (const file of attachments) {
          const formDataObj = new FormData();
          formDataObj.append('file', file);
          await axios.post(`/api/expenses/${expenseId}/attachments`, formDataObj, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
      }

      // If embedded, call onClose so parent can close modal and refresh
      if (embed && typeof onClose === 'function') {
        onClose({ created: true, id: expenseId });
      } else {
        navigate('/user-dashboard?tab=expenses');
      }
    } catch (err) {
      console.error('Error creating expense:', err);
      setError(err.response?.data?.message || 'Failed to create expense claim');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    if (!formData.date || !formData.category) return false;
    if (claimType === 'receipt') {
      return formData.supplier && formData.receiptValue > 0;
    } else {
      return (formData.mileage.distance > 0 || (formData.mileage.routePoints && formData.mileage.routePoints.length >= 2)) && formData.mileage.ratePerUnit > 0;
    }
  };

  const containerClass = embed ? 'bg-white rounded-lg shadow p-6' : 'p-6 bg-gray-50 min-h-screen';

  const handleDatePickerChange = (e) => {
    // ModernDatePicker emits a synthetic event with target.name and target.value
    if (e && e.target) {
      handleInputChange(e.target.name, e.target.value);
    }
  };

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          {!embed ? (
            <button
              onClick={() => navigate('/user-dashboard?tab=expenses')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
            >
              <ArrowLeft size={20} />
              Back to Expenses
            </button>
          ) : (
            <button
              onClick={() => onClose && onClose()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
            >
              <ArrowLeft size={20} />
              Close
            </button>
          )}

        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setClaimType('receipt')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg border-2 transition ${
              claimType === 'receipt'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <Receipt size={20} />
            Receipt
          </button>
          <button
            type="button"
            onClick={() => setClaimType('mileage')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg border-2 transition ${
              claimType === 'mileage'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <Car size={20} />
            Mileage
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date */}
            <div>
                <ModernDatePicker
                  name="date"
                  label="Date"
                  value={formData.date}
                  onChange={handleDatePickerChange}
                  required
                />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <Select
                value={String(formData.category || 'Travel')}
                onValueChange={(v) => handleInputChange('category', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Travel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Travel">Travel</SelectItem>
                  <SelectItem value="Meals">Meals</SelectItem>
                  <SelectItem value="Accommodation">Accommodation</SelectItem>
                  <SelectItem value="Equipment">Equipment</SelectItem>
                  <SelectItem value="Training">Training</SelectItem>
                  <SelectItem value="Mileage">Mileage</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Receipt-specific fields */}
            {claimType === 'receipt' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => handleInputChange('supplier', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter supplier name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Currency
                  </label>
                  <Select
                    value={String(formData.currency || 'GBP')}
                    onValueChange={(v) => handleInputChange('currency', v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="GBP (£)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Receipt Value <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.receiptValue}
                    onChange={(e) => handleInputChange('receiptValue', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tax</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.tax}
                    onChange={(e) => handleInputChange('tax', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Value
                  </label>
                  <div className="text-2xl font-bold text-gray-900">
                    {formData.currency} {calculateReceiptTotal().toFixed(2)}
                  </div>
                </div>
              </>
            )}

            {/* Mileage-specific fields */}
            {claimType === 'mileage' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Distance <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.mileage.distance}
                      onChange={(e) => handleMileageChange('distance', parseFloat(e.target.value) || 0)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <div className="w-[140px]">
                      <Select
                        value={String(formData.mileage.unit || 'miles')}
                        onValueChange={(v) => handleMileageChange('unit', v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Miles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="miles">Miles</SelectItem>
                          <SelectItem value="km">KM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rate per {formData.mileage.unit === 'miles' ? 'Mile' : 'KM'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.mileage.ratePerUnit}
                    onChange={(e) => handleMileageChange('ratePerUnit', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tax</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.tax}
                    onChange={(e) => handleInputChange('tax', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Value
                  </label>
                  <div className="text-2xl font-bold text-gray-900">
                    {formData.currency} {calculateMileageTotal().toFixed(2)}
                  </div>
                </div>
              </>
            )}

            {/* Tags */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => handleInputChange('tags', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Comma-separated tags"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Additional information about this expense"
              />
            </div>
          </div>
        </div>

        {/* Journey Planner (Mileage only) */}
        {claimType === 'mileage' && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Journey Planner</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Waypoints (click on map to add)</label>
                  <div className="max-h-48 overflow-auto border rounded p-2">
                    {(formData.mileage.routePoints || []).length === 0 ? (
                      <div className="text-sm text-gray-500">No points yet. Click on the map to add waypoints in order.</div>
                    ) : (
                      (formData.mileage.routePoints || []).map((pt, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1">
                          <div className="text-sm">{idx + 1}. {pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)}</div>
                          <button type="button" onClick={() => removeRoutePoint(idx)} className="text-red-600">Remove</button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">Distance: {formData.mileage.distance} {formData.mileage.unit}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Map</label>
                  <div ref={mapContainer} className="w-full h-48 rounded border" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Attachments */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Attachments ({attachments.length}/5)
          </h3>
          
          {attachments.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              {attachments.map((file, index) => (
                <div key={index} className="relative border border-gray-300 rounded-lg p-3">
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                  >
                    <X size={14} />
                  </button>
                  <FileText size={32} className="text-gray-400 mb-2" />
                  <p className="text-xs text-gray-600 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ))}
            </div>
          )}

          {attachments.length < 5 && (
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer transition">
              <Upload size={20} />
              <span>Attach file</span>
              <input
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf"
                multiple
              />
            </label>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex gap-4">
          <button
              type="button"
              onClick={() => {
                if (embed && typeof onClose === 'function') return onClose({ cancelled: true });
                navigate('/user-dashboard?tab=expenses');
              }}
              className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          <button
            type="submit"
            disabled={!isFormValid() || loading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                <DollarSign size={20} />
                Submit claim
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddExpense;
