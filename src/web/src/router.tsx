import { GamePage } from "@pages/game";
import { NotFoundPage } from "@pages/notfound";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LandingPage } from "./pages/landing";

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};
