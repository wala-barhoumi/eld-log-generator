from django.db import models
import json

class Trip(models.Model):
    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    current_cycle_hours = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    route_data = models.TextField(null=True, blank=True)  # Store JSON
    total_distance = models.FloatField(null=True, blank=True)
    total_duration = models.FloatField(null=True, blank=True)
    
    def set_route_data(self, data):
        self.route_data = json.dumps(data)
    
    def get_route_data(self):
        if self.route_data:
            return json.loads(self.route_data)
        return None
    
    class Meta:
        ordering = ['-created_at']

class DailyLog(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='daily_logs')
    date = models.DateField()
    log_data = models.TextField()  # Store JSON of log entries
    total_driving_hours = models.FloatField()
    total_on_duty_hours = models.FloatField()
    total_off_duty_hours = models.FloatField()
    total_sleeper_berth_hours = models.FloatField()
    
    def set_log_data(self, data):
        self.log_data = json.dumps(data)
    
    def get_log_data(self):
        if self.log_data:
            return json.loads(self.log_data)
        return None
    
    class Meta:
        ordering = ['date']