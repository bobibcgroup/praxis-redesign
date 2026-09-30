/**
 * Concept A: Stage. One full-viewport stage split in two: one question at a
 * time on the left, a living print on the right. Every step is a route.
 * Brand Forest and Bone, element system Hairline, light and dark.
 */
import { Navigate, Route, Routes } from "react-router-dom";
import "./a.css";
import "./a-layout.css";
import { useConceptFonts } from "../shared/fonts";
import { JourneyProvider } from "./lib/journey";
import { useJourney } from "./lib/journeyContext";
import { Home } from "./screens/Home";
import { LookDetail, Looks } from "./screens/Looks";
import { Build } from "./screens/moment/Build";
import { Question } from "./screens/moment/Question";
import { Results } from "./screens/moment/Results";
import { TryOn } from "./screens/moment/TryOn";
import { You, YouFace, YouItem } from "./screens/moment/You";
import { DnaBuild, DnaHome, DnaResult } from "./screens/dna/DnaResult";
import { DnaFace, DnaFit, DnaInspiration, DnaLifestyle } from "./screens/dna/DnaSteps";
import { Gate } from "./ui/Gate";
import { ModeButton } from "./ui/Mode";

const FONTS = "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600&family=Geist:wght@400;500&family=Geist+Mono:wght@400&display=swap";

function Fallback() {
  const { href } = useJourney();
  return <Navigate to={href("")} replace />;
}

function Shell() {
  const { mode, setMode, gate } = useJourney();
  return (
    <div data-lab data-concept="a" data-mode={mode} className="min-h-[100dvh]">
      <Routes>
        <Route index element={<Home />} />
        <Route path="moment" element={<Fallback />} />
        <Route path="moment/occasion" element={<Question key="occasion" step="occasion" />} />
        <Route path="moment/venue" element={<Question key="venue" step="venue" />} />
        <Route path="moment/time" element={<Question key="time" step="time" />} />
        <Route path="moment/feel" element={<Question key="feel" step="feel" />} />
        <Route path="moment/spend" element={<Question key="spend" step="spend" />} />
        <Route path="moment/you" element={<You />} />
        <Route path="moment/you/face" element={<YouFace />} />
        <Route path="moment/you/item" element={<YouItem />} />
        <Route path="moment/build" element={<Build />} />
        <Route path="moment/results" element={<Results />} />
        <Route path="moment/tryon" element={<TryOn />} />
        <Route path="looks" element={<Looks />} />
        <Route path="looks/:id" element={<LookDetail />} />
        <Route path="dna" element={<DnaHome />} />
        <Route path="dna/face" element={<DnaFace />} />
        <Route path="dna/fit" element={<DnaFit />} />
        <Route path="dna/lifestyle" element={<DnaLifestyle />} />
        <Route path="dna/inspiration" element={<DnaInspiration />} />
        <Route path="dna/build" element={<DnaBuild />} />
        <Route path="dna/result" element={<DnaResult />} />
        <Route path="*" element={<Fallback />} />
      </Routes>
      <Gate />
      {gate ? null : <ModeButton mode={mode} onMode={setMode} />}
    </div>
  );
}

export default function ConceptA() {
  useConceptFonts("a", FONTS);
  return (
    <JourneyProvider>
      <Shell />
    </JourneyProvider>
  );
}
