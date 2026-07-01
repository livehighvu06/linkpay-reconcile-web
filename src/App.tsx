import AppHeader from "./components/AppHeader";
import FloatingMascot from "./components/FloatingMascot";
import ReconcileTab from "./components/ReconcileTab";

export default function App() {
  return (
    <div className="min-h-screen bg-background text-slate-800">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-16">
        <ReconcileTab />
        <FloatingMascot />
      </main>
    </div>
  );
}
