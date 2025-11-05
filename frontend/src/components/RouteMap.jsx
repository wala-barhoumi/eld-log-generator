import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './RouteMap.css';

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function RouteMap({ routeData }) {
  if (!routeData || !routeData.coordinates) {
    return <div className="no-data">No route data available</div>;
  }

  const coords = routeData.coordinates;
  
  // Create array of coordinates for map
  const locations = [
    { ...coords.current, name: 'Current Location' },
    { ...coords.pickup, name: 'Pickup Location' },
    { ...coords.dropoff, name: 'Dropoff Location' }
  ];

  const lats = locations.map(l => l.lat);
  const lons = locations.map(l => l.lon);
  const center = [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lons) + Math.max(...lons)) / 2
  ];

  const pathCoordinates = locations.map(loc => [loc.lat, loc.lon]);

  return (
    <div className="route-map-container">
      <MapContainer
        center={center}
        zoom={6}
        style={{ height: '500px', width: '100%', borderRadius: '8px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <Polyline positions={pathCoordinates} color="#2196F3" weight={3} opacity={0.7} />

        {locations.map((location, index) => (
          <Marker key={index} position={[location.lat, location.lon]}>
            <Popup>
              <div className="popup-content">
                <h3>{index === 0 ? '📍' : index === 1 ? '📦' : '🎯'} {location.name}</h3>
                <p>{location.display_name}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="stops-list">
        <h3>📍 Route Stops ({routeData.stops?.length || 0})</h3>
        {routeData.stops && routeData.stops.length > 0 ? (
          <div className="stops-scroll">
            {routeData.stops.map((stop, index) => (
              <div key={index} className="stop-item">
                <div className="stop-number">{index + 1}</div>
                <div className="stop-details">
                  <div className="stop-name">
                    {stop.type === 'fuel' ? '⛽' : stop.type === 'rest' ? '🛏️' : '☕'} {stop.location}
                  </div>
                  <div className="stop-meta">
                    <span className="stop-type">{stop.type}</span>
                    <span>{stop.duration}h</span>
                    <span>{stop.reason}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-data">No stops required for this trip</p>
        )}
      </div>

      <div className="route-legs">
        <h3>🛣️ Route Legs</h3>
        {routeData.legs?.map((leg, index) => (
          <div key={index} className="leg-item">
            <strong>Leg {index + 1}:</strong> {leg.from} → {leg.to}
            <span className="leg-distance">{leg.distance} miles</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RouteMap;