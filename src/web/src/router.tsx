import { GamePage } from "@pages/game";
import { NotFoundPage } from "@pages/notfound";
import { TestPage } from "@pages/test";
import { TestTransitionPage } from "@pages/testtransitionpage";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LandingPage } from "./pages/landing";

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="*" element={<NotFoundPage />} />
        <Route path="/tmd" element={<TestPage />} />
        <Route path="/tt" element={<TestTransitionPage />} />
      </Routes>
    </BrowserRouter>
  );
};
