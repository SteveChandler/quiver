"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, RefreshCw } from "lucide-react"
import { updateAllBeachForecasts, updateBeachForecasts } from "@/actions/forecast-actions"
import { getBeaches } from "@/actions/beach-actions"
import { useEffect } from "react"
import type { Beach } from "@/types/database"

export default function ForecastsAdminPage() {
  const [beaches, setBeaches] = useState<Beach[]>([])
  const [loading, setLoading] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<{ success: boolean; message: string } | null>(null)
  const [selectedBeach, setSelectedBeach] = useState<string | null>(null)

  useEffect(() => {
    async function loadBeaches() {
      const result = await getBeaches()
      if (result.success && result.data) {
        setBeaches(result.data)
      }
    }

    loadBeaches()
  }, [])

  const handleUpdateAll = async () => {
    setLoading(true)
    setUpdateStatus(null)

    try {
      const result = await updateAllBeachForecasts()

      if (result.success) {
        setUpdateStatus({
          success: true,
          message: "All forecasts updated successfully!",
        })
      } else {
        setUpdateStatus({
          success: false,
          message: `Error: ${result.error || "Unknown error"}`,
        })
      }
    } catch (error) {
      setUpdateStatus({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateBeach = async (beachId: string) => {
    setSelectedBeach(beachId)
    setUpdateStatus(null)

    try {
      const result = await updateBeachForecasts(beachId)

      if (result.success) {
        setUpdateStatus({
          success: true,
          message: "Beach forecast updated successfully!",
        })
      } else {
        setUpdateStatus({
          success: false,
          message: `Error: ${result.error || "Unknown error"}`,
        })
      }
    } catch (error) {
      setUpdateStatus({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      })
    } finally {
      setSelectedBeach(null)
    }
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Forecast Management</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Update All Forecasts</CardTitle>
          <CardDescription>
            Update forecasts for all beaches. This may take a while depending on the number of beaches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {updateStatus && (
            <div
              className={`p-4 mb-4 rounded-md ${
                updateStatus.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {updateStatus.message}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleUpdateAll} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Update All Forecasts
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <h2 className="text-xl font-bold mb-4">Update Individual Beach Forecasts</h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {beaches.map((beach) => (
          <Card key={beach.id}>
            <CardHeader>
              <CardTitle>{beach.name}</CardTitle>
              <CardDescription>{beach.location}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                onClick={() => handleUpdateBeach(beach.id)}
                disabled={selectedBeach === beach.id}
                variant="outline"
                className="w-full"
              >
                {selectedBeach === beach.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Update Forecast
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
