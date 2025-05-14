import { NextResponse } from "next/server"
import { updateAllBeachForecasts } from "@/actions/forecast-actions"

export async function GET(request: Request) {
  // Check for a secret token to secure the endpoint
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")
  const secretToken = process.env.CRON_SECRET_TOKEN

  if (token !== secretToken) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await updateAllBeachForecasts()

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "Failed to update forecasts", error: result.error },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, message: "Forecasts updated successfully", results: result.results })
  } catch (error) {
    console.error("Error in forecast update cron job:", error)
    return NextResponse.json(
      { success: false, message: "Error updating forecasts", error: error instanceof Error ? error.message : error },
      { status: 500 },
    )
  }
}
