export default function TestPage() {
  return (
    <div className="p-8">
      <h1>Test Page</h1>
      <p>This is a minimal test page</p>
      <div data-testid="forecast-tab" className="mt-4 p-4 border bg-blue-100">
        Test Forecast Tab Element - Should be findable
      </div>
    </div>
  );
}