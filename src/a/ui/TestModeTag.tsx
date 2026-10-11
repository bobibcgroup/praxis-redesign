/**
 * While test mode is on (switched on at /internal/analytics, for one tab), a thin strip across the
 * top of every screen says so, so a simulated answer is never taken for a real one.
 */
import { useEffect, useState } from "react";
import { simScenario, SIM_SCENARIOS, type SimScenario } from "../../core/sim";

export function TestModeTag() {
  const [sim, setSim] = useState<SimScenario | null>(() => simScenario());

  useEffect(() => {
    const sync = () => setSim(simScenario());
    window.addEventListener("praxis-sim", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("praxis-sim", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  if (!sim) return null;
  return (
    <div className="a-testmode" role="status">
      Test mode: {SIM_SCENARIOS[sim]}
    </div>
  );
}
