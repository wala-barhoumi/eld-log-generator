from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Trip, DailyLog
from .serializers import TripSerializer, DailyLogSerializer
from datetime import datetime, timedelta
import requests
from geopy.distance import geodesic
import os

class TripViewSet(viewsets.ModelViewSet):
    queryset = Trip.objects.all()
    serializer_class = TripSerializer
    
    @action(detail=False, methods=['post'])
    def calculate_route(self, request):
        """Calculate route and generate ELD logs"""
        current_location = request.data.get('current_location')
        pickup_location = request.data.get('pickup_location')
        dropoff_location = request.data.get('dropoff_location')
        current_cycle_hours = float(request.data.get('current_cycle_hours', 0))
        
        # Create trip instance
        trip = Trip.objects.create(
            current_location=current_location,
            pickup_location=pickup_location,
            dropoff_location=dropoff_location,
            current_cycle_hours=current_cycle_hours
        )
        
        # Get coordinates for locations
        coords = self.geocode_locations(current_location, pickup_location, dropoff_location)
        
        if not coords:
            return Response(
                {'error': 'Could not geocode locations'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calculate route with stops
        route_data = self.calculate_route_with_stops(coords, current_cycle_hours)
        
        trip.set_route_data(route_data)
        trip.total_distance = route_data['total_distance']
        trip.total_duration = route_data['total_duration']
        trip.save()
        
        # Generate daily logs
        self.generate_daily_logs(trip, route_data, current_cycle_hours)
        
        serializer = self.get_serializer(trip)
        return Response(serializer.data)
    
    def geocode_locations(self, current, pickup, dropoff):
        """Geocode locations using a free API"""
        base_url = "https://nominatim.openstreetmap.org/search"
        headers = {'User-Agent': 'ELD-Log-Generator/1.0'}
        
        locations = {}
        for key, location in [('current', current), ('pickup', pickup), ('dropoff', dropoff)]:
            response = requests.get(
                base_url,
                params={'q': location, 'format': 'json', 'limit': 1},
                headers=headers
            )
            if response.status_code == 200 and response.json():
                data = response.json()[0]
                locations[key] = {
                    'lat': float(data['lat']),
                    'lon': float(data['lon']),
                    'display_name': data['display_name']
                }
        
        return locations if len(locations) == 3 else None
    
    def calculate_route_with_stops(self, coords, current_cycle_hours):
        """Calculate route with required stops based on HOS regulations"""
        # Calculate distances
        leg1_distance = geodesic(
            (coords['current']['lat'], coords['current']['lon']),
            (coords['pickup']['lat'], coords['pickup']['lon'])
        ).miles
        
        leg2_distance = geodesic(
            (coords['pickup']['lat'], coords['pickup']['lon']),
            (coords['dropoff']['lat'], coords['dropoff']['lon'])
        ).miles
        
        total_distance = leg1_distance + leg2_distance
        
        # Estimate driving time (assuming average 50 mph)
        avg_speed = 50
        driving_time = total_distance / avg_speed
        
        # Add 1 hour for pickup and 1 hour for dropoff
        pickup_time = 1.0
        dropoff_time = 1.0
        
        # Calculate required stops based on HOS rules
        stops = self.calculate_hos_stops(
            coords, 
            total_distance, 
            driving_time, 
            current_cycle_hours,
            pickup_time,
            dropoff_time
        )
        
        return {
            'coordinates': coords,
            'total_distance': round(total_distance, 2),
            'total_duration': round(driving_time + pickup_time + dropoff_time, 2),
            'legs': [
                {
                    'from': coords['current']['display_name'],
                    'to': coords['pickup']['display_name'],
                    'distance': round(leg1_distance, 2)
                },
                {
                    'from': coords['pickup']['display_name'],
                    'to': coords['dropoff']['display_name'],
                    'distance': round(leg2_distance, 2)
                }
            ],
            'stops': stops
        }
    
    def calculate_hos_stops(self, coords, total_distance, driving_time, current_cycle_hours, pickup_time, dropoff_time):
        """Calculate required stops based on HOS regulations"""
        stops = []
        
        # HOS Rules for 70/8 property-carrying:
        # - 11 hours driving limit
        # - 14 hour driving window
        # - 30-minute break after 8 hours of driving
        # - 10 hours off duty required
        # - Fuel every 1000 miles
        
        available_driving_hours = 11
        available_duty_hours = 14
        hours_until_break = 8
        
        current_time = 0
        distance_covered = 0
        fuel_distance = 0
        
        # Add fuel stops every 1000 miles
        num_fuel_stops = int(total_distance / 1000)
        
        for i in range(num_fuel_stops):
            fuel_stop_distance = (i + 1) * 1000
            fuel_stop_time = (fuel_stop_distance / total_distance) * driving_time
            
            stops.append({
                'type': 'fuel',
                'duration': 0.5,  # 30 minutes
                'time_offset': fuel_stop_time,
                'reason': 'Fueling stop',
                'location': f'Fuel stop at mile {fuel_stop_distance}'
            })
        
        # Add 30-minute break after 8 hours of driving
        if driving_time > 8:
            stops.append({
                'type': 'break',
                'duration': 0.5,
                'time_offset': 8,
                'reason': '30-minute rest break (HOS required)',
                'location': 'Rest area'
            })
        
        # Add 10-hour rest if driving exceeds 11 hours or duty exceeds 14 hours
        total_duty_time = driving_time + pickup_time + dropoff_time + (len(stops) * 0.5)
        
        if driving_time > 11 or total_duty_time > 14:
            # Calculate when to take 10-hour break
            break_time = min(11, 14 - pickup_time - 1)  # Before hitting limits
            
            stops.append({
                'type': 'rest',
                'duration': 10,
                'time_offset': break_time,
                'reason': '10-hour off-duty rest (HOS required)',
                'location': 'Truck stop / Rest area'
            })
        
        # Sort stops by time offset
        stops.sort(key=lambda x: x['time_offset'])
        
        return stops
    
    def generate_daily_logs(self, trip, route_data, current_cycle_hours):
        """Generate ELD daily log sheets"""
        total_duration = route_data['total_duration']
        stops = route_data['stops']
        
        # Calculate number of days needed
        current_day = datetime.now().date()
        hours_in_day = 0
        current_log_entries = []
        current_hour = 0
        
        daily_logs_data = []
        
        # Start with off-duty if current_cycle_hours allows
        log_entry = {
            'start_time': 0,
            'end_time': 0,
            'status': 'off_duty',
            'location': route_data['coordinates']['current']['display_name']
        }
        
        # Simulate trip progression
        driving_hours = 0
        on_duty_hours = 0
        off_duty_hours = 0
        sleeper_hours = 0
        
        # Add pickup
        current_log_entries.append({
            'start_time': current_hour,
            'end_time': current_hour + 1,
            'status': 'on_duty',
            'location': route_data['coordinates']['pickup']['display_name'],
            'activity': 'Loading/Pickup'
        })
        current_hour += 1
        on_duty_hours += 1
        
        # Add driving and stops
        remaining_driving = route_data['total_duration'] - 2  # Minus pickup and dropoff
        
        for stop in stops:
            drive_before_stop = stop['time_offset'] - current_hour
            
            if drive_before_stop > 0:
                current_log_entries.append({
                    'start_time': current_hour,
                    'end_time': current_hour + drive_before_stop,
                    'status': 'driving',
                    'location': 'En route',
                    'activity': 'Driving'
                })
                current_hour += drive_before_stop
                driving_hours += drive_before_stop
            
            # Add stop
            if stop['type'] == 'rest' and stop['duration'] >= 10:
                status = 'sleeper_berth'
                sleeper_hours += stop['duration']
            elif stop['type'] == 'break':
                status = 'off_duty'
                off_duty_hours += stop['duration']
            else:
                status = 'on_duty'
                on_duty_hours += stop['duration']
            
            current_log_entries.append({
                'start_time': current_hour,
                'end_time': current_hour + stop['duration'],
                'status': status,
                'location': stop.get('location', 'Stop'),
                'activity': stop['reason']
            })
            current_hour += stop['duration']
            
            # Check if we need a new day
            if current_hour >= 24:
                # Save current day
                daily_log = DailyLog.objects.create(
                    trip=trip,
                    date=current_day,
                    total_driving_hours=driving_hours,
                    total_on_duty_hours=on_duty_hours,
                    total_off_duty_hours=off_duty_hours,
                    total_sleeper_berth_hours=sleeper_hours
                )
                daily_log.set_log_data(current_log_entries)
                daily_log.save()
                
                # Reset for next day
                current_day += timedelta(days=1)
                current_log_entries = []
                current_hour = 0
                driving_hours = 0
                on_duty_hours = 0
                off_duty_hours = 0
                sleeper_hours = 0
        
        # Add dropoff
        current_log_entries.append({
            'start_time': current_hour,
            'end_time': current_hour + 1,
            'status': 'on_duty',
            'location': route_data['coordinates']['dropoff']['display_name'],
            'activity': 'Unloading/Dropoff'
        })
        on_duty_hours += 1
        
        # Fill rest of day with off-duty
        if current_hour + 1 < 24:
            current_log_entries.append({
                'start_time': current_hour + 1,
                'end_time': 24,
                'status': 'off_duty',
                'location': route_data['coordinates']['dropoff']['display_name'],
                'activity': 'Off duty'
            })
            off_duty_hours += (24 - current_hour - 1)
        
        # Save final day
        daily_log = DailyLog.objects.create(
            trip=trip,
            date=current_day,
            total_driving_hours=driving_hours,
            total_on_duty_hours=on_duty_hours,
            total_off_duty_hours=off_duty_hours,
            total_sleeper_berth_hours=sleeper_hours
        )
        daily_log.set_log_data(current_log_entries)
        daily_log.save()