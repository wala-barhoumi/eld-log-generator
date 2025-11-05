import React, { useState } from 'react';
import axios from 'axios';
import TripForm from './components/TripForm';
import RouteMap from './components/RouteMap';
import DailyLogViewer from './components/DailyLogViewer';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

function App() {
  const [tripData, setTripData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleTripSubmit = async (formData) => {
    setLoading(true);
    setError(null);
    setTripData(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/trips/calculate_route/`, formData);
      setTripData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to plan trip. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>🚛 ELD Trip Planner</h1>
        <p>Plan your route with HOS compliance</p>
      </header>

      <div className="app-container">
        <div className="form-section">
          <TripForm onSubmit={handleTripSubmit} loading={loading} />
          
          {error && (
            <div className="error-message">
              <strong>❌ Error:</strong> {error}
            </div>
          )}
        </div>

        {loading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>Planning your trip...</p>
          </div>
        )}

        {tripData && !loading && (
          <div className="results-section">
            <div className="trip-summary">
              <h2>📊 Trip Summary</h2>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="label">Total Distance</span>
                  <span className="value">{Math.round(tripData.total_distance || 0)} miles</span>
                </div>
                <div className="summary-item">
                  <span className="label">Estimated Duration</span>
                  <span className="value">{Math.round(tripData.total_duration || 0)} hours</span>
                </div>
                <div className="summary-item">
                  <span className="label">Required Stops</span>
                  <span className="value">{tripData.route_data?.stops?.length || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Daily Logs</span>
                  <span className="value">{tripData.daily_logs?.length || 0} days</span>
                </div>
              </div>
            </div>

            {tripData.route_data && (
              <div className="map-section">
                <h2>🗺️ Route & Stops</h2>
                <RouteMap routeData={tripData.route_data} />
              </div>
            )}

            {tripData.daily_logs && tripData.daily_logs.length > 0 && (
              <div className="logs-section">
                <h2>📋 ELD Daily Logs</h2>
                <DailyLogViewer logs={tripData.daily_logs} />
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="app-footer">
        <p>✅ Compliant with FMCSA HOS Regulations (70-hour/8-day rule)</p>
      </footer>
    </div>
  );
}

export default App;