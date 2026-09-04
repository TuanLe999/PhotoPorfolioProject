import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { PortfolioRoute } from './routes/PortfolioRoute';
import { PreviewRoute } from './routes/PreviewRoute';
import { AdminPage } from './components/admin/AdminPage';
import './styles/theme.css';
import './styles/render.css';
import './styles/site.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PortfolioRoute />} />
        <Route path="/preview" element={<PreviewRoute />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<PortfolioRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
