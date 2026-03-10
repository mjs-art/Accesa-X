export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <span className="text-xl font-bold text-[#2A2928]">
            accesa
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-10">
        {children}
      </main>
    </div>
  )
}
