export default function App() {
  return (
    <div className="min-h-screen bg-space-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-5xl font-black text-artemis-blue mb-4">
          🚀 ARTEMIS INTELLIGENCE
        </h1>
        <p className="text-gray-400 text-lg">
          AI-Powered Mission Tracking Platform
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <div className="w-2 h-2 rounded-full bg-artemis-green animate-pulse"></div>
          <span className="text-artemis-green text-sm font-mono">MISSION ACTIVE</span>
        </div>
      </div>
    </div>
  )
}
