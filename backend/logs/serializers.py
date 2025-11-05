from rest_framework import serializers
from .models import Trip, DailyLog

class DailyLogSerializer(serializers.ModelSerializer):
    log_data = serializers.SerializerMethodField()
    
    class Meta:
        model = DailyLog
        fields = '__all__'
    
    def get_log_data(self, obj):
        return obj.get_log_data()

class TripSerializer(serializers.ModelSerializer):
    daily_logs = DailyLogSerializer(many=True, read_only=True)
    route_data = serializers.SerializerMethodField()
    
    class Meta:
        model = Trip
        fields = '__all__'
    
    def get_route_data(self, obj):
        return obj.get_route_data()