from rest_framework import serializers


class FoundationSummarySerializer(serializers.Serializer):
    tenants = serializers.IntegerField(min_value=0)
    organizations = serializers.IntegerField(min_value=0)
    departments = serializers.IntegerField(min_value=0)
    buildings = serializers.IntegerField(min_value=0)
    floors = serializers.IntegerField(min_value=0)
    areas = serializers.IntegerField(min_value=0)
    asset_types = serializers.IntegerField(min_value=0)
    assets = serializers.IntegerField(min_value=0)
    service = serializers.CharField()

