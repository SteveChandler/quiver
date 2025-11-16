/**
 * Forecast Health Dashboard Component
 * 
 * Displays real-time forecast health metrics for admin monitoring
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ForecastHealthMetrics {
  totalBeaches: number;
  beachesWithForecasts: number;
  beachesWithStaleData: number;
  beachesWithCriticalStaleData: number;
  beachesWithWarningStaleData: number;
  coveragePercentage: number;
  oldestForecastAge: number;
  averageForecastAge: number;
  dataSourceBreakdown: Record<string, number>;
  healthStatus: 'healthy' | 'degraded' | 'critical';
  issues: string[];
  staleBeaches: Array<{
    beachId: string;
    beachName: string;
    ageHours: number;
    dataSource: string;
    lastUpdate: string;
  }>;
}

interface HealthResponse {
  success: boolean;
  metrics: ForecastHealthMetrics;
  meta: {
    timestamp: string;
    durationMs: number;
  };
}

export function ForecastHealthDashboard() {
  const [metrics, setMetrics] = useState<ForecastHealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const fetchHealthMetrics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/monitoring/forecast-health');
      const data: HealthResponse = await response.json();
      
      if (data.success) {
        setMetrics(data.metrics);
        setLastUpdate(data.meta.timestamp);
      } else {
        setError('Failed to fetch health metrics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthMetrics();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchHealthMetrics, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" /> Degraded</Badge>;
      case 'critical':
        return <Badge className="bg-red-500"><AlertCircle className="w-3 h-3 mr-1" /> Critical</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  if (loading && !metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Forecast Health</CardTitle>
          <CardDescription>Loading metrics...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Forecast Health Dashboard</h2>
        <Button onClick={fetchHealthMetrics} disabled={loading} size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Health Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Overall Health Status</CardTitle>
            {getHealthBadge(metrics.healthStatus)}
          </div>
          <CardDescription>
            Last updated: {new Date(lastUpdate).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Beaches</p>
              <p className="text-2xl font-bold">{metrics.totalBeaches}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Coverage</p>
              <p className="text-2xl font-bold">{(metrics.coveragePercentage * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stale Data</p>
              <p className="text-2xl font-bold text-yellow-600">{metrics.beachesWithStaleData}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Critical Stale</p>
              <p className="text-2xl font-bold text-red-600">{metrics.beachesWithCriticalStaleData}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues Alert */}
      {metrics.issues.length > 0 && (
        <Alert variant={metrics.healthStatus === 'critical' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Issues Detected</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {metrics.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Data Source Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Data Source Breakdown</CardTitle>
          <CardDescription>Beaches by data source</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(metrics.dataSourceBreakdown).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <span className="font-medium">{source}</span>
                <Badge variant="outline">{count} beaches</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stale Beaches List */}
      {metrics.staleBeaches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stale Data Details</CardTitle>
            <CardDescription>Beaches with stale forecast data (top 20)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.staleBeaches.slice(0, 20).map((beach) => (
                <div key={beach.beachId} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="font-medium">{beach.beachName}</p>
                    <p className="text-sm text-muted-foreground">
                      Source: {beach.dataSource} | Last updated: {new Date(beach.lastUpdate).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={beach.ageHours > 24 ? 'destructive' : 'secondary'}>
                    {beach.ageHours.toFixed(1)}h old
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Age Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Age Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Average Forecast Age</p>
              <p className="text-xl font-bold">{metrics.averageForecastAge.toFixed(2)} hours</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Oldest Forecast Age</p>
              <p className="text-xl font-bold">{metrics.oldestForecastAge.toFixed(2)} hours</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
