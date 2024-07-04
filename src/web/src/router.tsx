import { GamePage } from "@pages/game";
import { NotFoundPage } from "@pages/notfound";
import { TestTransitionPage } from "@pages/testtransitionpage";
import { HashRouter, Routes, Route } from "react-router-dom";
import { LandingPage } from "./pages/landing";

export const AppRouter = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="*" element={<NotFoundPage />} />
        <Route path="/tt" element={<TestTransitionPage />} />
      </Routes>
    </HashRouter>
  );
};
