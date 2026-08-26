'use client';

import { useState, useEffect, useRef } from 'react';

interface LocationItem {
  name: string;
  lat: number;
  lon: number;
  city?: string;
}

interface LocationInputProps {
  value: string;
  onChange: (value: string) => void;
  onLocationSelect: (location: LocationItem) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export default function LocationInput({
  value,
  onChange,
  onLocationSelect,
  placeholder = 'Search city, neighborhood, or area...',
  className = '',
  required = false,
}: LocationInputProps) {
  const [suggestions, setSuggestions] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    onChange(query);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/location/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(Array.isArray(data) ? data : []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Location autocomplete error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const handleSelect = (item: LocationItem) => {
    onChange(item.name);
    onLocationSelect(item);
    setShowDropdown(false);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`/api/location/search?lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            const placeName = data.name || 'Current Location';
            onChange(placeName);
            onLocationSelect({
              name: placeName,
              lat: latitude,
              lon: longitude,
            });
          }
        } catch (e) {
          console.error(e);
        } finally {
          setDetectingLocation(false);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setDetectingLocation(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative flex items-center">
        <span className="absolute left-3.5 text-gray-400 text-sm pointer-events-none">
          📍
        </span>
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder}
          required={required}
          className={`w-full pl-9 pr-24 py-2.5 bg-gray-800/80 border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-white text-sm placeholder-gray-500 outline-none transition-all ${className}`}
        />

        {/* Action icons / Current location button */}
        <div className="absolute right-2 flex items-center gap-1.5">
          {loading && (
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mr-1" />
          )}

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={detectingLocation}
            title="Use My Current Location"
            className="p-1.5 rounded-lg bg-gray-700/60 hover:bg-indigo-600/30 text-gray-300 hover:text-indigo-300 text-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {detectingLocation ? (
              <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>🎯</span>
            )}
            <span className="text-[10px] font-medium hidden sm:inline">GPS</span>
          </button>
        </div>
      </div>

      {/* Realtime Suggestions Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-gray-900/95 border border-gray-700 rounded-2xl shadow-2xl backdrop-blur-xl max-h-60 overflow-y-auto overflow-x-hidden animate-fade-in divide-y divide-gray-800/60">
          {suggestions.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full text-left px-4 py-3 hover:bg-indigo-600/20 text-gray-200 hover:text-white transition-colors flex items-start gap-2.5 cursor-pointer text-xs"
            >
              <span className="text-sm mt-0.5 text-indigo-400">📍</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">{item.name}</div>
                {item.city && <div className="text-[10px] text-gray-400 truncate">{item.city}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
