import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Provider } from './lib/store';
import { Layout } from './components/Layout';
import { Discover } from './pages/Discover';
import { Circles } from './pages/Circles';
import { Works } from './pages/Works';
import { Calendar } from './pages/Calendar';
import { Studio } from './pages/Studio';
import { Live } from './pages/Live';
export default function App() {
  return (
    <BrowserRouter>
      <Provider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Discover />} />
            <Route path="circles" element={<Circles />} />
            <Route path="works" element={<Works />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="studio" element={<Studio />} />
            <Route path="live/:id" element={<Live />} />
            <Route
              path="*"
              element={
                <div className="empty-state">
                  <h1>这片灵感，还没被发现。</h1>
                  <p>你访问的页面不存在。</p>
                  <Link className="button dark" to="/">
                    回到发现页
                  </Link>
                </div>
              }
            />
          </Route>
        </Routes>
      </Provider>
    </BrowserRouter>
  );
}
