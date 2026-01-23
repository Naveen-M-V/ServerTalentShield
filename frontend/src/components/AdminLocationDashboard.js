import React, { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import moment from 'moment-timezone';
import { 
  MapPinIcon, 
  UserGroupIcon, 
  ClockIcon, 
  EyeIcon,
  RefreshIcon,
  FilterIcon
} from '@heroicons/react/24/outline';

/**
 * AdminLocationDashboard - Multi-user location tracking with Protomaps
 * Shows all active employees on a single map with real-time updates
 */
const AdminLocationDashboard = ({
  height = '600px',
  style = 'light',
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
  onEmployeeClick = null,
  className = ''
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const refreshIntervalRef = useRef(null);
  
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'on-break'
  const [lastUpdate, setLastUpdate] = useState(null);

  // Initialize PMTiles protocol
  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    return () => {
      maplibregl.removeProtocol('pmtiles');
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return;

    try {
      // Protomaps style configuration
      const mapStyle = {
        version: 8,
        sources: {
          protomaps: {
            type: 'vector',
            url: 'pmtiles://https://build.protomaps.com/20240219.pmtiles',
            attribution: '© <a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>'
          }
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': style === 'dark' ? '#1a1a1a' : '#f8f9fa' }
          },
          {
            id: 'earth',
            type: 'fill',
            source: 'protomaps',
            'source-layer': 'earth',
            paint: { 'fill-color': style === 'dark' ? '#2d2d2d' : '#e9ecef' }
          },
          {
            id: 'water',
            type: 'fill',
            source: 'protomaps',
            'source-layer': 'water',
            paint: { 'fill-color': style === 'dark' ? '#1a365d' : '#74c0fc' }
          },
          {
            id: 'roads',
            type: 'line',
            source: 'protomaps',
            'source-layer': 'roads',
            paint: {
              'line-color': style === 'dark' ? '#404040' : '#ffffff',
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 4]
            }
          },
          {
            id: 'buildings',
            type: 'fill',
            source: 'protomaps',
            'source-layer': 'buildings',
            paint: { 
              'fill-color': style === 'dark' ? '#404040' : '#dee2e6', 
              'fill-opacity': 0.8 
            }
          }
        ]
      };

      // Initialize map with London center
      const map = new maplibregl.Map({
        container: mapRef.current,
        style: mapStyle,
        center: [-0.1278, 51.5074], // London
        zoom: 10,
        attributionControl: true
      });

      // Add controls
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.addControl(new maplibregl.FullscreenControl(), 'top-right');

      map.on('load', () => {
        mapInstanceRef.current = map;
        setLoading(false);
        fetchEmployeeLocations();
      });

      map.on('error', (e) => {
        console.error('Admin map error:', e);
        setError('Failed to load admin location map');
        setLoading(false);
      });

    } catch (err) {
      console.error('Failed to initialize admin map:', err);
      setError('Failed to initialize map');
      setLoading(false);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (mapInstanceRef.current) {
        // Clear all markers
        Object.values(markersRef.current).forEach(marker => marker.remove());
        markersRef.current = {};
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Setup auto-refresh
  useEffect(() => {
    if (autoRefresh && mapInstanceRef.current) {
      refreshIntervalRef.current = setInterval(() => {
        fetchEmployeeLocations();
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval]);

  // Fetch employee locations from API
  const fetchEmployeeLocations = async () => {
    try {
      // This would be your actual API endpoint
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/admin/employee-locations`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
        setLastUpdate(new Date());
        updateMapMarkers(data.employees || []);
      } else {
        // Mock data for demonstration
        const mockEmployees = [
          {
            id: '1',
            name: 'John Doe',
            email: 'john@example.com',
            department: 'Engineering',
            status: 'active',
            location: {
              latitude: 51.5074,
              longitude: -0.1278,
              accuracy: 10,
              timestamp: new Date().toISOString()
            },
            clockStatus: 'clocked-in'
          },
          {
            id: '2',
            name: 'Jane Smith',
            email: 'jane@example.com',
            department: 'Design',
            status: 'on-break',
            location: {
              latitude: 51.5154,
              longitude: -0.1425,
              accuracy: 15,
              timestamp: new Date().toISOString()
            },
            clockStatus: 'on-break'
          }
        ];
        setEmployees(mockEmployees);
        setLastUpdate(new Date());
        updateMapMarkers(mockEmployees);
      }
    } catch (err) {
      console.error('Failed to fetch employee locations:', err);
      setError('Failed to fetch employee locations');
    }
  };

  // Update map markers
  const updateMapMarkers = (employeeData) => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    
    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // Filter employees based on status
    const filteredEmployees = employeeData.filter(emp => {
      if (filterStatus === 'all') return true;
      return emp.status === filterStatus;
    });

    // Add new markers
    filteredEmployees.forEach(employee => {
      if (!employee.location) return;

      const { latitude, longitude } = employee.location;
      
      // Create custom marker element
      const markerElement = document.createElement('div');
      markerElement.className = 'admin-location-marker';
      markerElement.innerHTML = `
        <div style="
          width: 40px;
          height: 40px;
          background-color: ${getStatusColor(employee.status)};
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
          color: white;
        ">
          ${employee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
        </div>
      `;

      // Create marker
      const marker = new maplibregl.Marker(markerElement)
        .setLngLat([longitude, latitude])
        .addTo(map);

      // Create popup
      const popup = new maplibregl.Popup({ 
        offset: 25,
        closeButton: true,
        closeOnClick: false
      }).setHTML(createEmployeePopupHTML(employee));

      marker.setPopup(popup);

      // Add click handler
      markerElement.addEventListener('click', () => {
        setSelectedEmployee(employee);
        if (onEmployeeClick) {
          onEmployeeClick(employee);
        }
      });

      markersRef.current[employee.id] = marker;
    });

    // Fit map to show all markers
    if (filteredEmployees.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      filteredEmployees.forEach(emp => {
        if (emp.location) {
          bounds.extend([emp.location.longitude, emp.location.latitude]);
        }
      });
      
      map.fitBounds(bounds, { 
        padding: 50,
        maxZoom: 15
      });
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981'; // Green
      case 'on-break': return '#f59e0b'; // Yellow
      case 'offline': return '#6b7280'; // Gray
      default: return '#3b82f6'; // Blue
    }
  };

  // Create employee popup HTML
  const createEmployeePopupHTML = (employee) => {
    const { location } = employee;
    const lastSeen = location?.timestamp ? new Date(location.timestamp) : new Date();
    
    return `
      <div style="padding: 12px; font-family: system-ui, sans-serif; min-width: 250px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <div style="
            width: 32px;
            height: 32px;
            background-color: ${getStatusColor(employee.status)};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
          ">
            ${employee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <div style="font-weight: 600; color: #111827;">${employee.name}</div>
            <div style="font-size: 12px; color: #6b7280;">${employee.department}</div>
          </div>
        </div>
        
        <div style="margin-bottom: 8px;">
          <div style="font-size: 12px; color: #374151; margin-bottom: 4px;">
            <strong>Status:</strong> 
            <span style="
              background-color: ${getStatusColor(employee.status)}20;
              color: ${getStatusColor(employee.status)};
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 500;
            ">
              ${employee.status.toUpperCase()}
            </span>
          </div>
          <div style="font-size: 12px; color: #374151; margin-bottom: 4px;">
            <strong>Clock Status:</strong> ${employee.clockStatus || 'Unknown'}
          </div>
        </div>
        
        <div style="border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;">
          <div style="font-size: 11px; color: #6b7280;">
            📍 ${location?.latitude?.toFixed(6)}, ${location?.longitude?.toFixed(6)}
          </div>
          ${location?.accuracy ? `<div style="font-size: 11px; color: #6b7280;">🎯 Accuracy: ±${Math.round(location.accuracy)}m</div>` : ''}
          <div style="font-size: 11px; color: #6b7280;">
            🕒 Last seen: ${moment(lastSeen).tz('Europe/London').format('HH:mm:ss')}
          </div>
        </div>
      </div>
    `;
  };

  // Manual refresh
  const handleRefresh = () => {
    fetchEmployeeLocations();
  };

  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    if (filterStatus === 'all') return true;
    return emp.status === filterStatus;
  });

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`} style={{ height }}>
        <div className="text-center text-red-600">
          <MapPinIcon className="w-12 h-12 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Map Error</h3>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Header Controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <UserGroupIcon className="w-6 h-6" />
            Employee Locations
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>{filteredEmployees.length} employees</span>
            {lastUpdate && (
              <span>• Updated {moment(lastUpdate).tz('Europe/London').format('HH:mm:ss')}</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="on-break">On Break</option>
            <option value="offline">Offline</option>
          </select>
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshIcon className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div 
          className="bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center"
          style={{ height }}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading employee locations...</p>
          </div>
        </div>
      )}

      {/* Map Container */}
      {!loading && (
        <div 
          ref={mapRef} 
          className="w-full rounded-lg shadow-lg border border-gray-200"
          style={{ height }}
        />
      )}

      {/* Employee Stats */}
      {!loading && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-green-900">Active</span>
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {employees.filter(e => e.status === 'active').length}
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-sm font-medium text-yellow-900">On Break</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">
              {employees.filter(e => e.status === 'on-break').length}
            </div>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <span className="text-sm font-medium text-gray-900">Offline</span>
            </div>
            <div className="text-2xl font-bold text-gray-600 mt-1">
              {employees.filter(e => e.status === 'offline').length}
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <UserGroupIcon className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Total</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {employees.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLocationDashboard;
