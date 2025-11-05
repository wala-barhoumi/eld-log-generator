import React, { useState } from 'react';
import './TripForm.css';

function TripForm({ onSubmit, loading }) {
  const [formData, setFormData] = useState({
    current_location: '',
    pickup_location: '',
    dropoff_location: '',
    current_cycle_hours: 0
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'current_cycle_hours' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form className="trip-form" onSubmit={handleSubmit}>
      <h2>📋 Enter Trip Details</h2>
      
      <div className="form-group">
        <label htmlFor="current_location">
          📍 Current Location
        </label>
        <input
          type="text"
          id="current_location"
          name="current_location"
          value={formData.current_location}
          onChange={handleChange}
          placeholder="e.g., Dallas, TX"
          required
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="pickup_location">
          📦 Pickup Location
        </label>
        <input
          type="text"
          id="pickup_location"
          name="pickup_location"
          value={formData.pickup_location}
          onChange={handleChange}
          placeholder="e.g., Houston, TX"
          required
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="dropoff_location">
          🎯 Dropoff Location
        </label>
        <input
          type="text"
          id="dropoff_location"
          name="dropoff_location"
          value={formData.dropoff_location}
          onChange={handleChange}
          placeholder="e.g., Miami, FL"
          required
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="current_cycle_used">
          ⏰ Current Cycle Hours Used
        </label>
        <input
          type="number"
          id="current_cycle_used"
          name="current_cycle_used"
          value={formData.current_cycle_used}
          onChange={handleChange}
          min="0"
          max="70"
          step="0.5"
          required
          disabled={loading}
        />
        <small>Hours already worked in current 8-day cycle (0-70 hrs)</small>
      </div>

      <button type="submit" className="submit-btn" disabled={loading}>
        {loading ? '⏳ Planning Trip...' : '🚀 Plan Trip'}
      </button>
    </form>
  );
}

export default TripForm;